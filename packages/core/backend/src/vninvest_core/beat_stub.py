import os
import time

from .stub_heartbeat import write_heartbeat


def main():
    interval_seconds = float(os.getenv("CORE_STUB_INTERVAL_SECONDS", "30"))
    heartbeat_path = write_heartbeat(
        "core-beat",
        interval_seconds,
        "started",
        "/tmp/vninvest-core-beat-health.json",
    )
    print(f"[vninvest-core] beat stub started ({heartbeat_path})", flush=True)
    while True:
        time.sleep(interval_seconds)
        write_heartbeat(
            "core-beat",
            interval_seconds,
            "tick",
            "/tmp/vninvest-core-beat-health.json",
        )
        print("[vninvest-core] beat stub tick", flush=True)


if __name__ == "__main__":
    main()