Here's the step-by-step pipeline for what to do once you have the CICIDS2017 dataset downloaded — from raw CSV to a working ML model you can plug into your backend.

## Step 1: Data Understanding & Cleanup

**1a. Load and inspect**
- CICIDS2017 comes as multiple CSVs (one per day/attack scenario — e.g., `Monday-WorkingHours.pcap_ISCX.csv`, `Wednesday-DDoS.pcap_ISCX.csv`, etc.)
- Combine all CSVs into one dataframe (or keep separate if you want day-wise analysis)
- Check shape, column names, data types

**1b. Clean the data (CICIDS2017 is notoriously messy)**
- [ ] Strip whitespace from column names (they have leading spaces like `' Flow Duration'`)
- [ ] Handle `Infinity` and `NaN` values (common in `Flow Bytes/s`, `Flow Packets/s` columns — division by zero issues in original feature computation)
- [ ] Drop or impute rows with missing/corrupt values
- [ ] Remove duplicate rows (dataset has known duplicates)
- [ ] Check the `Label` column — you'll see labels like `BENIGN`, `DDoS`, `PortScan`, `FTP-Patator`, `SSH-Patator`, `Bot`, `Web Attack – Brute Force`, etc.

## Step 2: Feature Selection

- Drop identifier columns that would cause **data leakage** or aren't useful for generalization: `Flow ID`, `Source IP`, `Destination IP`, `Timestamp` (raw IPs shouldn't be learned as features — model would overfit to specific IPs in the dataset)
- Keep the ~15–20 features you shortlisted earlier (packet rate, byte rate, IAT, flag counts, etc.)
- Check for **highly correlated features** (drop redundant ones — e.g., if `Total Fwd Packets` and `Subflow Fwd Packets` are near-identical, keep one)
- Optionally use `SelectKBest` or feature importance from a quick Random Forest run to rank features objectively

## Step 3: Label Consolidation

- Decide your class structure. Two options:
  - **Multi-class:** BENIGN, DDoS, PortScan, BruteForce, Bot (merge `FTP-Patator`+`SSH-Patator` → `BruteForce`; merge `DoS Hulk`+`DoS GoldenEye`+etc → `DDoS`)
  - **Binary first, multi-class second:** Train one model for "Attack vs Benign" then a second model to classify attack type — often more accurate in practice, and gives you a nice "confidence" number for your dashboard
- **Recommendation:** Go multi-class directly (simpler pipeline for a student project), using your Tier 1 classes from earlier

## Step 4: Handle Class Imbalance

- CICIDS2017 is heavily imbalanced — `BENIGN` is ~80% of the data, some attacks like `Infiltration` have <50 samples
- Techniques to use:
  - **Drop classes with too few samples** (e.g., drop Infiltration, Heartbleed — not enough data to train reliably anyway, matches your Tier 3 decision)
  - **Undersample BENIGN** or **oversample minority attacks** using SMOTE
  - Use `class_weight='balanced'` in your model as a simpler alternative to resampling

## Step 5: Train/Test Split + Scaling

- Split: typically 70/30 or 80/20, **stratified** by label (so rare classes appear proportionally in both sets)
- Scale features: `StandardScaler` or `MinMaxScaler` — tree-based models (Random Forest/XGBoost) don't strictly need this, but it's good practice and needed if you also try Neural Networks/Autoencoders

## Step 6: Model Training

- Start with **Random Forest** (fast, interpretable, good baseline, handles mixed feature scales well)
- Then try **XGBoost** (usually outperforms RF on this kind of tabular data)
- Optionally try **Isolation Forest** as an unsupervised anomaly detector (useful for catching attack types not in training data — good talking point for "future scope: zero-day detection")

## Step 7: Evaluation

Don't just report accuracy (misleading with imbalanced data). Use:
- **Precision, Recall, F1-score per class** (critical — you want high Recall for attacks, i.e., don't miss real attacks, even if it means a few false alarms)
- **Confusion matrix** (great visual for your report — shows exactly which attack types get confused with which)
- **ROC-AUC** for binary framing if you also do the binary model

## Step 8: Save the Model

- Export using `joblib` or `pickle` (for scikit-learn/XGBoost) — this is the file your **FastAPI backend** loads to make live predictions
- Also save the `StandardScaler` object (you must scale live traffic the same way you scaled training data)

## Step 9: Build the Inference Pipeline

This is the bridge to your real-time system:
- Your capture agent computes the same ~15-20 features from live packets (in rolling flow windows)
- Feed those features into the saved model → get prediction (attack type) + confidence (probability score)
- This output feeds into your Risk Scoring Engine and Correlation Engine from earlier

## Step 10: Explainability (optional but impressive)

- Use **SHAP** or feature importance plots to show *why* the model flagged something as an attack (e.g., "flagged mainly due to high SYN count and low flow duration")
- This directly supports your "AI Copilot" module — the LLM can use these SHAP values to generate the plain-English explanation

---

### Quick summary flow:
```
Load CSVs → Clean data → Select features → Consolidate labels 
→ Balance classes → Split & scale → Train (RF/XGBoost) 
→ Evaluate (F1, confusion matrix) → Save model 
→ Build live inference pipeline → Connect to backend
```

Want me to write the actual Python code for steps 1–7 (a working Jupyter notebook you can run on the dataset), or move to designing the FastAPI inference endpoint that plugs the trained model into your live agent?