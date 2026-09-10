from typing import Literal

from paxpivot.domain.base import Contract, Identifier


class ApplicationError(Contract):
    code: Literal["unauthorized", "forbidden", "unavailable", "invalid_input", "conflict"]
    message_key: Identifier  # Static catalog key, never provider response/exception text.
    retryable: bool


class Success[T](Contract):
    ok: Literal[True] = True
    value: T


class Failure(Contract):
    ok: Literal[False] = False
    error: ApplicationError


type Result[T] = Success[T] | Failure
