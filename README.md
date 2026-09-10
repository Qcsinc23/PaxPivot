# PaxPivot

PaxPivot is a source-aware, end-to-end Space-A journey planning project. It is designed to help eligible travelers understand what official sources currently support, which passenger terminals are practical to reach, how direct and multi-hop paths connect to a real-world destination, and which fallbacks reduce stranding risk.

## Current repository state

The repository contains the product/architecture baseline and multi-agent development rules. Application scaffolding is the next implementation step.

## Start here

**Coding agents:** read [`AGENTS.md`](AGENTS.md) first.

**Product/development scope:** [`PAXPIVOT_PRODUCTION_PRD.md`](PAXPIVOT_PRODUCTION_PRD.md)

**Inherited validation/safety baseline:** [`paxpivot.md`](paxpivot.md)

**Architecture boundaries:** [`docs/architecture/BOUNDARIES.md`](docs/architecture/BOUNDARIES.md)

**Multi-agent workflow:** [`docs/agent/WORKFLOW.md`](docs/agent/WORKFLOW.md)

**Initial scaffold gate:** [`docs/agent/SCAFFOLD_GATE.md`](docs/agent/SCAFFOLD_GATE.md)

## Multi-agent development

PaxPivot is structured for a stronger foundation/scaffold agent and a faster implementation agent. Shared contracts, migrations, toolchain, CI, and architecture stay foundation-owned. Bounded implementation work is assigned through task contracts under `docs/tasks/` with explicit owned paths, interfaces, acceptance criteria, and verification commands.

Do not use chat history as project state; keep decisions, task handoffs, contracts, and verification evidence in the repository.

## Product direction

The build evolves from source-verified direct planning into a production PWA with destination intelligence, nationwide terminal discovery, a temporal multi-hop route graph, policy-permitted OCONUS support, commercial/ground positioning, historical descriptive intelligence, and a tool-grounded conversational “Ask PaxPivot” interface.
