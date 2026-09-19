This is the missing piece in the project pipeline.

The backend, ML model, and detection flow are already working end-to-end, but the live capture-agent is still not implemented. The project status in `Project Status.md` explicitly says the capture-agent is still not started and that the replay script is only a temporary demo fallback.

This is important because the real system needs traffic capture, flow aggregation, feature extraction, and sending those features to the backend for prediction. Without this, the project cannot move from a demo replay setup to a real intrusion-detection workflow.

Why this matters:
- The backend expects real flow features from the capture-agent
- The model has a fixed feature set and it must match exactly across the training pipeline and the live ingestion path
- The current replay script is only a stand-in, not the real system
- We need a real capture-agent to complete the end-to-end demo and future deployment

Relevant project guidance:
- Rules says the feature set must stay in sync across the training, capture-agent, and backend code
- The same file says the capture-agent must operate with explicit, simple logic and no hidden side effects
- The project status also clearly identifies the capture-agent as a blocked item for the full demo

### Scope
We need to implement the capture-agent so it can:
- capture live network traffic
- aggregate packets into flow-level records
- compute the required feature values
- normalize them to the model’s expected format
- send them to the backend ingest endpoint with the required auth key
- handle errors gracefully and avoid sending incomplete data

### Required work
1. Review and confirm feature sync
   - Check the feature names and order in:
     - ml-pipeline training output
     - capture-agent feature definitions
     - backend ML feature list
   - Make sure they match exactly before changing anything

2. Implement packet capture
   - Use the correct OS-level packet capture approach for the environment
   - Keep it simple and readable
   - Do not overengineer it for a college project

3. Build flow aggregation
   - Convert packet data into flow-based records
   - Compute the same fields the model expects
   - Keep each feature name consistent with the documented feature list

4. Normalize feature names
   - The project specifically warns that feature keys may not match exactly between agent data and model input
   - Add explicit mapping where needed before sending to the backend

5. Implement sending to backend
   - Send aggregated feature records to the backend ingest endpoint
   - Include the required agent auth header
   - Ensure the payload matches the backend schema

6. Add safe error handling
   - Handle missing permissions, failed capture, bad packets, network issues
   - Log only useful metadata
   - Avoid sending partial or malformed records

7. Validate with real project flow
   - Run the backend
   - Trigger traffic or replay data
   - Confirm the incident is created in the backend
   - Confirm prediction and correlation behavior still work

### Acceptance criteria
- The capture-agent can collect live traffic or equivalent valid flow data
- The computed feature names and order match the project feature list exactly
- The backend ingest endpoint accepts the payload successfully
- The feature values are correctly normalized before prediction
- A realistic test flow confirms that an incident is created and reaches the backend
- No secret values or real credentials are committed
- The implementation remains simple and follows the project rules 

### Notes
This is the remaining core missing functionality before the project can be considered complete end-to-end. The replay script is useful for demo testing, but it is not the final implementation.

