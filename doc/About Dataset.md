## If you're using a pre-built dataset (CICIDS2017 / NSL-KDD) — what to check in their docs

These datasets come with 70–80+ columns, but you don't need all of them. Here's what to look for and include:

### Must-include (core identification)
- [ ] `Flow ID` / Source IP / Destination IP
- [ ] `Source Port` / `Destination Port`
- [ ] `Protocol`
- [ ] `Timestamp`
- [ ] `Label` (this is the ground truth column — tells you if it's BENIGN, DDoS, PortScan, etc. — **critical for training**)

### Must-include (traffic volume/rate — catches DoS/DDoS)
- [ ] `Flow Duration`
- [ ] `Total Fwd Packets` / `Total Backward Packets`
- [ ] `Total Length of Fwd Packets` / `Total Length of Bwd Packets`
- [ ] `Flow Bytes/s`
- [ ] `Flow Packets/s`

### Must-include (timing patterns — catches bots/scripted attacks)
- [ ] `Flow IAT Mean` / `Flow IAT Std` / `Flow IAT Max` / `Flow IAT Min` (IAT = Inter-Arrival Time)
- [ ] `Fwd IAT Mean` / `Bwd IAT Mean`

### Must-include (TCP flags — catches SYN floods, scans)
- [ ] `SYN Flag Count`
- [ ] `ACK Flag Count`
- [ ] `RST Flag Count`
- [ ] `FIN Flag Count`
- [ ] `PSH Flag Count`

### Useful (packet size stats — catches abnormal traffic shapes)
- [ ] `Packet Length Mean` / `Packet Length Std`
- [ ] `Min Packet Length` / `Max Packet Length`
- [ ] `Average Packet Size`

### Skip/ignore for your scope
- ❌ Bulk rate features (`Fwd Avg Bulk Rate`, etc.) — too granular, minimal added value
- ❌ Active/Idle time features — nice-to-have, not essential
- ❌ Subflow features — redundant with flow-level features
- ❌ Header length breakdowns — low signal for your attack types

**Rule of thumb:** Start with ~15–20 features from the four "must-include" categories above. That's enough to train a solid Random Forest/XGBoost model with good accuracy, and it keeps your feature engineering (for the live agent) manageable.

## If you're documenting your OWN capture schema (for your project report / design doc)

Here's a clean table you can literally paste into your report as "Data Fields Captured":

| Category | Field | Purpose |
|---|---|---|
| Identification | Source IP, Destination IP | Identify attacker/victim |
| Identification | Source Port, Destination Port | Identify targeted service |
| Identification | Protocol (TCP/UDP/ICMP) | Classify traffic type |
| Identification | Timestamp | Time-based correlation |
| Volume | Packets/sec, Bytes/sec | Detect flooding (DoS/DDoS) |
| Volume | Total bytes transferred | Detect data exfiltration |
| Behavior | Unique destination ports per source IP | Detect port scanning |
| Behavior | SYN count without matching ACK | Detect brute force/half-open scans |
| Behavior | Flow duration | Detect short-burst vs sustained attacks |
| Timing | Inter-arrival time (mean/std) | Detect bot/scripted (regular) vs human (irregular) traffic |
| TCP Flags | SYN, ACK, RST, FIN, PSH counts | Detect flag-based attacks (SYN flood, RST scan) |

## Mapping: which fields catch which attack (good for your "methodology" section)

| Attack Type | Key Fields Used |
|---|---|
| DDoS/DoS | Packets/sec, Bytes/sec, Flow duration, SYN count |
| Port Scan | Unique ports per source, SYN without ACK, short flow duration |
| Brute Force | Repeated connections to same dst port, failed login rate (app-layer, optional) |
| Data Exfiltration | Total bytes (outbound), flow duration, unusual destination |
| Botnet Traffic | Inter-arrival time regularity, packet size uniformity |

---
