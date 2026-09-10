# SourceProvider conformance fixtures

Synthetic, deterministic inputs for the metadata-only `SourceProvider` port
(`apps/api/paxpivot/application/ports/source_provider.py`).

## Rules

- Everything here is synthetic: `example.invalid` URLs, invented UUIDs, invented
  timestamps. Never download, mirror, copy or reproduce an official source artifact,
  movement row, credential or real trip detail.
- No network calls, no Firecrawl, no AMC scraping, no production adapter. These inputs
  exist so expectations are fixed *before* any live retrieval adapter is enabled.
- Fixtures carry metadata only. A fixture never claims availability, a flight, a seat or a
  probability, and a retrieval failure never becomes "no departures".
- `source_time=None` means unknown and must stay unknown through serialization.
- Do not weaken domain validation to make a fixture pass. If `SourceObservation` rejects an
  input, that rejection is the expected behavior and belongs in a test.

## Where the inputs live

The fixture inputs and the test-local fakes are defined in
`tests/unit/test_source_provider_conformance.py`:

- `SyntheticObservation` — one frozen fixture input per condition;
- `SYNTHETIC_FIXTURE_INPUTS` — the covered conditions (unreachable, missing,
  changed-unparsed, restricted, plus the valid `no_departures_published` state);
- `FixtureProvider`, `ConfigurationFailureProvider`, `InvalidAbsenceProvider` —
  deterministic, I/O-free fakes consumed through the `SourceProvider` protocol.

They are test-local because the current pytest configuration exposes only `tests/unit` and
site-packages on `sys.path`, so a module under `tests/fixtures/` is not importable from
`tests/unit/`. Changing shared pytest configuration to make that work is a foundation-agent
decision, not a build-task shortcut.

The conformance module arms a module-wide `no_network` guard that refuses
`socket.getaddrinfo` and `socket.create_connection`, so every assertion runs offline. A
separate test proves the guard actually refuses, so the offline claim cannot become vacuous.

## Reuse

Import the fixtures from the conformance module, or copy the `SyntheticObservation` pattern
for a new adapter task. Keep new source-specific corpora in their own owned subdirectory and
only after the source-processing approval required by SRC-002.
