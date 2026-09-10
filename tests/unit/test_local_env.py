"""Per-checkout local environment identity (ADR-002). No Docker required."""

import stat
from pathlib import Path

from paxpivot.tooling import LEGACY_IDENTITY, local_identity, write_env


def read_env(path: Path) -> dict[str, str]:
    return dict(line.split("=", 1) for line in path.read_text().splitlines() if "=" in line)


def test_identity_is_deterministic_per_path_and_distinct_across_paths(tmp_path: Path) -> None:
    a, b = tmp_path / "checkout-a", tmp_path / "checkout-b"
    assert local_identity(a) == local_identity(a)
    assert local_identity(a).project != local_identity(b).project
    assert local_identity(a).project.startswith("paxpivot-")
    assert local_identity(a) != LEGACY_IDENTITY


def test_ports_stay_loopback_range_and_apart(tmp_path: Path) -> None:
    identity = local_identity(tmp_path)
    assert 50000 <= identity.postgres_port < 54000
    assert 54000 <= identity.redis_port < 58000


def test_fresh_env_binds_urls_to_own_ports_and_random_secret(tmp_path: Path) -> None:
    for name in ("one", "two"):
        (tmp_path / name).mkdir()
    one = read_env(write_env(tmp_path / "one"))
    two = read_env(write_env(tmp_path / "two"))
    assert one["COMPOSE_PROJECT_NAME"] != two["COMPOSE_PROJECT_NAME"]
    assert one["POSTGRES_PASSWORD"] != two["POSTGRES_PASSWORD"]
    assert len(one["POSTGRES_PASSWORD"]) == 48
    assert one["DATABASE_URL"].endswith(f"@127.0.0.1:{one['POSTGRES_PORT']}/paxpivot")
    assert one["REDIS_URL"] == f"redis://127.0.0.1:{one['REDIS_PORT']}/0"
    mode = stat.S_IMODE((tmp_path / "one" / ".env").stat().st_mode)
    assert mode == 0o600


def test_existing_env_is_preserved_and_upgraded_to_legacy_identity(tmp_path: Path) -> None:
    path = tmp_path / ".env"
    original = (
        "POSTGRES_PASSWORD=keep-me\n"
        "DATABASE_URL=postgresql+psycopg://paxpivot:keep-me@127.0.0.1:55432/paxpivot\n"
        "REDIS_URL=redis://127.0.0.1:56379/0\n"
    )
    path.write_text(original)
    write_env(tmp_path)
    upgraded = path.read_text()
    assert upgraded.startswith(original)
    env = read_env(path)
    assert env["COMPOSE_PROJECT_NAME"] == LEGACY_IDENTITY.project
    assert env["POSTGRES_PORT"] == str(LEGACY_IDENTITY.postgres_port)
    assert env["REDIS_PORT"] == str(LEGACY_IDENTITY.redis_port)
    write_env(tmp_path)
    assert path.read_text() == upgraded, "second run must not append again"
