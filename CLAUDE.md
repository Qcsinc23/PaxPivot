# Project agent memory

This file is the project's committed home for project-intrinsic agent knowledge: build, test, release, architecture, and sharp-edge notes that should travel with the code.

- The authoritative production development target is [`PAXPIVOT_PRODUCTION_PRD.md`](PAXPIVOT_PRODUCTION_PRD.md).
- Preserve [`paxpivot.md`](paxpivot.md) as the original validation/evidence baseline and regression source for privacy, OPSEC, source handling, parser accuracy, uncertainty, failure states, and no-guarantee behavior.
- Product scope follows the production PRD; source-truth and safety behavior follow the stricter applicable rule.
- Build in milestone order and keep deterministic eligibility, source-state, destination, and route services authoritative.
- The AI layer may translate user intent and explain tool-grounded results. It must never invent a flight, seat state, policy rule, eligibility decision, route edge, or provider confirmation.
- Do not implement boarding, completion, or route-success probabilities until the prediction gate in the production PRD is explicitly satisfied and enabled.

## Maintaining this file

Keep this file for knowledge useful to almost every future agent session in this project.
Do not repeat what the codebase already shows; point to the authoritative file or command instead.
Prefer rewriting or pruning existing entries over appending new ones.
When updating this file, preserve this bar for all agents and keep entries concise.
