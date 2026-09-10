"""Root Makefile support; local development only, never production orchestration."""

import hashlib
import os
import platform
import secrets
import signal
import subprocess
import sys
import time
from dataclasses import dataclass
from pathlib import Path
from uuid import uuid4

from alembic import command
from alembic.config import Config
from alembic.runtime.migration import MigrationContext
from alembic.script import ScriptDirectory
from dotenv import load_dotenv
from sqlalchemy import create_engine, text
from sqlalchemy.engine import make_url

ROOT = Path(__file__).resolve().parents[3]


def configure() -> Config:
    load_dotenv(ROOT / ".env", override=False)
    return Config(str(ROOT / "apps/api/alembic.ini"))


def migration_check() -> None:
    config = configure()
    heads = ScriptDirectory.from_config(config).get_heads()
    if len(heads) != 1:
        raise RuntimeError("Expected exactly one migration head")
    with create_engine(os.environ["DATABASE_URL"]).connect() as connection:
        if set(MigrationContext.configure(connection).get_current_heads()) != set(heads):
            raise RuntimeError("Database is not at the current migration head")
        connection.execute(text("SELECT PostGIS_Version()"))
    command.check(config)


@dataclass(frozen=True)
class LocalIdentity:
    """Per-checkout Compose project name and loopback ports; see ADR-002."""

    project: str
    postgres_port: int
    redis_port: int


LEGACY_IDENTITY = LocalIdentity("paxpivot", 55432, 56379)


def local_identity(root: Path) -> LocalIdentity:
    """Derive a stable identity from the checkout path so worktrees never share a volume."""
    digest = hashlib.sha256(str(root.resolve()).encode()).hexdigest()
    # ponytail: hashed ports can collide across checkouts; pick free ports if that ever bites.
    offset = int(digest[:8], 16) % 4000
    return LocalIdentity(f"paxpivot-{digest[:10]}", 50000 + offset, 54000 + offset)


def _env_lines(identity: LocalIdentity, password: str | None) -> list[str]:
    lines = [
        f"COMPOSE_PROJECT_NAME={identity.project}",
        f"POSTGRES_PORT={identity.postgres_port}",
        f"REDIS_PORT={identity.redis_port}",
    ]
    if password is not None:
        lines += [
            f"POSTGRES_PASSWORD={password}",
            "DATABASE_URL=postgresql+psycopg://paxpivot:"
            f"{password}@127.0.0.1:{identity.postgres_port}/paxpivot",
            f"REDIS_URL=redis://127.0.0.1:{identity.redis_port}/0",
        ]
    return lines


def write_env(root: Path) -> Path:
    """Create .env for a fresh checkout, or add missing identity keys to an existing one.

    A pre-ADR-002 .env has credentials but no identity; it keeps the legacy project name and
    ports so its already-initialised volume stays usable. Existing values are never rewritten.
    """
    path = root / ".env"
    if not path.exists():
        fd = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
        with os.fdopen(fd, "w") as file:
            file.write("\n".join(_env_lines(local_identity(root), secrets.token_hex(24))) + "\n")
        return path
    existing = path.read_text()
    if "COMPOSE_PROJECT_NAME=" not in existing:
        with path.open("a") as file:
            if existing and not existing.endswith("\n"):
                file.write("\n")
            file.write("\n".join(_env_lines(LEGACY_IDENTITY, None)) + "\n")
    return path


def setup_env() -> None:
    if platform.python_version() != (ROOT / ".python-version").read_text().strip():
        raise RuntimeError("Use the Python version in .python-version")
    actual_node = subprocess.check_output(["node", "--version"], text=True).strip().lstrip("v")
    if actual_node != (ROOT / ".node-version").read_text().strip():
        raise RuntimeError("Use the Node version in .node-version")
    write_env(ROOT)
    print("Local environment ready; existing values preserved.")


def empty_database_check() -> None:
    """Create a unique database, migrate it, check drift, always remove only that DB."""
    config = configure()
    url = make_url(os.environ["DATABASE_URL"])
    if url.host not in {"127.0.0.1", "localhost"}:
        raise RuntimeError("Migration test is restricted to local databases")
    name = "paxpivot_test_" + uuid4().hex
    admin = create_engine(url, isolation_level="AUTOCOMMIT")
    original = os.environ["DATABASE_URL"]
    with admin.connect() as connection:
        connection.execute(text(f'CREATE DATABASE "{name}" TEMPLATE template0'))
    try:
        os.environ["DATABASE_URL"] = url.set(database=name).render_as_string(hide_password=False)
        command.upgrade(config, "head")
        migration_check()
        command.upgrade(config, "head")  # Idempotent migration invocation.
        # Prove drift detection actually fails for unexpected application tables.
        engine = create_engine(os.environ["DATABASE_URL"])
        with engine.begin() as connection:
            connection.execute(text("CREATE TABLE unexpected_drift (id integer)"))
        try:
            command.check(config)
        except Exception as exc:
            from alembic.util.exc import AutogenerateDiffsDetected

            if not isinstance(exc, AutogenerateDiffsDetected):
                raise
        else:
            raise RuntimeError("Migration drift was not detected")
        with engine.begin() as connection:
            connection.execute(text("DROP TABLE unexpected_drift"))
        engine.dispose()
        migration_check()
        command.downgrade(config, "base")
        command.upgrade(config, "head")
        migration_check()
        print("Empty database baseline, repeat upgrade, drift detection and roundtrip: PASS")
    finally:
        os.environ["DATABASE_URL"] = original
        with admin.connect() as connection:
            connection.execute(text(f'DROP DATABASE "{name}" WITH (FORCE)'))
        admin.dispose()


def dev() -> None:
    configure()
    subprocess.run(["docker", "compose", "up", "-d", "--wait"], cwd=ROOT, check=True)
    command.upgrade(configure(), "head")
    children = [
        subprocess.Popen(
            [
                sys.executable,
                "-m",
                "uvicorn",
                "paxpivot.api:app",
                "--host",
                "127.0.0.1",
                "--port",
                "8000",
                "--reload",
                "--no-access-log",
            ],
            cwd=ROOT,
        ),
        subprocess.Popen(["pnpm", "--filter", "web", "dev"], cwd=ROOT, start_new_session=True),
    ]
    try:
        while all(child.poll() is None for child in children):
            time.sleep(0.5)
    except KeyboardInterrupt:
        pass
    finally:
        for index, child in enumerate(children):
            if child.poll() is None:
                if index == 1:
                    os.killpg(child.pid, signal.SIGTERM)
                else:
                    child.terminate()
        for child in children:
            child.wait(timeout=10)


if __name__ == "__main__":
    action = sys.argv[1]
    if action == "setup-env":
        setup_env()
    elif action == "migrate":
        command.upgrade(configure(), "head")
    elif action == "migrate-check":
        migration_check()
    elif action == "migrate-test":
        empty_database_check()
    elif action == "dev":
        dev()
    else:
        raise SystemExit("Unknown command")
