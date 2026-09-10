"""Deterministic, metadata-only explanations for the current source states.

The wording here is presentation copy derived only from an existing
``SourceObservation.state``. It adds no availability claim, no probability and no
source payload; every state keeps its own uncertainty visible.
"""

from types import MappingProxyType

from paxpivot.domain.source import SourceObservation, SourceState

_EXPLANATIONS_BY_STATE: MappingProxyType[SourceState, str] = MappingProxyType(
    {
        SourceState.FRESH: (
            "A fresh source observation exists for this source; it is metadata, not a "
            "confirmed flight and not confirmed seat availability, and it still requires "
            "official verification."
        ),
        SourceState.STALE: (
            "The available observation for this source is stale: it is no longer current "
            "and must not be read as current availability."
        ),
        SourceState.UNREACHABLE: (
            "The source could not currently be reached, so this check obtained no "
            "observation. That is missing data, not evidence that there are no departures."
        ),
        SourceState.CHANGED_UNPARSED: (
            "The source changed and its current contents cannot safely be interpreted, so "
            "nothing here states whether departures exist."
        ),
        SourceState.MISSING: (
            "The source itself could not be found or is unavailable, so its published "
            "contents are unknown; this is not evidence that there are no departures."
        ),
        SourceState.CONFLICT: (
            "Available source evidence conflicts, so no single current reading is "
            "established by this observation."
        ),
        SourceState.MONITOR_DELAYED: (
            "The scheduled source check was delayed, so no current observation is "
            "available and current availability cannot be reported."
        ),
        SourceState.NO_DEPARTURES: (
            "This specific source explicitly published no departures in the observation "
            "evaluated; that applies to this source only and is not a generalization or a "
            "verified flight guarantee."
        ),
        SourceState.NO_COMPATIBLE: (
            "For the request evaluated, the evidence did not support a compatible "
            "opportunity; the reason is not established here and is not an eligibility, "
            "seat or no-departure finding."
        ),
        SourceState.RESTRICTED: (
            "This source is restricted and may only be reviewed by the user opening it "
            "directly; no current availability is established here."
        ),
        SourceState.REVIEW_REQUIRED: (
            "An observation for this source is awaiting human parser review, so no current "
            "availability is established here."
        ),
        SourceState.SUPERSEDED: (
            "This observation is superseded and is not presented as current availability."
        ),
        SourceState.WITHDRAWN: (
            "This source withdrew the observation, so it is no longer current and does not "
            "indicate current availability."
        ),
    }
)

# Fail loudly at import if a future SourceState is added without reviewed wording.
if set(_EXPLANATIONS_BY_STATE) != set(SourceState):  # pragma: no cover - exhaustive guard
    missing = sorted(set(SourceState) - set(_EXPLANATIONS_BY_STATE))
    raise RuntimeError(f"Missing source-state explanations: {missing}")


def explain_source(observation: SourceObservation) -> str:
    """Return the approved uncertainty-preserving explanation for the observation's state."""
    return _EXPLANATIONS_BY_STATE[observation.state]
