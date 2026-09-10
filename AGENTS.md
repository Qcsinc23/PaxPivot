# Project agent memory

This file is the project's committed home for project-intrinsic agent knowledge: build, test, release, architecture, and sharp-edge notes that should travel with the code.

- The authoritative production development target is [`PAXPIVOT_PRODUCTION_PRD.md`](PAXPIVOT_PRODUCTION_PRD.md).
- The original bounded-pilot evidence, privacy/OPSEC boundary, source-handling rules, failure states, parser correctness gates, and validation baseline remain in [`paxpivot.md`](paxpivot.md) and must be preserved as regression requirements.
- If the two documents differ on product scope, follow the production PRD. If they differ on source truth, dissemination, privacy, uncertainty, or no-guarantee behavior, follow the stricter rule unless the production PRD explicitly supersedes it.
- Implement in the milestone order defined by the production PRD: foundation → source truth → direct planner → production UX → temporal graph → Ask PaxPivot → historical intelligence.
- Do not introduce boarding/completion probability models during initial development.
- Keep deterministic eligibility, source-state, and route engines authoritative; AI may interpret intent and explain structured results but may not invent or override them.

## Maintaining this file

Keep this file for knowledge useful to almost every future agent session in this project.
Do not repeat what the codebase already shows; point to the authoritative file or command instead.
Prefer rewriting or pruning existing entries over appending new ones.
When updating this file, preserve this bar for all agents and keep entries concise.
