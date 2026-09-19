"""Flow aggregation — groups individual packets into bidirectional flows.

Why 5-tuple flows and not "every packet from one IP inside a time window":
the model was trained on CICIDS2017, whose rows were produced by CICFlowMeter,
one row per bidirectional flow. Half of the feature set (Total Fwd Packets,
Total Backward Packets, Total Length of Fwd/Bwd Packets) only carries meaning
if both directions of the same conversation are tracked together, so this
module reproduces that same flow definition:

    key      = (protocol, {ip, port}, {ip, port})   - direction-independent
    forward  = the direction of the FIRST packet seen for that key
    src_ip   = the initiator of the flow, reported to the backend as the source

A flow is closed and handed on for feature extraction when any of these happen:

    idle timeout   no packet seen for `idle_timeout` seconds
    duration cap   the flow has been open for `max_duration` seconds
    TCP teardown   an RST was seen, or a FIN was seen in both directions

Everything here is plain in-memory state with no side effects: packets go in,
finished Flow objects come out.
"""

import math

from capture import PacketRecord

# A flow with no traffic for this long is considered over. 15s is short enough
# that a demo does not sit waiting, and long enough that an ordinary HTTP
# keep-alive connection is not chopped into fragments.
DEFAULT_IDLE_TIMEOUT = 15.0

# Hard cap so a long-lived connection (SSH session, video stream) still reports
# something instead of staying open forever. Matches CICFlowMeter's 120s.
DEFAULT_MAX_DURATION = 120.0

# Upper bound on tracked flows. A port scan can create thousands of one-packet
# flows per second, so without this the table is an unbounded memory leak.
DEFAULT_MAX_ACTIVE_FLOWS = 20_000


class RunningStats:
    """Streaming count / mean / sample standard deviation / min / max.

    Values are folded in one at a time rather than kept in a list, so a flow
    carrying a million packets costs the same memory as one carrying ten.

    Welford's algorithm is used for the variance because the naive
    sum-of-squares formula loses significant precision on the large microsecond
    magnitudes used for inter-arrival times.
    """

    __slots__ = ("count", "_mean", "_sum_squares", "_min", "_max")

    def __init__(self) -> None:
        self.count = 0
        self._mean = 0.0
        self._sum_squares = 0.0
        self._min = 0.0
        self._max = 0.0

    def add(self, value: float) -> None:
        value = float(value)
        self.count += 1
        delta = value - self._mean
        self._mean += delta / self.count
        self._sum_squares += delta * (value - self._mean)
        if self.count == 1:
            self._min = value
            self._max = value
        else:
            self._min = min(self._min, value)
            self._max = max(self._max, value)

    @property
    def mean(self) -> float:
        return self._mean if self.count else 0.0

    @property
    def std(self) -> float:
        """Sample standard deviation (n-1 divisor).

        CICFlowMeter uses Apache Commons SummaryStatistics, which is also the
        sample deviation, so this matches how the training values were produced.
        A single observation has no spread, so it reports 0.0.
        """
        if self.count < 2:
            return 0.0
        return math.sqrt(self._sum_squares / (self.count - 1))

    @property
    def minimum(self) -> float:
        return self._min if self.count else 0.0

    @property
    def maximum(self) -> float:
        return self._max if self.count else 0.0


