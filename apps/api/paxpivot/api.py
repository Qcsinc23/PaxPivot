from typing import Literal

from fastapi import FastAPI

from paxpivot.domain.base import Contract

app = FastAPI(title="PaxPivot", docs_url=None, redoc_url=None, openapi_url=None)


class HealthResponse(Contract):
    status: Literal["ok"] = "ok"


@app.get("/health", response_model=HealthResponse)
def health() -> HealthResponse:
    """Liveness only; does not imply database/provider or production readiness."""
    return HealthResponse()
