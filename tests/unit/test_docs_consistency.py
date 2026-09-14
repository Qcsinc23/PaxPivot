"""The entry-point documentation must agree with the repository (README drift guard, TASK-040).

`README.md` is the first file every agent and contributor reads, and it is the one place a
false statement costs the most: a claim that a capability exists sends a reader looking for
code that is not there, and a claim that it does not exist invites duplicating a shipped
slice. This guard derives the facts from the repository itself — the registered HTTP routes,
the Alembic revision files, the Makefile targets and the task contracts — and fails when the
README stops agreeing with them. It deliberately checks only mechanical, derivable claims, never
prose quality.
"""

import re
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[2]
README = ROOT / "README.md"
API = ROOT / "apps/api/paxpivot/api.py"
VERSIONS = ROOT / "apps/api/migrations/versions"
TASKS = ROOT / "docs/tasks"
MAKEFILE = ROOT / "Makefile"


def read(path: Path) -> str:
    return path.read_text(encoding="utf-8")


@pytest.fixture(scope="module")
def readme() -> str:
    return read(README)


def registered_routes() -> set[str]:
    """Every path an `@app.<method>("<path>")` decorator in the API module registers."""
    return {
        path
        for _, path in re.findall(r'@app\.(get|post|put|patch|delete)\(\s*"([^"]+)"', read(API))
    }


def task_statuses() -> dict[str, str]:
    """Task number -> the backticked status word in each contract's `## Status` section."""
    statuses: dict[str, str] = {}
    for path in sorted(TASKS.glob("TASK-[0-9][0-9][0-9]-*.md")):
        section = read(path).split("## Status", 1)[1].split("##", 1)[0]
        status = re.search(r"`([a-z_]+)`", section)
        assert status is not None, f"{path.name} has no backticked status"
        statuses[path.name[5:8]] = status.group(1)
    return statuses


def test_every_registered_route_is_documented(readme: str) -> None:
    """A reader must find every live endpoint in the README's table, and only those.

    Both directions matter and fail differently: a registered route missing from the table
    hides a capability, while a table row with no route behind it sends a reader (or an agent)
    looking for a contract that does not exist.
    """
    listed = set(
        re.findall(r"^\| `(?:GET|POST|PUT|PATCH|DELETE)` \| `([^`]+)`", readme, re.MULTILINE)
    )
    assert listed, "README.md should list the API surface as a table the guard can read"
    assert sorted(registered_routes() - listed) == [], "registered but missing from README.md"
    assert sorted(listed - registered_routes()) == [], "in README.md but not registered"


def test_readme_reports_the_applied_migration_range(readme: str) -> None:
    """The stated revisions are exactly the ones on disk, and the next one is free."""
    revisions = sorted(p.name[:4] for p in VERSIONS.glob("[0-9][0-9][0-9][0-9]_*.py"))
    assert revisions, "no migrations found"
    first, last = revisions[0], revisions[-1]
    assert f"`{first}`" in readme and f"`{last}`" in readme, (
        f"README must state the applied range {first}-{last}"
    )
    assert f"`{int(last) + 1:04d}`" in readme, "README must state the next revision"


def test_task_claims_match_the_task_contracts(readme: str) -> None:
    """Every task the README names is blocked or done, and every blocked task is named.

    A `review` or `in_progress` contract named in the README means the README describes work as
    settled that is not; a blocked contract missing from the README hides a known gap.
    """
    statuses = task_statuses()
    named = set(re.findall(r"TASK-(\d{3})", readme))
    unknown = sorted(t for t in named if t not in statuses)
    assert unknown == [], f"README.md names tasks with no contract: {unknown}"
    unsettled = sorted(t for t in named if statuses[t] not in {"blocked", "done"})
    assert unsettled == [], f"README.md names tasks that are neither blocked nor done: {unsettled}"
    blocked = {t for t, status in statuses.items() if status == "blocked"}
    assert sorted(blocked - named) == [], "blocked task contracts missing from README.md"


def test_every_documented_make_target_exists(readme: str) -> None:
    """A command the README tells a reader to run must exist in the Makefile."""
    targets = set(re.findall(r"^([a-z][a-z-]*):", read(MAKEFILE), re.MULTILINE))
    documented = set(re.findall(r"^\| `make ([a-z-]+)`", readme, re.MULTILINE))
    assert documented, "README.md should list the make commands as a table"
    assert sorted(documented - targets) == [], "README.md documents make targets that do not exist"


def test_readme_referenced_paths_exist(readme: str) -> None:
    """Every repository path the README links to is real; a dead link misleads the reader."""
    links = re.findall(r"\]\(([^)#][^)]*)\)", readme)
    broken = [
        target
        for target in links
        if not target.startswith(("http://", "https://")) and not (ROOT / target).exists()
    ]
    assert broken == [], f"README.md links to missing paths: {broken}"
