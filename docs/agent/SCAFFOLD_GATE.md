# Scaffold Gate: When the Build Agent May Start

The stronger foundation/scaffold agent owns the initial repository foundation. The faster build agent should not begin feature implementation until this gate is satisfied and merged to `main`.

## Required scaffold outputs

### Repository structure

- [ ] Final top-level application/package layout exists.
- [ ] Backend domain/application/infrastructure boundaries are represented in directories/modules.
- [ ] Frontend application location is established.
- [ ] Test locations and fixture conventions are established.

### Toolchain

- [ ] JavaScript package manager and lockfile are chosen and committed.
- [ ] Python dependency/environment strategy and lockfile are chosen and committed.
- [ ] Exact supported Node and Python versions are declared.
- [ ] `.env.example` contains names only, no real secrets.
- [ ] Local startup path is documented.

### One-command checks

The scaffold must define stable repository commands for agents. Exact implementation may be `make`, `just`, package scripts, or equivalent, but these logical operations must exist and be documented:

```text
setup
format
lint
typecheck
test
test-unit
test-integration
build
migrate
migrate-check
dev
```

Agents should not need to invent their own verification commands.

### Infrastructure

- [ ] Docker Compose development topology exists for required local services.
- [ ] PostgreSQL/PostGIS service is defined.
- [ ] Redis service is defined if workers require it.
- [ ] Health checks are defined.
- [ ] Persistent local data is ignored by Git.

### Database

- [ ] Migration framework is configured.
- [ ] One canonical migration head/process is established.
- [ ] CI can detect migration drift/conflicting heads.
- [ ] Test database strategy is documented.

### Shared contracts

At minimum, foundation contracts must exist for the first implementation wave:

- [ ] source state enum/types;
- [ ] provenance/source observation identity;
- [ ] terminal identity and verified entrance representation;
- [ ] traveler/party facts required by eligibility;
- [ ] eligibility decision shape;
- [ ] provider/source adapter protocol;
- [ ] application error/result conventions.

Only add route/opportunity contracts early if the first build tasks require them. Avoid speculative abstractions.

### Quality gates

- [ ] Formatter configured.
- [ ] Linter configured.
- [ ] Python static/type checks configured.
- [ ] TypeScript strict checking configured.
- [ ] Unit test runners configured.
- [ ] Integration test runner/fixtures configured.
- [ ] CI runs the canonical checks on pull requests.

### Security baseline

- [ ] Secrets are excluded from source control.
- [ ] Private trip/sample data paths are excluded.
- [ ] Structured logging convention avoids sensitive payloads.
- [ ] Auth boundary is either implemented or explicitly stubbed behind a clear interface for the current milestone.

### Agent task system

- [ ] `docs/tasks/TASK_TEMPLATE.md` has been adapted with the real repository verification commands.
- [ ] The foundation agent creates the first 3–6 bounded task files for the build agent.
- [ ] Each task has non-overlapping owned paths where possible.
- [ ] Each task identifies exact consumed/produced interfaces.
- [ ] Dependencies establish merge order.

## Recommended first split after scaffolding

The foundation agent should keep ownership of:

- domain contracts;
- DB migrations;
- API composition;
- auth/security boundaries;
- CI/toolchain;
- cross-cutting refactors.

The build agent can then take bounded tasks such as:

- terminal list/detail UI against a fixed API contract;
- source-health UI states;
- one source adapter/parser behind the fixed parser protocol;
- parser fixtures;
- readiness screens against fixed eligibility/readiness response models;
- provider handoff components;
- targeted service methods that do not alter shared contracts.

## Gate rule

If any required item above is missing, either keep the build agent idle on that dependency or assign it a truly independent bounded task. Do not let it create a competing scaffold to work around the missing foundation.
