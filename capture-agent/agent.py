"""Sentinel AI capture agent - entry point.

    live packets  ->  bounded queue  ->  flow table  ->  features  ->  /api/ingest

The agent is deliberately "dumb": it captures, aggregates and sends. All
prediction, scoring, correlation and storage happen in the backend, so the
model only ever has to be updated in one place.

Typical use
    python agent.py --list-interfaces
    python agent.py --iface "Wi-Fi"
    python agent.py --iface "Wi-Fi" --dry-run          # compute, print, send nothing
    python agent.py --pcap ..\\captures\\scan.pcap      # replay a capture file

Live capture needs Npcap on Windows (run the terminal as Administrator) or
sudo on Linux/macOS. --pcap and --dry-run need neither.
"""

import argparse
import logging
import os
import queue
import sys
import threading
import time

from dotenv import load_dotenv

import capture
from aggregator import (
    DEFAULT_IDLE_TIMEOUT,
    DEFAULT_MAX_DURATION,
    FlowTable,
)
from capture import CaptureError
from features import (
    MIN_PACKETS_PER_FLOW,
    FeatureSyncError,
    compute_flow_features,
    is_reportable,
    verify_feature_sync,
)
from sender import DEFAULT_INGEST_URL, FlowSender

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
logger = logging.getLogger("agent")

# Load capture-agent/.env so the agent key never has to appear on the command line.
load_dotenv()

# How often the main loop stops draining packets to age out finished flows.
TICK_SECONDS = 1.0

# Bounded so a traffic burst cannot grow the backlog until the process dies.
# ~60k packets is a few seconds of a saturated link; past that, dropping is the
# right answer, and the drop count is reported rather than hidden.
PACKET_QUEUE_SIZE = 60_000

# Seconds between the "still alive" status lines.
STATUS_INTERVAL_SECONDS = 30.0


class AgentStats:
    """Counters for the periodic status line and the shutdown summary."""

    def __init__(self) -> None:
        self.packets_dropped = 0
        self.flows_closed = 0
        self.flows_skipped_small = 0

    def note_drop(self) -> None:
        self.packets_dropped += 1


def report_flows(flows, sender: FlowSender, stats: AgentStats,
                 min_packets: int, send_delay: float) -> None:
    """Turn finished flows into features and hand them to the sender."""
    for flow in flows:
        stats.flows_closed += 1

        if not is_reportable(flow, min_packets):
            # A one-packet flow has no duration and no inter-arrival time. The
            # training data had no such rows, so sending one would be guessing.
            stats.flows_skipped_small += 1
            logger.debug(f"Skipped a {flow.packet_count}-packet flow: {flow}")
            continue

        try:
            features = compute_flow_features(flow)
        except (ArithmeticError, ValueError) as exc:
            # One unusable flow must never stop the agent.
            logger.warning(f"Could not compute features for {flow}: {exc}")
            continue

        sender.send(flow.src_ip, features)

        if send_delay > 0:
            # Optional pacing so the dashboard's live feed updates visibly
            # during a demo instead of everything landing at once.
            time.sleep(send_delay)


def log_status(table: FlowTable, stats: AgentStats, sender: FlowSender) -> None:
    """One line of useful metadata. No packet contents, no keys."""
    logger.info(
        f"status: packets={table.packets_seen} dropped={stats.packets_dropped} "
        f"active_flows={table.active_flow_count} closed={stats.flows_closed} "
        f"sent={sender.sent} rejected={sender.rejected} failed={sender.failed}"
    )


def run_live(args, sender: FlowSender) -> int:
    """Capture from a live interface until Ctrl+C."""
    packet_queue: queue.Queue = queue.Queue(maxsize=PACKET_QUEUE_SIZE)
    stop_event = threading.Event()
    stats = AgentStats()
    table = FlowTable(idle_timeout=args.idle_timeout, max_duration=args.max_duration)

    # The sniffer runs on its own thread because scapy's sniff() blocks. Any
    # capture error is stashed here so the main loop can report it and exit
    # instead of spinning against a thread that has already died.
    capture_error: list[CaptureError] = []

    def capture_worker() -> None:
        try:
            capture.sniff_live(
                packet_queue,
                interface=args.iface,
                bpf_filter=args.bpf,
                stop_event=stop_event,
                on_drop=stats.note_drop,
            )
        except CaptureError as exc:
            capture_error.append(exc)
        finally:
            stop_event.set()

    capture_thread = threading.Thread(target=capture_worker, name="capture", daemon=True)
    capture_thread.start()

    logger.info(
        f"Capturing on {args.iface or 'the default interface'} "
        f"(filter: {args.bpf!r}); press Ctrl+C to stop"
    )
    last_status = time.monotonic()

    try:
        while not stop_event.is_set():
            # Drain packets for one tick, then age out whatever finished.
            deadline = time.monotonic() + TICK_SECONDS
            while True:
                remaining = deadline - time.monotonic()
                if remaining <= 0:
                    break
                try:
                    record = packet_queue.get(timeout=min(remaining, 0.2))
                except queue.Empty:
                    continue
                table.add_packet(record)

            report_flows(table.collect_finished(time.time()), sender, stats,
                         args.min_packets, args.send_delay)

            if time.monotonic() - last_status >= STATUS_INTERVAL_SECONDS:
                log_status(table, stats, sender)
                last_status = time.monotonic()
    except KeyboardInterrupt:
        logger.info("Stopping (Ctrl+C)")
    finally:
        stop_event.set()

    if capture_error:
        logger.error(str(capture_error[0]))
        return 1

    # Report the flows still open at shutdown so nothing captured is thrown away.
    report_flows(table.flush(), sender, stats, args.min_packets, args.send_delay)
    log_summary(table, stats, sender)
    return 0


