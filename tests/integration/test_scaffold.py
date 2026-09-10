import socket
import subprocess
import sys
import time

import httpx
import pytest
from paxpivot.tooling import empty_database_check

pytestmark = pytest.mark.integration


def test_baseline_on_empty_database() -> None:
    empty_database_check()


def test_api_process_boots() -> None:
    with socket.socket() as sock:
        sock.bind(("127.0.0.1", 0))
        port = sock.getsockname()[1]
    process = subprocess.Popen(
        [
            sys.executable,
            "-m",
            "uvicorn",
            "paxpivot.api:app",
            "--host",
            "127.0.0.1",
            "--port",
            str(port),
            "--no-access-log",
        ],
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )
    try:
        for _ in range(100):
            assert process.poll() is None, "API exited during startup"
            try:
                response = httpx.get(f"http://127.0.0.1:{port}/health", timeout=1)
                assert response.status_code == 200
                assert response.json() == {"status": "ok"}
                return
            except httpx.ConnectError:
                time.sleep(0.1)
        pytest.fail("API startup timed out")
    finally:
        process.terminate()
        process.wait(timeout=10)
