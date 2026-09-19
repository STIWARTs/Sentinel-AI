# Capture Agent

The live half of Sentinel AI. It sniffs network traffic, groups packets into
bidirectional flows, computes the 20 features the trained model expects, and
POSTs them to the backend's `/api/ingest` endpoint.

```
packets  ->  bounded queue  ->  flow table  ->  feature computation  ->  POST /api/ingest
capture.py                     aggregator.py    features.py             sender.py
                                    orchestrated by agent.py
```

The agent does **no** prediction of its own. It captures, aggregates and
sends; the backend predicts, scores, correlates and stores. That keeps the
model in exactly one place.

| File | Responsibility |
|---|---|
| `agent.py` | CLI entry point, capture thread, main loop, shutdown |
| `capture.py` | scapy sniffing and pcap reading, packet -> `PacketRecord` |
| `aggregator.py` | `PacketRecord` -> bidirectional `Flow`, flow lifetime rules |
| `features.py` | `Flow` -> the 20 model features, plus the feature-sync guard |
| `sender.py` | payload assembly, validation, POST with retries |
| `feature_list.json` | the shared feature contract (training / agent / backend) |
| `test_agent.py` | offline self-test — no network, no root, no scapy needed |
| `make_test_pcap.py` | builds a synthetic capture file, for testing without Npcap |
| `replay.py` | dataset replay demo fallback (separate from the live agent) |

---

## Setup

```powershell
cd capture-agent
pip install -r requirements.txt
copy .env.example .env      # then put the real AGENT_INGEST_KEY in .env
```

`AGENT_INGEST_KEY` in `capture-agent/.env` must be identical to the one in
`backend/.env`, or every flow comes back `401`.

**Live capture needs a packet driver and elevated privileges:**