def run_pcap(args, sender: FlowSender) -> int:
    """Replay a capture file through the exact same aggregation and feature path.

    Flows are aged against the timestamps inside the file rather than the wall
    clock, so a five-minute capture replays correctly in a few seconds and
    produces the same features it would have produced live.
    """
    stats = AgentStats()
    table = FlowTable(idle_timeout=args.idle_timeout, max_duration=args.max_duration)

    logger.info(f"Replaying packets from {args.pcap}")
    last_expiry_time = None

    for record in capture.read_pcap(args.pcap):
        table.add_packet(record)

        if last_expiry_time is None:
            last_expiry_time = record.timestamp
        # Ageing on every packet would be O(open flows) per packet; once per
        # second of capture time is plenty and keeps large files fast.
        elif record.timestamp - last_expiry_time >= 1.0:
            report_flows(table.collect_finished(record.timestamp), sender, stats,
                         args.min_packets, args.send_delay)
            last_expiry_time = record.timestamp

    report_flows(table.flush(), sender, stats, args.min_packets, args.send_delay)
    log_summary(table, stats, sender)
    return 0


def log_summary(table: FlowTable, stats: AgentStats, sender: FlowSender) -> None:
    logger.info(
        f"Summary: {table.packets_seen} packet(s) captured, "
        f"{stats.packets_dropped} dropped, {stats.flows_closed} flow(s) closed, "
        f"{stats.flows_skipped_small} too small to report, "
        f"{table.flows_evicted} evicted (table full)"
    )
    logger.info(
        f"Backend: {sender.sent} sent, {sender.rejected} rejected before sending, "
        f"{sender.failed} failed"
    )


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="Sentinel AI capture agent: sniff traffic, build flows, "
                    "send features to the backend.",
        formatter_class=argparse.ArgumentDefaultsHelpFormatter,
    )

    source = parser.add_argument_group("capture source")
    source.add_argument("--iface", default=os.getenv("SENTINEL_CAPTURE_IFACE") or None,
                        help="Interface to sniff, e.g. \"Wi-Fi\" or \"eth0\". "
                             "Defaults to scapy's default interface.")
    source.add_argument("--pcap", default=None,
                        help="Replay a .pcap/.pcapng file instead of capturing live.")
    source.add_argument("--bpf", default="ip",
                        help="BPF capture filter. Use e.g. \"ip and not port 8888\" "
                             "when sniffing loopback, so the agent does not capture "
                             "its own POSTs to the backend.")
    source.add_argument("--list-interfaces", action="store_true",
                        help="Print the available capture interfaces and exit.")

    backend = parser.add_argument_group("backend")
    backend.add_argument("--url", default=os.getenv("SENTINEL_INGEST_URL", DEFAULT_INGEST_URL),
                         help="Backend ingest endpoint.")
    backend.add_argument("--agent-key", default=os.getenv("AGENT_INGEST_KEY", ""),
                         help="X-Agent-Key value. Defaults to AGENT_INGEST_KEY "
                              "from capture-agent/.env; prefer that over the command line.")
    backend.add_argument("--timeout", type=float, default=5.0,
                         help="Seconds to wait for the backend to respond.")
    backend.add_argument("--retries", type=int, default=2,
                         help="Extra attempts after a transport error or 5xx.")
    backend.add_argument("--send-delay", type=float, default=0.0,
                         help="Seconds to pause between POSTs, to pace a demo.")
    backend.add_argument("--dry-run", action="store_true",
                         help="Compute and log flows without contacting the backend. "
                              "No agent key needed.")

    flows = parser.add_argument_group("flow aggregation")
    flows.add_argument("--idle-timeout", type=float, default=DEFAULT_IDLE_TIMEOUT,
                       help="Close a flow after this many seconds of silence.")
    flows.add_argument("--max-duration", type=float, default=DEFAULT_MAX_DURATION,
                       help="Close a flow once it has been open this long.")
    flows.add_argument("--min-packets", type=int, default=MIN_PACKETS_PER_FLOW,
                       help="Skip flows with fewer packets than this.")

    parser.add_argument("--verbose", action="store_true",
                        help="Log every skipped flow and retry (debug level).")
    return parser


def main() -> int:
    args = build_parser().parse_args()

    if args.verbose:
        logging.getLogger().setLevel(logging.DEBUG)

    if args.list_interfaces:
        try:
            print(capture.describe_interfaces())
        except CaptureError as exc:
            logger.error(str(exc))
            return 1
        return 0

    # Refuse to start on a feature mismatch: wrong features produce confident
    # nonsense, which is worse than not running at all.
    try:
        verify_feature_sync()
    except FeatureSyncError as exc:
        logger.error(str(exc))
        return 1

    if args.min_packets < MIN_PACKETS_PER_FLOW:
        logger.warning(
            f"--min-packets {args.min_packets} is below {MIN_PACKETS_PER_FLOW}; "
            f"flows that short have no duration or inter-arrival time and were "
            f"not part of the model's training data."
        )

    try:
        sender = FlowSender(
            url=args.url,
            agent_key=args.agent_key,
            timeout=args.timeout,
            max_retries=args.retries,
            dry_run=args.dry_run,
        )
    except (RuntimeError, ValueError) as exc:
        logger.error(str(exc))
        return 1

    if not args.dry_run:
        logger.info(f"Sending flows to {args.url}")

    try:
        if args.pcap:
            return run_pcap(args, sender)
        return run_live(args, sender)
    except CaptureError as exc:
        logger.error(str(exc))
        return 1


if __name__ == "__main__":
    sys.exit(main())
