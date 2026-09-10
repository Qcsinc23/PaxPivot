# Merge policy for `main`

`main` is protected on GitHub (configured 2026-09-10 via the branch-protection API; verify with
`gh api repos/Qcsinc23/PaxPivot/branches/main/protection`). The settings are:

| Setting | Value | Why |
| --- | --- | --- |
| Required status check | `scaffold` (job of the `Quality` workflow) | Canonical `make setup`, `make check`, `make migrate-test` and clean-diff gate |
| Require branch up to date (`strict`) | on | The check must have run on the exact head that will merge, including current `main` |
| Enforce for administrators | on | Owners and agents follow the same gate |
| Force pushes | blocked | History on `main` is append-only |
| Branch deletion | blocked | |
| Conversation resolution | required | Review threads must be resolved before merge |
| Required approving reviews | none | Autonomous agents merge their own bounded PRs; the gate is the check plus the review record below |
| Rulesets | none | Classic branch protection is the single source of these rules |

If the API ever reports `Branch not protected`, re-apply exactly the table above before merging
anything; do not merge to an unprotected `main`.

## Who may merge what

- Any change to `main` goes through a pull request from a short-lived branch (see WORKFLOW.md §6).
- An autonomous agent may merge its own PR only when all of the following hold:
  1. the PR implements exactly one task file and touches only that task's owned paths;
  2. the task's Handoff records fresh verification output for every canonical command;
  3. a fresh engineering review is recorded in the PR with zero Critical and zero Important findings;
  4. the `scaffold` check is green on the exact head SHA;
  5. for foundation tasks, the ADR requirements in AGENTS.md are satisfied.
- Product-scope or architecture decisions that the task/ADR process cannot resolve are escalated
  to the product owner instead of merged.
- Prefer merge commits (`gh pr merge --merge`) so each task remains one merged unit in history.

## After merging

Verify the post-merge `Quality` run on `main`, then `git switch main && git pull --ff-only`.
Dependent tasks branch from that merged `main`.
