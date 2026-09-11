# AMC terminal-page parser corpus (TASK-031)

Captured official pages plus **human-completed** labels, the evidence SRC-009 requires before
any parser output may become an automatic opportunity (≥ 99 % exact critical fields, zero
false rows).

- Capture: `python -m paxpivot.tooling capture-corpus <source_id>` (needs `FIRECRAWL_API_KEY`;
  the source's policy must allow parsing). Writes `<sha256>.html` and `<sha256>.labels.yaml`
  here; records nothing in the database.
- Label: open the `.labels.yaml`, copy every departure row the page shows in the page's own
  wording, set `reviewer`. A file without a reviewer is not part of the corpus.
- These files are public official pages; do not add anything restricted, marked, or
  credentialed. Do not edit the `.html`.
- TASK-032 consumes this directory to compute the parser accuracy report.
