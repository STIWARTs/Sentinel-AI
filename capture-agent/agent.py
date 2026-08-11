"""Entry point for the live capture agent."""

from capture import sniff_packets


def main() -> None:
    sniff_packets()


if __name__ == "__main__":
    main()
