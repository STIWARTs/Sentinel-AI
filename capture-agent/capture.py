"""Packet capture — turns raw frames into flat, easy-to-reason-about records.

Two sources are supported, and both produce identical PacketRecord objects so
nothing downstream can tell them apart:

  sniff_live()  live capture from a network interface. Needs Npcap on Windows
                and root/sudo on Linux and macOS.
  read_pcap()   replay a .pcap/.pcapng file — used for repeatable testing and
                as an offline demo path when live capture is not available.

Only IPv4 is handled, because CICIDS2017 (what the model was trained on) is
IPv4-only. Anything else is ignored rather than guessed at.

scapy is imported lazily inside _load_scapy() so that --help, --dry-run and the
offline self-test all work on a machine where scapy is not installed.
"""

import logging
import queue
from dataclasses import dataclass

logger = logging.getLogger(__name__)

# IP protocol numbers, kept here so the aggregator and features code can refer
# to them by name instead of by magic number.
PROTO_ICMP = 1
PROTO_TCP = 6
PROTO_UDP = 17

_PERMISSION_HINT = (
    "Raw packet capture was denied. "
    "On Windows install Npcap (https://npcap.com) with 'WinPcap API-compatible mode' "
    "and run this terminal as Administrator. On Linux/macOS run the agent with sudo."
)


class CaptureError(RuntimeError):
    """Raised for any capture problem the user can actually act on."""


@dataclass(slots=True)
class PacketRecord:
    """One captured packet, reduced to only the fields the feature set needs."""

    timestamp: float      # seconds since epoch, taken from the capture layer
    src_ip: str
    dst_ip: str
    src_port: int         # 0 for protocols without ports (ICMP)
    dst_port: int
    protocol: int         # IP protocol number: 6=TCP, 17=UDP, 1=ICMP
    payload_bytes: int    # transport payload size, excluding all headers
    flags: str            # TCP flag letters, e.g. "S", "SA", "PA"; "" for non-TCP


# Populated on first use by _load_scapy(); module-level so the import cost and
# the "is scapy installed?" check happen exactly once.
_scapy = None


def _load_scapy():
    """Import scapy on first use, turning a missing install into a clear message."""
    global _scapy
    if _scapy is None:
        try:
            from scapy import all as scapy_all
        except ImportError as exc:
            raise CaptureError(
                "scapy is not installed. From capture-agent/ run: "
                "pip install -r requirements.txt"
            ) from exc
        _scapy = scapy_all
    return _scapy


def _packet_to_record(packet, s) -> PacketRecord | None:
    """Convert one scapy packet into a PacketRecord, or None if it is not IPv4.

    payload_bytes deliberately excludes every header. CICFlowMeter — the tool
    that produced the CICIDS2017 rows the model learned from — measures packet
    length as transport payload bytes, which is why so many dataset rows have
    'Min Packet Length' = 0 (a bare ACK carries no payload). Computing it the
    same way here is what keeps live values inside the distribution the model
    was trained on.
    """
    if s.IP not in packet:
        return None

    ip = packet[s.IP]
    header_bytes = ip.ihl * 4
    # ip.len is 0 when the NIC does segmentation offload, so fall back to the
    # number of bytes scapy actually captured for the IP layer.
    total_bytes = ip.len or len(ip)

    src_port = 0
    dst_port = 0
    flags = ""

    if s.TCP in packet:
        tcp = packet[s.TCP]
        src_port = int(tcp.sport)
        dst_port = int(tcp.dport)
        flags = str(tcp.flags)
        payload_bytes = total_bytes - header_bytes - (tcp.dataofs * 4)
    elif s.UDP in packet:
        udp = packet[s.UDP]
        src_port = int(udp.sport)
        dst_port = int(udp.dport)
        # udp.len covers the 8-byte UDP header plus the payload.
        payload_bytes = int(udp.len) - 8
    else:
        payload_bytes = total_bytes - header_bytes

    return PacketRecord(
        timestamp=float(packet.time),
        src_ip=str(ip.src),
        dst_ip=str(ip.dst),
        src_port=src_port,
        dst_port=dst_port,
        protocol=int(ip.proto),
        # Malformed or truncated headers can make the arithmetic go negative.
        payload_bytes=max(int(payload_bytes), 0),
        flags=flags,
    )


def describe_interfaces() -> str:
    """Return a human-readable list of capture interfaces for --list-interfaces."""
    s = _load_scapy()
    return f"Scapy default interface: {s.conf.iface}\n\n{s.conf.ifaces}"


def sniff_live(packet_queue: queue.Queue, interface=None, bpf_filter="ip",
               stop_event=None, on_drop=None) -> None:
    """Capture packets from `interface` and push PacketRecords onto `packet_queue`.

    Blocks until stop_event is set, so callers run this on a background thread.

    store=False keeps scapy from holding every packet in memory — without it a
    long run grows until the process is killed. The queue is bounded for the
    same reason: if capture outruns the aggregation loop, new packets are
    dropped and counted via on_drop instead of letting the backlog grow.
    """
    s = _load_scapy()

    def handle(packet) -> None:
        try:
            record = _packet_to_record(packet, s)
        except Exception as exc:  # a malformed frame must never kill the sniffer
            logger.debug(f"Skipped an unparseable packet: {type(exc).__name__}")
            return
        if record is None:
            return
        try:
            packet_queue.put_nowait(record)
        except queue.Full:
            if on_drop is not None:
                on_drop()

    should_stop = (lambda _packet: stop_event.is_set()) if stop_event is not None else None

    try:
        s.sniff(iface=interface, filter=bpf_filter, prn=handle, store=False,
                stop_filter=should_stop)
    except PermissionError as exc:
        raise CaptureError(_PERMISSION_HINT) from exc
    except (OSError, s.Scapy_Exception) as exc:
        raise CaptureError(
            f"Could not capture on interface {interface or '(default)'!r}: {exc}. "
            f"Run with --list-interfaces to see the available names. {_PERMISSION_HINT}"
        ) from exc


def read_pcap(path: str):
    """Yield PacketRecords from a .pcap/.pcapng file, streaming one at a time."""
    s = _load_scapy()
    try:
        with s.PcapReader(path) as reader:
            for packet in reader:
                try:
                    record = _packet_to_record(packet, s)
                except Exception as exc:
                    logger.debug(f"Skipped an unparseable packet: {type(exc).__name__}")
                    continue
                if record is not None:
                    yield record
    except FileNotFoundError as exc:
        raise CaptureError(f"Capture file not found: {path}") from exc
    except (OSError, s.Scapy_Exception) as exc:
        raise CaptureError(f"Could not read capture file {path}: {exc}") from exc
