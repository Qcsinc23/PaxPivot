"""Two independent checkouts must resolve to different Compose projects, volumes and ports.

Uses ``docker compose config`` only; no container is started. The named volume is
``<project>_postgres-data``, so distinct project names prove the databases cannot share
initialisation state (and therefore cannot disagree about the generated password).
"""

import json
import os
import shutil
import subprocess
from pathlib import Path

import pytest
from paxpivot.tooling import ROOT, write_env

pytestmark = pytest.mark.integration


def resolved(root: Path) -> dict[str, object]:
    # Only the checkout's own .env may name the project: another test in this process may have
    # loaded the real checkout's .env into os.environ (tooling.configure), and Compose gives an
    # environment variable precedence over the .env file it finds in `cwd`.
    env = {
        k: v for k, v in os.environ.items() if not k.startswith(("COMPOSE_", "POSTGRES_", "REDIS_"))
    }
    output = subprocess.check_output(
        ["docker", "compose", "config", "--format", "json"], cwd=root, text=True, env=env
    )
    config = json.loads(output)
    services = config["services"]
    return {
        "name": config["name"],
        "postgres_port": services["postgres"]["ports"][0]["published"],
        "redis_port": services["redis"]["ports"][0]["published"],
        "volumes": set(config["volumes"]),
    }


def test_two_checkouts_do_not_share_project_volume_or_ports(tmp_path: Path) -> None:
    checkouts = []
    for name in ("worktree-a", "worktree-b"):
        root = tmp_path / name
        root.mkdir()
        shutil.copy(ROOT / "compose.yml", root / "compose.yml")
        write_env(root)
        checkouts.append(resolved(root))
    a, b = checkouts
    assert a["name"] != b["name"]
    assert a["postgres_port"] != b["postgres_port"]
    assert a["redis_port"] != b["redis_port"]
    assert a["volumes"] == b["volumes"] == {"postgres-data"}
    assert a["name"] != "paxpivot" and b["name"] != "paxpivot"
