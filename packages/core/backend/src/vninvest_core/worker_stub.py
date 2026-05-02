import os
import time

from .stub_heartbeat import write_heartbeat


def main():
    interval_seconds = float(os.getenv("CORE_STUB_INTERVAL_SECONDS", "30"))
    heartbeat_path = write_heartbeat(
        "core-worker",
        interval_seconds,
        "started",
        "/tmp/vninvest-core-worker-health.json",
    )
    print(f"[vninvest-core] worker stub started ({heartbeat_path})", flush=True)
    while True:
        time.sleep(interval_seconds)
        write_heartbeat(
            "core-worker",
            interval_seconds,
            "heartbeat",
            "/tmp/vninvest-core-worker-health.json",
        )
        print("[vninvest-core] worker stub heartbeat", flush=True)


if __name__ == "__main__":
    main()