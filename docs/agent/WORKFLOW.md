# PaxPivot Multi-Agent Development Workflow

This file defines how multiple coding agents work on PaxPivot without drifting apart.

## 1. Repository is the source of truth

Agents must not rely on prior chat memory, hidden harness state, or assumptions from another agent.

Read in this order before starting work:

1. `AGENTS.md`
2. `PAXPIVOT_PRODUCTION_PRD.md`
3. `paxpivot.md` for inherited safety/source/privacy constraints
4. `docs/architecture/BOUNDARIES.md`
5. the assigned task file under `docs/tasks/`
6. relevant code/tests for the assigned task

If instructions conflict, follow the precedence rules in `AGENTS.md`.

## 2. Agent roles

### Foundation / scaffold agent

Use the stronger local agent for work that creates or changes shared contracts:

- repository scaffolding;
- package/workspace structure;
- dependency choices;
- Docker/development environment;
- database schema and migrations;
- shared domain models;
- API contracts;
- provider interfaces;
- authentication/authorization boundaries;
- CI/lint/typecheck/test infrastructure;
- routing-engine interfaces;
- cross-cutting refactors;
- architectural decisions.

This agent may change shared contracts only when the change is documented and tested.

### Implementation / build agent

Use the faster/cheaper agent for bounded work behind stable contracts:

- individual endpoints;
- UI screens and components;
- provider adapter implementations;
- parser fixtures and parser implementations;
- CRUD/service methods;
- focused background jobs;
- tests for bounded behavior;
- documentation tied to the implemented feature.

The build agent must not silently change shared interfaces, schemas, dependency direction, or product rules. If a contract change is needed, stop that task and record a proposed decision/change for the foundation agent.

## 3. One task = one contract

Every development task must have one file under `docs/tasks/` using `docs/tasks/TASK_TEMPLATE.md`.

Each task defines:

- goal;
- dependencies;
- files/directories the task owns;
- interfaces it consumes;
- interfaces it is allowed to produce;
- acceptance criteria;
- exact verification commands;
- out-of-scope items.

An agent may modify files outside its owned paths only when the task explicitly authorizes it.

## 4. Avoid concurrent ownership

Do not assign two agents tasks that edit the same shared files at the same time.

High-conflict files include:

- dependency manifests/lockfiles;
- database migration heads;
- central route/API registries;
- shared domain model modules;
- auth middleware;
- Docker/CI configuration;
- generated API schemas;
- `AGENTS.md` and architecture documents.

The foundation agent owns these by default.

## 5. Contract-first rule

Before the build agent implements a feature that depends on a new shared interface, the foundation agent should establish and merge the contract first.

Examples:

- Pydantic request/response models before UI/API implementation;
- repository/service interfaces before provider adapter implementations;
- database migration before code assumes a new column;
- typed route-domain models before route-card UI consumes them;
- source-parser protocol before individual source parsers are written.

Prefer compile-time/typecheck failures over undocumented conventions.

## 6. Branch discipline

Create short-lived branches from current `main`.

Recommended names:

- `foundation/<task-id>-<slug>`
- `build/<task-id>-<slug>`
- `fix/<task-id>-<slug>`

Before starting a task:

```bash
git fetch origin
git switch main
git pull --ff-only
git switch -c <branch>
```

Before handoff/review, rebase or merge the latest `main` according to the repository's chosen workflow and rerun the complete task verification.

Do not build multiple unrelated features in one branch.

## 7. Definition of done

A task is not done because code was written.

The assigned agent must:

1. satisfy every acceptance criterion in the task file;
2. run the task's exact verification commands;
3. run repository-wide required checks defined by the scaffolded project;
4. add/update tests for changed behavior;
5. update the task status and implementation notes;
6. document any contract or migration change;
7. confirm no unrelated files were modified;
8. commit focused changes with a descriptive message.

Never claim tests/build/typecheck pass without fresh command output.

## 8. Handoff protocol

At the end of a task, update only that task file's `Handoff` section with:

- commit/branch;
- files changed;
- interfaces added/changed;
- migrations added;
- verification commands and results;
- remaining risks/known limitations;
- exact next dependency, if any.

The next agent reads the task file and code, not a chat transcript.

## 9. Shared contract changes

If implementation reveals that a shared contract must change:

1. do not patch around it locally;
2. record the proposed change in the task's `Blocked / Contract change needed` section;
3. create an ADR when the change affects architecture, persistence, public/internal APIs, provider boundaries, security, or major dependencies;
4. have the foundation agent make and merge the contract change;
5. refresh the build branch from `main` and continue.

## 10. Architectural decisions

Use `docs/decisions/` for decisions that future agents must understand.

Create an ADR when changing:

- framework/runtime/database choices;
- domain boundaries;
- persistence strategy;
- provider interfaces;
- source-processing/security model;
- route-engine algorithm/contract;
- auth model;
- deployment topology;
- cross-package dependency direction.

Do not create ADRs for routine implementation details.

## 11. Merge/review order

When tasks depend on one another:

1. shared contract/foundation PR merges first;
2. dependent implementation branch updates from `main`;
3. dependent tests are rerun;
4. implementation PR merges.

Never merge a consumer before the contract it relies on.

## 12. Communication rule

If an agent encounters ambiguity, it should prefer the narrowest implementation consistent with the PRD and existing contracts. It should not invent new product behavior merely to keep moving.

When a decision would alter product scope or architecture, escalate through a task/ADR rather than embedding the decision silently in code.
