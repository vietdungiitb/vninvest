"""
benchmark_api.py — Đo latency các endpoint realtime trước/sau tối ưu hóa.

Chạy: python benchmark_api.py
Yêu cầu: backend đang chạy tại http://127.0.0.1:8000
         user hợp lệ trong DB (đặt USERNAME/PASSWORD bên dưới)
"""
from __future__ import annotations

import concurrent.futures
import statistics
import time
from typing import Callable

import requests

# ─── Cấu hình ──────────────────────────────────────────────────────────────
BASE_URL  = "http://127.0.0.1:8000"
USERNAME  = "testuser"
PASSWORD  = "Test@123456"          # đổi nếu cần
SYMBOLS   = ["HPG", "VCB", "FPT", "MWG", "VNM"]
CONCURRENCY = 5              # số request đồng thời
ROUNDS      = 3              # số vòng đo cho mỗi endpoint
SEP = "─" * 68
# ───────────────────────────────────────────────────────────────────────────


def login(username: str, password: str) -> str:
    """Lấy JWT access token."""
    resp = requests.post(
        f"{BASE_URL}/api/auth/token/",
        json={"username": username, "password": password},
        timeout=10,
    )
    resp.raise_for_status()
    token = resp.json().get("access")
    if not token:
        raise ValueError(f"Không lấy được token: {resp.json()}")
    return token


def timed_get(url: str, headers: dict, label: str) -> dict:
    """Gửi GET và trả về dict gồm label, status, latency_ms, source."""
    t0 = time.perf_counter()
    try:
        r = requests.get(url, headers=headers, timeout=30)
        latency = (time.perf_counter() - t0) * 1000
        try:
            body = r.json()
        except Exception:
            body = {}
        return {
            "label": label,
            "status": r.status_code,
            "latency_ms": round(latency, 1),
            "source": body.get("source", "—"),
            "stale": body.get("stale"),
        }
    except Exception as exc:
        latency = (time.perf_counter() - t0) * 1000
        return {
            "label": label,
            "status": "ERR",
            "latency_ms": round(latency, 1),
            "source": str(exc)[:40],
            "stale": None,
        }


def bench_sequential(
    endpoint_fn: Callable[[str], str],
    symbols: list[str],
    headers: dict,
    rounds: int = 3,
) -> dict:
    """Đo latency sequential qua nhiều vòng."""
    all_latencies: list[float] = []
    results = []
    for _ in range(rounds):
        for sym in symbols:
            url = endpoint_fn(sym)
            r = timed_get(url, headers, sym)
            all_latencies.append(r["latency_ms"])
            results.append(r)
    return {
        "results": results,
        "mean_ms": round(statistics.mean(all_latencies), 1),
        "median_ms": round(statistics.median(all_latencies), 1),
        "p95_ms": round(sorted(all_latencies)[int(len(all_latencies) * 0.95)], 1),
        "max_ms": round(max(all_latencies), 1),
        "min_ms": round(min(all_latencies), 1),
    }


def bench_concurrent(
    endpoint_fn: Callable[[str], str],
    symbols: list[str],
    headers: dict,
    concurrency: int = 5,
) -> dict:
    """Bắn đồng thời concurrency request, đo wall-clock time."""
    tasks = [(endpoint_fn(s), headers, s) for s in symbols[:concurrency]]
    t0 = time.perf_counter()
    with concurrent.futures.ThreadPoolExecutor(max_workers=concurrency) as ex:
        futures = [ex.submit(timed_get, url, h, lbl) for url, h, lbl in tasks]
        results = [f.result() for f in concurrent.futures.as_completed(futures)]
    wall = (time.perf_counter() - t0) * 1000
    latencies = [r["latency_ms"] for r in results]
    return {
        "results": results,
        "wall_ms": round(wall, 1),
        "mean_ms": round(statistics.mean(latencies), 1),
        "max_ms": round(max(latencies), 1),
        "concurrency": concurrency,
    }


def print_table(title: str, bench: dict, show_source: bool = True) -> None:
    print(f"\n{'─'*68}")
    print(f"  {title}")
    print(f"{'─'*68}")
    for r in bench["results"]:
        src = f"  [{r['source']}]" if show_source else ""
        stale = " STALE" if r.get("stale") else ""
        print(f"  {r['label']:6}  {r['status']:5}  {r['latency_ms']:8.1f}ms{stale}{src}")
    print(f"{'─'*68}")
    if "wall_ms" in bench:
        print(f"  Wall-clock ({bench['concurrency']} concurrent): {bench['wall_ms']:.1f}ms")
    print(
        f"  mean={bench['mean_ms']}ms  "
        f"median={bench.get('median_ms','─')}ms  "
        f"p95={bench.get('p95_ms','─')}ms  "
        f"max={bench['max_ms']}ms"
    )