class Flow:
    """One bidirectional conversation, accumulated packet by packet."""

    __slots__ = (
        "key", "protocol", "src_ip", "dst_ip", "src_port", "dst_port",
        "start_time", "last_time", "fwd_packets", "bwd_packets",
        "fwd_payload_bytes", "bwd_payload_bytes", "packet_lengths",
        "inter_arrival_times", "flag_counts", "end_reason",
        "_fin_forward", "_fin_backward", "_reset",
    )

    def __init__(self, key: tuple, record: PacketRecord) -> None:
        self.key = key
        self.protocol = record.protocol
        # The first packet defines the forward direction, so its source is the
        # flow's source for the rest of the flow's life.
        self.src_ip = record.src_ip
        self.dst_ip = record.dst_ip
        self.src_port = record.src_port
        self.dst_port = record.dst_port

        self.start_time = record.timestamp
        self.last_time = record.timestamp

        self.fwd_packets = 0
        self.bwd_packets = 0
        self.fwd_payload_bytes = 0
        self.bwd_payload_bytes = 0

        # Both cover the whole flow, in either direction, exactly as
        # CICFlowMeter's flow-level length and IAT statistics do.
        self.packet_lengths = RunningStats()
        self.inter_arrival_times = RunningStats()   # microseconds

        # Flag counts are per flow, not per direction - again matching the
        # dataset columns ("SYN Flag Count" and friends).
        self.flag_counts = {"SYN": 0, "ACK": 0, "RST": 0, "FIN": 0, "PSH": 0}

        self._fin_forward = False
        self._fin_backward = False
        self._reset = False

        # Set when the flow is closed; carried into the logs so it is obvious
        # why a given flow was reported when it was.
        self.end_reason = ""

    @property
    def packet_count(self) -> int:
        return self.fwd_packets + self.bwd_packets

    @property
    def duration_seconds(self) -> float:
        return self.last_time - self.start_time

    def is_forward(self, record: PacketRecord) -> bool:
        """True if this packet travels the same way as the flow's first packet."""
        return record.src_ip == self.src_ip and record.src_port == self.src_port

    def add(self, record: PacketRecord) -> None:
        """Fold one packet into this flow's running totals."""
        # The very first packet has no predecessor, so it contributes no IAT.
        if self.packet_count:
            # Captures can deliver packets slightly out of order; a negative gap
            # is meaningless, so it is clamped rather than left to skew the mean.
            gap_seconds = max(record.timestamp - self.last_time, 0.0)
            self.inter_arrival_times.add(gap_seconds * 1_000_000.0)

        if self.is_forward(record):
            self.fwd_packets += 1
            self.fwd_payload_bytes += record.payload_bytes
            fin_is_forward = True
        else:
            self.bwd_packets += 1
            self.bwd_payload_bytes += record.payload_bytes
            fin_is_forward = False

        self.packet_lengths.add(record.payload_bytes)
        self.last_time = max(self.last_time, record.timestamp)

        # scapy renders TCP flags as letters: F S R P A U E C. The five the
        # feature set needs have distinct letters, so a substring test is safe.
        flags = record.flags
        if flags:
            if "S" in flags:
                self.flag_counts["SYN"] += 1
            if "A" in flags:
                self.flag_counts["ACK"] += 1
            if "R" in flags:
                self.flag_counts["RST"] += 1
            if "F" in flags:
                self.flag_counts["FIN"] += 1
            if "P" in flags:
                self.flag_counts["PSH"] += 1

            if "R" in flags:
                self._reset = True
            if "F" in flags:
                if fin_is_forward:
                    self._fin_forward = True
                else:
                    self._fin_backward = True

    def is_torn_down(self) -> bool:
        """True once TCP says the conversation is over (RST, or FIN both ways)."""
        return self._reset or (self._fin_forward and self._fin_backward)

    def __repr__(self) -> str:
        return (
            f"Flow({self.src_ip}:{self.src_port} -> {self.dst_ip}:{self.dst_port} "
            f"proto={self.protocol} packets={self.packet_count} reason={self.end_reason})"
        )


def flow_key(record: PacketRecord) -> tuple:
    """Build a direction-independent key so both halves of a conversation match.

    The two endpoints are sorted, which means A->B and B->A produce the same
    key. The flow itself still remembers which side spoke first.
    """
    endpoint_a = (record.src_ip, record.src_port)
    endpoint_b = (record.dst_ip, record.dst_port)
    if endpoint_a <= endpoint_b:
        return (record.protocol, endpoint_a, endpoint_b)
    return (record.protocol, endpoint_b, endpoint_a)


class FlowTable:
    """Holds the currently open flows and hands back the ones that have finished."""

    def __init__(self, idle_timeout: float = DEFAULT_IDLE_TIMEOUT,
                 max_duration: float = DEFAULT_MAX_DURATION,
                 max_active_flows: int = DEFAULT_MAX_ACTIVE_FLOWS) -> None:
        self.idle_timeout = idle_timeout
        self.max_duration = max_duration
        self.max_active_flows = max_active_flows

        self._flows: dict[tuple, Flow] = {}
        self._finished: list[Flow] = []

        # Counters for the periodic status line; useful metadata only.
        self.packets_seen = 0
        self.flows_evicted = 0

    @property
    def active_flow_count(self) -> int:
        return len(self._flows)

    def add_packet(self, record: PacketRecord) -> None:
        """Route one packet into its flow, creating or closing flows as needed."""
        self.packets_seen += 1
        key = flow_key(record)
        flow = self._flows.get(key)

        if flow is None:
            if len(self._flows) >= self.max_active_flows:
                self._evict_least_recent()
            flow = Flow(key, record)
            self._flows[key] = flow

        flow.add(record)

        if flow.is_torn_down():
            self._close(key, "tcp_teardown")
        elif flow.duration_seconds >= self.max_duration:
            self._close(key, "duration_cap")

    def collect_finished(self, now: float) -> list[Flow]:
        """Close any flow that has gone idle, then return every finished flow.

        `now` is a wall-clock timestamp for live capture, or the timestamp of
        the most recent packet when replaying a file, so both modes age flows
        against the same clock the packets came from.
        """
        for key, flow in list(self._flows.items()):
            if now - flow.last_time >= self.idle_timeout:
                self._close(key, "idle_timeout")

        finished, self._finished = self._finished, []
        return finished

    def flush(self) -> list[Flow]:
        """Close every remaining flow. Called once at shutdown or end of file."""
        for key in list(self._flows):
            self._close(key, "shutdown")
        finished, self._finished = self._finished, []
        return finished

    def _close(self, key: tuple, reason: str) -> None:
        flow = self._flows.pop(key, None)
        if flow is None:
            return
        flow.end_reason = reason
        self._finished.append(flow)

    def _evict_least_recent(self) -> None:
        """Make room by closing the flow that has been quiet the longest.

        Reporting a slightly early flow is far better than growing the table
        until the process runs out of memory, which is what a fast port scan
        would otherwise cause.
        """
        oldest_key = min(self._flows, key=lambda k: self._flows[k].last_time)
        self.flows_evicted += 1
        self._close(oldest_key, "table_full")
