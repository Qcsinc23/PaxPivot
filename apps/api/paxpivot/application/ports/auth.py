from typing import Protocol
from uuid import UUID

from paxpivot.application.result import Result
from paxpivot.domain.base import Contract


class Principal(Contract):
    user_id: UUID


class Authenticator(Protocol):
    async def authenticate(self, credential: str | None) -> Result[Principal]: ...
