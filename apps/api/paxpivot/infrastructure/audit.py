"""Allowlisted structured events; no arbitrary payloads or exception strings."""

import json
import logging
from typing import Literal
from uuid import UUID


def audit_event(
    logger: logging.Logger,
    event: Literal["authorization_denied", "source_disabled", "service_started"],
    correlation_id: UUID,
) -> None:
    logger.info(json.dumps({"event": event, "correlation_id": str(correlation_id)}))
