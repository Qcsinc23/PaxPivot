from paxpivot.application.ports.auth import Principal
from paxpivot.application.result import ApplicationError, Failure, Result


class DenyAllAuthenticator:
    async def authenticate(self, credential: str | None) -> Result[Principal]:
        return Failure(
            error=ApplicationError(
                code="unauthorized", message_key="auth.not_configured", retryable=False
            )
        )
