Here's the complete build flow for the packet capture agent — from raw packet sniffing to sending predictions to your backend. This is written as a build sequence you can follow step by step.

## Architecture of the agent itself

```
┌─────────────────────────────────────────────────┐
│              CAPTURE AGENT (agent.py)             │
│                                                     │
│  Scapy sniff() ──▶ Packet Queue ──▶ Flow Aggregator│
│                                          │          │
│                          Every N seconds ▼          │
│                    Feature Computation Engine       │
│                                          │          │
│                          Load model.pkl │          │
│                                          ▼          │
│                    Model Prediction (local, fast)   │
│                                          │          │
│                    POST to FastAPI backend          │
└─────────────────────────────────────────────────┘
```

You have two design choices for where prediction happens — **agent-side** (agent loads model.pkl itself, predicts locally, sends result to backend) or **backend-side** (agent just sends raw features, backend predicts). I recommend **backend-side prediction** — keeps the agent lightweight/dumb, and centralizes model updates (you only update the model in one place). I'll build the flow around that.

## Step 1: Set up environment & permissions

```bash
pip install scapy requests python-dotenv
```

- **Windows:** Install **Npcap** (npcap.com) — Scapy needs this driver to capture packets. Check "WinPcap API-compatible mode" during install.
- **Linux/Mac:** Scapy uses libpcap (usually pre-installed); you'll need to run the agent with `sudo` since raw packet capture requires elevated privileges.
- Test permissions work: `sudo python3 -c "from scapy.all import sniff; sniff(count=1)"`

## Step 2: Identify the network interface

```python
from scapy.all import get_if_list, conf

print(get_if_list())      # lists all interfaces
print(conf.iface)          # shows Scapy's default interface
```
You'll pick the active Wi-Fi/Ethernet adapter name (e.g. `"Wi-Fi"`, `"eth0"`) to pass into `sniff(iface=...)`.

## Step 3: Build the raw packet capture loop

```python
# capture.py
from scapy.all import sniff, IP, TCP, UDP
import time
import threading
from queue import Queue

packet_queue = Queue()

def process_packet(pkt):
    if IP in pkt:
        entry = {
            "src_ip": pkt[IP].src,
            "dst_ip": pkt[IP].dst,
            "protocol": pkt[IP].proto,   # 6=TCP, 17=UDP, 1=ICMP
            "length": len(pkt),
            "timestamp": time.time(),
            "src_port": None,
            "dst_port": None,
            "flags": None,
        }
        if TCP in pkt:
            entry["src_port"] = pkt[TCP].sport
            entry["dst_port"] = pkt[TCP].dport
            entry["flags"] = str(pkt[TCP].flags)   # e.g. 'S', 'SA', 'PA', 'FA'
        elif UDP in pkt:
            entry["src_port"] = pkt[UDP].sport
            entry["dst_port"] = pkt[UDP].dport

        packet_queue.put(entry)

def start_capture(iface):
    sniff(iface=iface, prn=process_packet, store=False)
```

`store=False` is important — prevents Scapy from holding every packet in memory (would crash on long runs). Run this in a background thread so it doesn't block the rest of the agent.

## Step 4: Build the rolling-window aggregator

This is the core logic — every N seconds, group packets by source IP and compute features.

```python
# aggregator.py
import time
from collections import defaultdict

WINDOW_SECONDS = 3

def aggregate_window(packets):
    """packets = list of dicts collected in this window"""
    grouped = defaultdict(list)
    for pkt in packets:
        grouped[pkt["src_ip"]].append(pkt)

    feature_rows = []
    for src_ip, pkts in grouped.items():
        row = compute_features(src_ip, pkts)
        feature_rows.append(row)
    return feature_rows
```

## Step 5: Compute the feature set (must match training features)

This is the most important step — these features must be computed **the same way** as your CICIDS2017-trained model expects.

```python
# features.py

def compute_features(src_ip, pkts):
    total_packets = len(pkts)
    total_bytes = sum(p["length"] for p in pkts)
    duration = max(p["timestamp"] for p in pkts) - min(p["timestamp"] for p in pkts)
    duration = max(duration, 0.001)  # avoid divide-by-zero

    unique_dst_ports = len(set(p["dst_port"] for p in pkts if p["dst_port"]))
    unique_dst_ips = len(set(p["dst_ip"] for p in pkts))

    syn_count = sum(1 for p in pkts if p["flags"] and "S" in p["flags"] and "A" not in p["flags"])
    ack_count = sum(1 for p in pkts if p["flags"] and "A" in p["flags"])
    rst_count = sum(1 for p in pkts if p["flags"] and "R" in p["flags"])
    fin_count = sum(1 for p in pkts if p["flags"] and "F" in p["flags"])

    packet_lengths = [p["length"] for p in pkts]
    avg_packet_size = sum(packet_lengths) / total_packets
    max_packet_size = max(packet_lengths)
    min_packet_size = min(packet_lengths)

    timestamps = sorted(p["timestamp"] for p in pkts)
    iats = [t2 - t1 for t1, t2 in zip(timestamps, timestamps[1:])]
    avg_iat = sum(iats) / len(iats) if iats else 0

    return {
        "src_ip": src_ip,
        "flow_duration": duration,
        "total_packets": total_packets,
        "total_bytes": total_bytes,
        "packets_per_second": total_packets / duration,
        "bytes_per_second": total_bytes / duration,
        "unique_dst_ports": unique_dst_ports,
        "unique_dst_ips": unique_dst_ips,
        "syn_count": syn_count,
        "ack_count": ack_count,
        "rst_count": rst_count,
        "fin_count": fin_count,
        "avg_packet_size": avg_packet_size,
        "max_packet_size": max_packet_size,
        "min_packet_size": min_packet_size,
        "avg_iat": avg_iat,
    }
```

