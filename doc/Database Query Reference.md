# Database Query Reference

Ready-to-run psql queries for inspecting what Sentinel AI has stored in
Postgres. Use this during demos & debugging.

Every command runs against the Docker Postgres container. The standard
prefix is:

```powershell
docker exec sentinelai-postgres-1 psql -U sentinel -d sentinel_ai -c "<SQL>"
```

If the container name differs on your machine, check with `docker ps`.

---

## Tables overview

| Table | What it stores |
|---|---|
| `flow_logs` | One row per prediction — every flow the model classified (attack or benign) |
| `incidents` | Multi-stage attack chains detected by the correlation engine, plus Gemini explanations |
| `incident_actions` | Analyst actions taken on an incident (notes, escalations) |
| `users` | Dashboard accounts (bcrypt hashes only — never the plaintext password) |

---

## Interactive shell (for running many queries)

Instead of prefixing every query, open a psql shell once:

```powershell
docker exec -it sentinelai-postgres-1 psql -U sentinel -d sentinel_ai
```

Inside the shell, type any query below directly (without the
`docker exec ...` prefix), end it with `;`, and press Enter.
Use `\dt` to list tables and `\q` to quit.

---

## flow_logs — all stored traffic predictions

**Show all stored predictions (newest first):**

```powershell
docker exec sentinelai-postgres-1 psql -U sentinel -d sentinel_ai -c "SELECT id, src_ip, prediction, confidence, risk_score, timestamp FROM flow_logs ORDER BY id DESC;"
```

**Show only the attacks (exclude benign traffic):**

```powershell
docker exec sentinelai-postgres-1 psql -U sentinel -d sentinel_ai -c "SELECT id, src_ip, prediction, confidence, risk_score FROM flow_logs WHERE prediction != 'BENIGN' ORDER BY id DESC;"
```

**Attack count by type (the dashboard's distribution chart, as raw numbers):**

```powershell
docker exec sentinelai-postgres-1 psql -U sentinel -d sentinel_ai -c "SELECT prediction, COUNT(*) AS total FROM flow_logs GROUP BY prediction ORDER BY total DESC;"
```

**How many flows came from each source IP:**

```powershell
docker exec sentinelai-postgres-1 psql -U sentinel -d sentinel_ai -c "SELECT src_ip, COUNT(*) AS flows FROM flow_logs GROUP BY src_ip ORDER BY flows DESC;"
```

**Highest-risk flows seen:**

```powershell
docker exec sentinelai-postgres-1 psql -U sentinel -d sentinel_ai -c "SELECT id, src_ip, prediction, risk_score FROM flow_logs WHERE risk_score >= 50 ORDER BY risk_score DESC LIMIT 10;"
```

**Total rows stored:**

```powershell
docker exec sentinelai-postgres-1 psql -U sentinel -d sentinel_ai -c "SELECT COUNT(*) FROM flow_logs;"
```

---

## incidents — detected attack chains

**Show all incidents:**

```powershell
docker exec sentinelai-postgres-1 psql -U sentinel -d sentinel_ai -c "SELECT id, title, severity, attack_chain, mitre_technique, status, created_at FROM incidents ORDER BY id DESC;"
```

**Read the full Gemini explanation of the newest incident:**

```powershell
docker exec sentinelai-postgres-1 psql -U sentinel -d sentinel_ai -c "SELECT ai_explanation FROM incidents ORDER BY id DESC LIMIT 1;"
```

**Find incidents that are missing an AI explanation** (usually means the
Gemini call failed or was skipped because no valid key was visible):

```powershell
docker exec sentinelai-postgres-1 psql -U sentinel -d sentinel_ai -c "SELECT id, title, severity FROM incidents WHERE ai_explanation IS NULL OR ai_explanation = '';"
```

**Incident count by severity:**

```powershell
docker exec sentinelai-postgres-1 psql -U sentinel -d sentinel_ai -c "SELECT severity, COUNT(*) AS total FROM incidents GROUP BY severity ORDER BY total DESC;"
```

**All incidents from a specific source IP:**

```powershell
docker exec sentinelai-postgres-1 psql -U sentinel -d sentinel_ai -c "SELECT id, title, severity, created_at FROM incidents WHERE src_ip = '192.168.1.100' ORDER BY id DESC;"
```

**Open incidents that still need analyst attention:**

```powershell
docker exec sentinelai-postgres-1 psql -U sentinel -d sentinel_ai -c "SELECT id, title, severity, status FROM incidents WHERE status = 'Open' ORDER BY created_at DESC;"
```

**One incident in full detail (replace 5 with the incident id):**

```powershell
docker exec sentinelai-postgres-1 psql -U sentinel -d sentinel_ai -c "SELECT * FROM incidents WHERE id = 5;"
```

---

## incident_actions — analyst activity

**All recorded analyst actions:**

```powershell
docker exec sentinelai-postgres-1 psql -U sentinel -d sentinel_ai -c "SELECT incident_id, action, performed_by, timestamp FROM incident_actions ORDER BY timestamp DESC;"
```

**Actions for a single incident (replace 5 with the incident id):**

```powershell
docker exec sentinelai-postgres-1 psql -U sentinel -d sentinel_ai -c "SELECT action, performed_by, timestamp FROM incident_actions WHERE incident_id = 5;"
```

---

## users — dashboard accounts

**List accounts (id, username, role only — the password hash is never printed):**

```powershell
docker exec sentinelai-postgres-1 psql -U sentinel -d sentinel_ai -c "SELECT id, username, role FROM users ORDER BY id;"
```

---

## Resetting the demo data

If you want a clean database before a presentation, delete rows in this
order (`incident_actions` references `incidents`, so it goes first):

```powershell
docker exec sentinelai-postgres-1 psql -U sentinel -d sentinel_ai -c "DELETE FROM incident_actions;"
docker exec sentinelai-postgres-1 psql -U sentinel -d sentinel_ai -c "DELETE FROM incidents;"
docker exec sentinelai-postgres-1 psql -U sentinel -d sentinel_ai -c "DELETE FROM flow_logs;"
```

This keeps the seeded admin user. Never run `DELETE FROM users;` unless
you plan to re-run `python seed_admin.py` afterwards.
