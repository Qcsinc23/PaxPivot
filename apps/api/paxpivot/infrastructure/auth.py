import hmac
import os
from uuid import NAMESPACE_URL, uuid5

from paxpivot.application.ports.auth import Authenticator, Principal
from paxpivot.application.result import ApplicationError, Failure, Result, Success

# The one principal a shared development token represents (ADR-004: interim, not per-user auth).
LOCAL_PRINCIPAL_ID = uuid5(NAMESPACE_URL, "paxpivot:principal:local-api-token")


def _unauthorized(message_key: str) -> Failure:
    return Failure(
        error=ApplicationError(code="unauthorized", message_key=message_key, retryable=False)
    )


class DenyAllAuthenticator:
    async def authenticate(self, credential: str | None) -> Result[Principal]:
        return _unauthorized("auth.not_configured")


class BearerTokenAuthenticator:
    """Constant-time comparison against one server-side token. Never logs the credential."""

    def __init__(self, token: str) -> None:
        if len(token) < 32:
            raise ValueError("API token must be at least 32 characters")
        self._token = token

    async def authenticate(self, credential: str | None) -> Result[Principal]:
        if credential is None:
            return _unauthorized("auth.invalid_credential")
        # Compare bytes: hmac.compare_digest raises TypeError on a non-ASCII str, which would
        # turn an unauthenticated request into a 500 and skip the denial audit event.
        if not hmac.compare_digest(credential.encode("utf-8"), self._token.encode("utf-8")):
            return _unauthorized("auth.invalid_credential")
        return Success(value=Principal(user_id=LOCAL_PRINCIPAL_ID))


def authenticator_from_env() -> Authenticator:
    """PAXPIVOT_API_TOKEN set → bearer token; unset → every request is denied."""
    token = os.environ.get("PAXPIVOT_API_TOKEN")
    return BearerTokenAuthenticator(token) if token else DenyAllAuthenticator()
