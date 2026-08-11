Here's the list of attacks your system can realistically detect, organized by feasibility for a college project — with what signals catch each one.

## Tier 1 — Definitely include (well-supported by datasets, clear signals, easy to demo)

### 1. **DoS / DDoS (Denial of Service)**
- **What it is:** Attacker floods a target with traffic to overwhelm it and make it unavailable
- **Detected via:** Sudden spike in packets/sec, bytes/sec from one or many sources to one destination
- **Dataset support:** Excellent (CICIDS2017 has dedicated DoS Hulk, DoS GoldenEye, DoS Slowloris, DoS Slowhttptest subtypes)
- **Demo-friendly:** Yes — easy to simulate with tools like `hping3` on your own test network

### 2. **Port Scanning**
- **What it is:** Attacker probes multiple ports on a target to find open/vulnerable services (reconnaissance phase, usually before a real attack)
- **Detected via:** One source IP contacting many unique destination ports in a short time window
- **Dataset support:** Excellent (CICIDS2017 has a `PortScan` label)
- **Demo-friendly:** Yes — easy to simulate with `nmap`

### 3. **Brute Force Attacks**
- **What it is:** Repeated login attempts (SSH, FTP, RDP, web login) trying different password combinations
- **Detected via:** High frequency of connections to the same port (22, 21, 3389), many failed handshakes/short-lived connections from one source
- **Dataset support:** Good (CICIDS2017 has `FTP-Patator`, `SSH-Patator`)
- **Demo-friendly:** Yes — simulate with Hydra or Patator on a test SSH server

### 4. **Botnet Traffic**
- **What it is:** Compromised devices communicating with a command-and-control (C2) server, often as part of a larger botnet
- **Detected via:** Regular, periodic connection patterns (beaconing) — very low variance in timing, unlike human traffic
- **Dataset support:** Good (CICIDS2017 has a `Bot` label)
- **Demo-friendly:** Harder — usually needs simulated C2 traffic

## Tier 2 — Good to include if time permits

### 5. **Web Attacks (SQL Injection, XSS, Brute Force on web login)**
- **What it is:** Attacks targeting a web application specifically
- **Detected via:** Requires **application-layer inspection** (HTTP payload), not just flow features — this is more complex
- **Dataset support:** CICIDS2017 has `Web Attack – Brute Force`, `Web Attack – XSS`, `Web Attack – SQL Injection` labels
- **Caveat:** True SQLi/XSS detection from encrypted HTTPS traffic isn't feasible without a proxy/WAF layer — realistically you'd detect this at the **web server log level**, not raw packets. Worth mentioning as **future scope** rather than fully building.

### 6. **Infiltration / Lateral Movement**
- **What it is:** Once inside the network, attacker moves between machines to escalate access
- **Detected via:** Unusual internal-to-internal traffic patterns, privilege escalation attempts
- **Dataset support:** CICIDS2017 has an `Infiltration` label (very few samples though — hard to train well)
- **Demo-friendly:** Difficult to simulate convincingly

### 7. **Data Exfiltration**
- **What it is:** Large volumes of data being sent out of the network to an external destination
- **Detected via:** Abnormally large outbound byte counts, unusual destination IP (not typical business traffic)
- **Dataset support:** Not a standalone CICIDS2017 label — you'd build a custom rule/threshold for this rather than train a dedicated classifier
- **Demo-friendly:** Easy to simulate (just transfer a large file to an external "attacker" machine during demo)

## Tier 3 — Mention as future scope only (too complex/unreliable for demo)

### 8. **APT (Advanced Persistent Threat) / Multi-stage attacks**
- Requires long-term behavioral baselining — out of scope for a semester project
### 9. **Zero-day exploits**
- By definition, unknown signature — would need anomaly detection (Isolation Forest/Autoencoder) rather than supervised classification, and results are unreliable/hard to validate for a demo
### 10. **Malware/Ransomware traffic**
- Needs payload/file-level analysis, not just network flow — different problem domain entirely

---

## My recommendation for your project scope

**Core detection set (train your model on these 4–5 classes + Benign):**
1. Benign (normal traffic)
2. DDoS/DoS
3. Port Scan
4. Brute Force
5. Botnet (if time allows)

This gives you a clean **multi-class classification problem**, all well-represented in CICIDS2017, all easy to demo live (nmap, hping3, Hydra are simple to run safely in a controlled test environment), and it maps cleanly to your Correlation Engine example (Port Scan → Brute Force → Privilege Escalation) from earlier.

Data exfiltration and Web attacks can be mentioned as "extended detection capabilities" in your report, partially rule-based rather than ML-based, without needing a fully trained classifier.

---

Want me to help you plan **how to safely simulate these attacks** for your demo (tools + a safe isolated setup), or move on to designing the **ML training pipeline** (feature selection → model choice → evaluation metrics)?