- **Windows** — install [Npcap](https://npcap.com) with *"WinPcap API-compatible
  mode"* ticked, then run the terminal **as Administrator**.
- **Linux / macOS** — libpcap is usually already there; run the agent with `sudo`.

`--pcap` and `--dry-run` need neither driver nor privileges.

---

## Running it

```powershell
python agent.py --list-interfaces          # find your adapter's name
python agent.py --iface "Wi-Fi"            # capture and send
python agent.py --iface "Wi-Fi" --dry-run  # compute and print, send nothing
python agent.py --pcap ..\captures\scan.pcap --send-delay 0.5
```

Useful options (`--help` lists them all):

| Option | Default | What it does |
|---|---|---|
| `--iface` | scapy's default | Interface to capture on |
| `--pcap` | — | Replay a capture file instead of sniffing live |
| `--url` | `http://localhost:8888/api/ingest` | Backend ingest endpoint |
| `--agent-key` | `AGENT_INGEST_KEY` from `.env` | Prefer the `.env` value |
| `--bpf` | `ip` | Capture filter |
| `--idle-timeout` | `15` | Close a flow after this much silence (seconds) |
| `--max-duration` | `120` | Close a flow once it has been open this long |
| `--min-packets` | `2` | Skip flows shorter than this |
| `--send-delay` | `0` | Pause between POSTs, to pace a live demo |
| `--dry-run` | off | Never contact the backend; no agent key needed |
| `--verbose` | off | Debug logging (skipped flows, retries) |

If you capture on **loopback**, filter out the agent's own traffic or it will
capture its own POSTs to the backend:

```powershell
python agent.py --iface "Loopback" --bpf "ip and not port 8888"
```

---

## The feature contract

The same 20 features, with the same names in the same order, must exist in
three places — this is the project's golden rule:

1. `ml-pipeline/notebooks/output/feature_list.json` (training)
2. `capture-agent/feature_list.json` (this agent)
3. `backend/ml/feature_list.json` (inference)

The agent works in `snake_case` and POSTs `snake_case` keys.
`backend/ml/predictor.py::FEATURE_NAME_MAP` translates them into the CICIDS2017
column names the model was trained on. `AGENT_TO_MODEL` in `features.py` is the
agent-side copy of that mapping.

`agent.py` calls `verify_feature_sync()` before it captures a single packet and
**refuses to start** on any drift, because wrong features produce confident
nonsense rather than an obvious error. `test_agent.py` additionally checks
`AGENT_TO_MODEL` against the backend's `FEATURE_NAME_MAP` and all three copies
of `feature_list.json` against each other.

### How the values are computed

These conventions come from CICFlowMeter, the tool that produced the CICIDS2017
rows the model learned from. Matching them is what keeps live traffic inside
the distribution the model was trained on.

| Convention | Value |
|---|---|
| Flow definition | bidirectional 5-tuple; forward = direction of the first packet |
| `Flow Duration`, `Flow IAT *` | microseconds |
| `Flow Bytes/s`, `Flow Packets/s` | per second |
| Packet length | transport **payload** bytes, headers excluded |
| Standard deviation | sample (n-1) |
| Flag counts | per flow, counting both directions |

A flow is closed and reported when any of these happens:

- **TCP teardown** — an RST, or a FIN in both directions
- **idle timeout** — no packet for `--idle-timeout` seconds
- **duration cap** — open for `--max-duration` seconds
- **shutdown** — Ctrl+C, or end of the pcap file

---

## What the agent refuses to send

"No data" is always better than data the model cannot interpret, so a flow is
dropped (and counted in the summary) when:

- it has fewer than `--min-packets` packets. A single-packet flow has no
  duration and no inter-arrival time; CICFlowMeter recorded those as `Infinity`
  and the training notebook dropped them, so the model has never seen one.
- any feature is missing, non-numeric, negative, `NaN` or `Infinity`.

Failures are handled without taking the agent down:

| Situation | Behaviour |
|---|---|
| Npcap missing / not Administrator / no sudo | one clear message naming the fix, exit 1 |
| Bad interface name | error naming `--list-interfaces`, exit 1 |
| Malformed or truncated packet | skipped, capture continues |
| Backend down, timing out, or 5xx | retried with backoff, then logged and skipped |
| `401` / `403` | key mismatch reported once, no pointless retries |
| `422` | payload rejected — points at the feature map, no retries |
| Capture outrunning the loop | oldest packets dropped, count reported |
| Too many concurrent flows | least-recent flow reported early, count reported |

Logs carry metadata only — counts, IPs, predictions, timings. Never packet
contents, and never the agent key.

---

## Testing

### 1. Offline self-test (no setup at all)

```powershell
python test_agent.py
```

32 checks covering feature sync, every one of the 20 computed values against
hand-worked numbers, flow lifetime rules, table eviction and payload validation.

### 2. Dry run against real traffic

```powershell
python agent.py --iface "Wi-Fi" --dry-run --verbose
```

Browse a few sites and watch flows close. Nothing is sent anywhere.

### 3. End-to-end against the backend

Start Postgres and the backend (see `doc/Demo and Testing Guide.md`), then:

```powershell
python agent.py --iface "Wi-Fi"
```

Each accepted flow logs the backend's verdict:

```
10.0.0.14 -> BENIGN (confidence=1.00, risk=0, severity=Low)
```

### 4. Attack traffic, for the incident demo

Only ever against machines you own. The backend's correlation engine raises an
Incident when it sees `PortScan -> BruteForce` from one source IP inside 15
minutes, so run a scan and then a few failed logins against your own test host:

```powershell
nmap -sS <your-test-vm>                       # PortScan
hydra -l test -P wordlist.txt ssh://<vm>      # BruteForce (or a few failed SSH logins)
```

Then confirm the incident landed:

```powershell
docker exec sentinelai-postgres-1 psql -U sentinel -d sentinel_ai `
  -c "SELECT id, title, severity, mitre_technique FROM incidents ORDER BY id DESC LIMIT 5;"
```

### 5. Repeatable replay of a capture file

Capture once with Wireshark or `tcpdump`, then replay it as often as you like.
Flows are aged against the timestamps inside the file, so the features come out
identical to the live run:

```powershell
python agent.py --pcap ..\captures\portscan.pcap --send-delay 0.3
```

If you have no capture file yet — and no Npcap — generate one. It needs only
scapy, no driver and no privileges, and produces benign browsing plus a port
scan plus repeated login attempts:

```powershell
python make_test_pcap.py test.pcap
python agent.py --pcap test.pcap --dry-run          # features only
python agent.py --pcap test.pcap --send-delay 0.2   # against the backend
```

The traffic is shaped like the real thing, but the **model** still decides what
each flow is. A `BENIGN` verdict on the scan flows is a model/training question,
not an agent fault — check the computed features (`--dry-run --verbose`) before
suspecting the agent.

---

## `agent.py` vs `replay.py`

`replay.py` is the **demo fallback**: it reads recorded CICIDS2017 rows from a
CSV and posts them, skipping capture and feature computation entirely. It is
still useful when no packet driver is available, when you want a guaranteed
attack class on demand, or as a presentation-day safety net.

`agent.py` is the real thing: live packets, real flows, features computed here.
