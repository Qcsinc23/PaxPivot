"""Select an already verified passenger entrance from an operational terminal.

This helper only reports entrance evidence the Terminal registry already carries. It
never manufactures a location: airfield/base coordinates are identity context and are
never promoted into a passenger entrance, and no source, geocoder or provider is
consulted here.
"""

from paxpivot.application.result import ApplicationError, Failure, Result, Success
from paxpivot.domain.terminal import Terminal, VerifiedEntrance


def select_entrance(terminal: Terminal) -> Result[VerifiedEntrance]:
    """Return the terminal's unchanged verified entrance, or an explicit failure."""
    if terminal.operational_state == "conflict":
        return Failure(
            error=ApplicationError(
                code="conflict",
                message_key="terminal.operational_conflict",
                retryable=False,
            )
        )
    if terminal.operational_state == "ended":
        return Failure(
            error=ApplicationError(
                code="unavailable",
                message_key="terminal.service_ended",
                retryable=False,
            )
        )
    if terminal.operational_state != "verified" or terminal.entrance is None:
        return Failure(
            error=ApplicationError(
                code="unavailable",
                message_key="terminal.entrance_unverified",
                retryable=False,
            )
        )
    return Success(value=terminal.entrance)
