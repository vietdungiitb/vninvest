import os
import time


def main():
    interval_seconds = float(os.getenv("CORE_STUB_INTERVAL_SECONDS", "30"))
    print("[vninvest-core] beat stub started")
    while True:
        time.sleep(interval_seconds)
        print("[vninvest-core] beat stub tick")


if __name__ == "__main__":
    main()