def main() -> None:
    print(SEP)
    print("  VNInvest API Benchmark")
    print(SEP)

    # ── 1. Login ──────────────────────────────────────────────────────────
    print(f"\n[1] Login {USERNAME}@{BASE_URL} ...", end=" ", flush=True)
    try:
        token = login(USERNAME, PASSWORD)
    except Exception as exc:
        print(f"FAIL: {exc}")
        print("→ Đặt USERNAME/PASSWORD đúng trong benchmark_api.py rồi chạy lại.")
        return
    headers = {"Authorization": f"Bearer {token}"}
    print("OK")

    # ── 2. Warm-up: 1 lần để đảm bảo DB connection pool sẵn sàng ──────────
    print("[2] Warm-up ...", end=" ", flush=True)
    for sym in SYMBOLS[:2]:
        timed_get(f"{BASE_URL}/api/realtime/ticker/{sym}/", headers, sym)
    print("OK")

    # ── 3. Benchmark /ticker/ — sequential ───────────────────────────────
    print(f"\n[3] Benchmark /ticker/ sequential  ({ROUNDS} rounds × {len(SYMBOLS)} symbols)")
    seq = bench_sequential(
        lambda s: f"{BASE_URL}/api/realtime/ticker/{s}/",
        SYMBOLS, headers, rounds=ROUNDS,
    )
    print_table("/api/realtime/ticker/<sym>/  — sequential", seq)

    # ── 4. Benchmark /ticker/ — concurrent ───────────────────────────────
    print(f"\n[4] Benchmark /ticker/ concurrent  ({CONCURRENCY} simultaneous)")
    con = bench_concurrent(
        lambda s: f"{BASE_URL}/api/realtime/ticker/{s}/",
        SYMBOLS, headers, concurrency=CONCURRENCY,
    )
    print_table("/api/realtime/ticker/<sym>/  — concurrent", con)

    # ── 5. Benchmark /admin/ response time ───────────────────────────────
    print("\n[5] Admin page latency (không nên bị delay bởi vnstock)")
    t0 = time.perf_counter()
    r = requests.get(f"{BASE_URL}/admin/", headers=headers, timeout=15, allow_redirects=True)
    admin_ms = round((time.perf_counter() - t0) * 1000, 1)
    print(f"  /admin/  status={r.status_code}  latency={admin_ms}ms")

    # ── 6. Interlaced concurrent: ticker + admin cùng lúc ─────────────────
    print(f"\n[6] Stress: {CONCURRENCY} ticker requests + admin đồng thời")
    urls = [f"{BASE_URL}/api/realtime/ticker/{s}/" for s in SYMBOLS]
    urls.append(f"{BASE_URL}/admin/")
    t0 = time.perf_counter()
    with concurrent.futures.ThreadPoolExecutor(max_workers=len(urls)) as ex:
        futs = [ex.submit(timed_get, u, headers, u.split("/")[-2]) for u in urls]
        stress_results = [f.result() for f in concurrent.futures.as_completed(futs)]
    wall_stress = round((time.perf_counter() - t0) * 1000, 1)
    print(f"{'─'*68}")
    for r in sorted(stress_results, key=lambda x: x["label"]):
        src = f"  [{r['source']}]"
        print(f"  {r['label']:8}  {r['status']:5}  {r['latency_ms']:8.1f}ms{src}")
    print(f"{'─'*68}")
    admin_r = next((r for r in stress_results if "admin" in r["label"].lower() or r["label"] == "admin"), None)
    if admin_r:
        print(f"  /admin/ trong stress: {admin_r['latency_ms']}ms  (mục tiêu < 500ms)")
    print(f"  Wall-clock tổng: {wall_stress}ms")

    # ── 7. Summary ────────────────────────────────────────────────────────
    print(f"\n{'═'*68}")
    print("  SUMMARY")
    print(f"{'═'*68}")
    print(f"  Ticker sequential  p95 = {seq['p95_ms']}ms   max = {seq['max_ms']}ms")
    print(f"  Ticker concurrent  wall = {con['wall_ms']}ms   max = {con['max_ms']}ms")
    print(f"  Admin standalone        = {admin_ms}ms")
    if admin_r:
        print(f"  Admin under stress      = {admin_r['latency_ms']}ms")

    # Đánh giá
    ticker_ok  = seq["p95_ms"] < 300
    admin_ok   = admin_ms < 500
    stress_ok  = (admin_r["latency_ms"] < 2000) if admin_r else True
    print(f"\n  ticker p95<300ms   : {'✓ PASS' if ticker_ok  else '✗ FAIL'}")
    print(f"  admin  <500ms      : {'✓ PASS' if admin_ok   else '✗ FAIL'}")
    print(f"  admin under stress : {'✓ PASS' if stress_ok  else '✗ FAIL  (thread pool vẫn cạn kiệt)'}")
    print(f"{'═'*68}\n")


if __name__ == "__main__":
    main()
