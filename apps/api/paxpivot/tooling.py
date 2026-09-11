"""Root Makefile support; local development only, never production orchestration."""

import hashlib
import os
import platform
import secrets
import signal
import subprocess
import sys
import time
from collections.abc import Iterator
from contextlib import contextmanager
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


@contextmanager
def temporary_database() -> Iterator[str]:
    """A unique local database, migrated to head, dropped afterwards. Yields its URL.

    DATABASE_URL is pointed at it for the duration so Alembic and the API composition root
    see the same database.
    """
    config = configure()
    url = make_url(os.environ["DATABASE_URL"])
    if url.host not in {"127.0.0.1", "localhost"}:
        raise RuntimeError("Temporary databases are restricted to local servers")
    name = "paxpivot_test_" + uuid4().hex
    admin = create_engine(url, isolation_level="AUTOCOMMIT")
    original = os.environ["DATABASE_URL"]
    with admin.connect() as connection:
        connection.execute(text(f'CREATE DATABASE "{name}" TEMPLATE template0'))
    try:
        temp_url = url.set(database=name).render_as_string(hide_password=False)
        os.environ["DATABASE_URL"] = temp_url
        command.upgrade(config, "head")
        yield temp_url
    finally:
        os.environ["DATABASE_URL"] = original
        with admin.connect() as connection:
            connection.execute(text(f'DROP DATABASE "{name}" WITH (FORCE)'))
        admin.dispose()


def empty_database_check() -> None:
    """Migrate a fresh database, check drift, seed twice, roundtrip; remove only that DB."""
    config = configure()
    with temporary_database():
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
        migration_check()
        # Reference data is idempotent: the second run inserts nothing and changes nothing.
        from paxpivot.infrastructure.bootstrap import seed_reference_data

        first = seed_reference_data(engine)
        second = seed_reference_data(engine)
        if not any(first.values()) or any(second.values()):
            raise RuntimeError(f"Seed is not idempotent: {first} then {second}")
        # The CHECK contract (which `alembic check` cannot see) holds on the deployed schema.
        from paxpivot.infrastructure.schema_probe import verify_check_parity

        with engine.connect() as connection:
            parity = verify_check_parity(connection)
            connection.rollback()
        engine.dispose()
        command.downgrade(config, "base")
        command.upgrade(config, "head")
        migration_check()
        print(
            "Empty database baseline, drift detection, idempotent seed, "
            f"{parity.constraints_verified} CHECK rules and roundtrip: PASS"
        )


def cold_start_check(cycles: int) -> None:
    """Prove Compose readiness: after `up --wait`, the first connection must succeed at once.

    Each cycle wipes the local volume (first-boot path, where the race lived), starts the
    services, then immediately runs `SELECT 1` and a temporary-database create/migrate/drop with
    no retry anywhere. Local development only: it destroys this checkout's database.
    """
    if cycles < 1:
        raise ValueError("cycles must be at least 1")
    config = configure()
    for cycle in range(1, cycles + 1):
        # Compose output stays visible: on the failure path it is the only diagnostic.
        subprocess.run(["docker", "compose", "down", "--volumes"], cwd=ROOT, check=True)
        started = time.monotonic()
        subprocess.run(["docker", "compose", "up", "-d", "--wait"], cwd=ROOT, check=True)
        waited = time.monotonic() - started
        engine = create_engine(os.environ["DATABASE_URL"])
        with engine.connect() as connection:
            connection.execute(text("SELECT 1"))
        engine.dispose()
        with temporary_database():
            pass
        print(f"cycle {cycle}/{cycles}: --wait {waited:.1f}s, SELECT 1 and temporary database OK")
    command.upgrade(config, "head")  # Leave the checkout database migrated, as `make dev` would.
    print(f"Cold start check: {cycles}/{cycles} cycles connected immediately after --wait")


def seed() -> None:
    from paxpivot.infrastructure.bootstrap import seed_reference_data

    configure()
    inserted = seed_reference_data(create_engine(os.environ["DATABASE_URL"]))
    print(f"Reference data: inserted {inserted}; existing rows preserved.")


def dev() -> None:
    configure()
    subprocess.run(["docker", "compose", "up", "-d", "--wait"], cwd=ROOT, check=True)
    command.upgrade(configure(), "head")
    seed()
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
    elif action == "seed":
        seed()
    elif action == "cold-start-check":
        cold_start_check(int(sys.argv[2]) if len(sys.argv) > 2 else 20)
    elif action == "dev":
        dev()
    else:
        raise SystemExit("Unknown command")
