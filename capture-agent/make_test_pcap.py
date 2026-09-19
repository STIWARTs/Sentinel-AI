"""Build a synthetic capture file for testing the agent without live traffic.

Live capture needs Npcap (Windows) or sudo (Linux/macOS). This script needs
neither: it writes a .pcap containing benign browsing, a port scan and repeated
short login attempts, which `agent.py --pcap` then replays through the exact
same aggregation and feature code a live run would use.

    python make_test_pcap.py test.pcap
    python agent.py --pcap test.pcap --dry-run

Note on expectations: the traffic here is shaped like the real thing, but the
model still decides what it is. Do not read a BENIGN verdict on the scan flows
as an agent fault - check the computed features first.
"""

import argparse

from scapy.all import IP, TCP, Ether, wrpcap

ATTACKER = "192.168.1.77"
VICTIM = "192.168.1.50"
CLIENT = "192.168.1.20"
WEB = "93.184.216.34"

# Fixed start time so two runs of this script produce identical features.
START_TIME = 1_700_000_000.0


class Builder:
    """Collects packets on a virtual clock that only ever moves forward."""

    def __init__(self) -> None:
        self.packets = []
        self.clock = START_TIME

    def emit(self, src, dst, sport, dport, flags, payload_len, gap) -> None:
        self.clock += gap
        packet = Ether() / IP(src=src, dst=dst) / TCP(sport=sport, dport=dport, flags=flags)
        if payload_len:
            packet = packet / (b"x" * payload_len)
        packet.time = self.clock
        self.packets.append(packet)


def add_benign_browsing(builder: Builder, sessions: int = 3) -> None:
    """Ordinary HTTPS conversations: handshake, a few exchanges, clean teardown."""
    for index in range(sessions):
        port = 40000 + index
        builder.emit(CLIENT, WEB, port, 443, "S", 0, 0.01)
        builder.emit(WEB, CLIENT, 443, port, "SA", 0, 0.03)
        builder.emit(CLIENT, WEB, port, 443, "A", 0, 0.001)
        for _ in range(6):
            builder.emit(CLIENT, WEB, port, 443, "PA", 512, 0.02)
            builder.emit(WEB, CLIENT, 443, port, "PA", 1400, 0.04)
            builder.emit(CLIENT, WEB, port, 443, "A", 0, 0.005)
        builder.emit(CLIENT, WEB, port, 443, "FA", 0, 0.05)
        builder.emit(WEB, CLIENT, 443, port, "FA", 0, 0.02)


def add_port_scan(builder: Builder, ports: int = 120) -> None:
    """A SYN scan against closed ports: SYN out, RST back, one flow per port."""
    for index in range(ports):
        builder.emit(ATTACKER, VICTIM, 50000 + index, 20 + index, "S", 0, 0.0004)
        builder.emit(VICTIM, ATTACKER, 20 + index, 50000 + index, "RA", 0, 0.0002)


def add_brute_force(builder: Builder, attempts: int = 25) -> None:
    """Repeated short SSH sessions from one source, the shape of a login guess loop."""
    for index in range(attempts):
        port = 60000 + index
        builder.emit(ATTACKER, VICTIM, port, 22, "S", 0, 0.15)
        builder.emit(VICTIM, ATTACKER, 22, port, "SA", 0, 0.002)
        builder.emit(ATTACKER, VICTIM, port, 22, "A", 0, 0.001)
        builder.emit(ATTACKER, VICTIM, port, 22, "PA", 48, 0.02)
        builder.emit(VICTIM, ATTACKER, 22, port, "PA", 64, 0.03)
        builder.emit(ATTACKER, VICTIM, port, 22, "PA", 120, 0.05)
        builder.emit(VICTIM, ATTACKER, 22, port, "PA", 32, 0.04)
        builder.emit(ATTACKER, VICTIM, port, 22, "FA", 0, 0.01)
        builder.emit(VICTIM, ATTACKER, 22, port, "FA", 0, 0.005)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__,
                                     formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("output", nargs="?", default="test.pcap",
                        help="Path to write the capture file to")
    args = parser.parse_args()

    builder = Builder()
    add_benign_browsing(builder)
    add_port_scan(builder)
    add_brute_force(builder)

    wrpcap(args.output, builder.packets)
    print(f"Wrote {len(builder.packets)} packets to {args.output}")
    print(f"  benign browsing from {CLIENT}")
    print(f"  port scan and login attempts from {ATTACKER} against {VICTIM}")
    print(f"\nNext: python agent.py --pcap {args.output} --dry-run")


if __name__ == "__main__":
    main()
