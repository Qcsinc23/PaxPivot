# AMC terminal-page parser corpus (TASK-031)

Captured official pages plus **human-completed** labels, the evidence SRC-009 requires before
any parser output may become an automatic opportunity (≥ 99 % exact critical fields, zero
false rows).

**Where the corpus lives.** Captures are written to `private-fixtures/parsers/amc-terminal-page/`
at the repository root, which git ignores. Page bodies never enter this public repository or the
database: the registry policy for these sources is `hash_only`, and PRD §16.2 forbids
mirroring or archiving movement rows. Keep captured files for at most 90 days (§16.4), then
delete them. This directory holds only this README and synthetic fixtures.

- Capture: `python -m paxpivot.tooling capture-corpus <source_id>` (needs `FIRECRAWL_API_KEY`;
  the source's policy must allow parsing; a non-2xx page is refused). Writes `<sha256>.html`
  and `<sha256>.labels.yaml` into the private directory; records nothing in the database.
- Label: open the `.labels.yaml`, copy every departure row the page shows in the page's own
  wording, set `reviewer`. A file without a reviewer is not part of the corpus.
- Do not edit the `.html`.
- TASK-032 consumes the private directory locally to compute the parser accuracy report, and
  commits only the report and synthetic fixtures.

**Schedule artifacts (TASK-037).** The terminal HTML pages contain no departure rows; the
72-hour schedules are linked PDFs that carry CUI markings and a retransmission notice. They are
registered as restricted, user-opened-only sources: `capture-corpus` refuses them and nothing
from them may be labeled, stored or committed. The HTML captures stay as evidence that the page
itself lists nothing.
