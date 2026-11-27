"""Test-only env: tắt backoff CafeF để test S4 không sleep 70s thật."""
import os

os.environ.setdefault('CAFEF_BACKOFF_BASE', '0')
