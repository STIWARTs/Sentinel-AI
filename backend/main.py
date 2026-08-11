"""FastAPI application entry point."""

from fastapi import FastAPI

app = FastAPI(title="Sentinel AI")


@app.get("/")
def root():
    return {"status": "ok"}