**Critical note:** whatever features you use here must **exactly match** the column names/order your model was trained on (from Stage 2 of your ML pipeline). Keep a shared `feature_list.json` between your training notebook and this agent so they never drift out of sync.

## Step 6: Send features to the backend

```python
# sender.py
import requests

BACKEND_URL = "http://localhost:8000/api/ingest"

def send_features(feature_rows):
    for row in feature_rows:
        try:
            response = requests.post(BACKEND_URL, json=row, timeout=2)
            if response.status_code != 200:
                print(f"Backend error: {response.status_code}")
        except requests.exceptions.RequestException as e:
            print(f"Failed to send data: {e}")
            # Optional: write to local file as fallback buffer
```

## Step 7: Tie it all together in the main loop

```python
# agent.py (main entry point)
import time
import threading
from capture import start_capture, packet_queue
from aggregator import aggregate_window
from sender import send_features

IFACE = "Wi-Fi"   # change to your interface name
WINDOW_SECONDS = 3

def main_loop():
    while True:
        time.sleep(WINDOW_SECONDS)

        # Drain the queue collected during this window
        batch = []
        while not packet_queue.empty():
            batch.append(packet_queue.get())

        if not batch:
            continue

        feature_rows = aggregate_window(batch)
        send_features(feature_rows)
        print(f"Sent {len(feature_rows)} flow(s) to backend")

if __name__ == "__main__":
    capture_thread = threading.Thread(target=start_capture, args=(IFACE,), daemon=True)
    capture_thread.start()

    print("Agent started. Capturing on", IFACE)
    main_loop()
```

## Step 8: Backend receiving endpoint (so it's clear how the two connect)

```python
# In your FastAPI backend
from fastapi import FastAPI
import joblib
import pandas as pd

app = FastAPI()
model = joblib.load("model.pkl")
scaler = joblib.load("scaler.pkl")

FEATURE_ORDER = ["flow_duration", "total_packets", "total_bytes",
                  "packets_per_second", "bytes_per_second", "unique_dst_ports",
                  "unique_dst_ips", "syn_count", "ack_count", "rst_count",
                  "fin_count", "avg_packet_size", "max_packet_size",
                  "min_packet_size", "avg_iat"]

@app.post("/api/ingest")
def ingest(data: dict):
    src_ip = data.pop("src_ip")
    row = pd.DataFrame([data])[FEATURE_ORDER]
    scaled = scaler.transform(row)

    prediction = model.predict(scaled)[0]
    confidence = model.predict_proba(scaled).max()

    # store in DB, run correlation engine, push to dashboard via websocket, etc.
    return {"src_ip": src_ip, "prediction": prediction, "confidence": float(confidence)}
```

## Step 9: Test the agent safely

Run these **on your own isolated test setup** (your own laptop/VM, never someone else's network without permission):
- **Benign traffic:** just browse the web normally while agent runs
- **Port scan simulation:** `nmap -sS 127.0.0.1` or scan a test VM
- **DDoS/flood simulation:** `hping3 -S --flood -p 80 <your-test-server-ip>` (only on your own test machine)
- **Brute force simulation:** run a few failed SSH login attempts against a test SSH server you control

Watch the terminal output confirm flows are being aggregated and sent, then check your backend logs/dashboard show the corresponding prediction.

## Step 10: Handle real-world edge cases (mention in report, implement if time allows)

- **Queue overflow protection** — if capture rate exceeds processing rate, drop oldest packets rather than crashing
- **Reconnection logic** — if backend is unreachable, buffer locally and retry
- **Interface auto-detection** — instead of hardcoding `"Wi-Fi"`, auto-detect the active interface
- **Graceful shutdown** — handle `Ctrl+C` to stop sniffing cleanly

---

### Folder structure for this component
```
capture-agent/
├── agent.py          # main entry point
├── capture.py         # Scapy sniffing logic
├── aggregator.py       # groups packets into windows
├── features.py         # feature computation (must match training)
├── sender.py           # sends to backend API
├── feature_list.json    # shared feature schema (sync with training notebook)
└── requirements.txt
```

---

Want me to now write the **FastAPI backend's full ingest → correlation → risk scoring → websocket push pipeline**, or set up the **training notebook** that produces `model.pkl` + `scaler.pkl` with the matching feature set?