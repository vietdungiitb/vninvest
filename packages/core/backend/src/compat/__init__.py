"""
Compat app - Temporary shim layer for legacy API routes.

This app exists solely to host legacy compatibility views during migration.
All views here are TEMPORARY and scheduled for removal.

Migration Target: All routes should move to their respective domain apps
under /core/v1/ namespace with proper versioning.

Migration tickets (W6 — every TEMPORARY route has ticket + target date;
see urls.py for the live tracking table):
- COMPAT-001 (market_serving RealtimeWhaleFeedAggregateView → native alias):
  owner BE, target 2026-10-15. View already serves from core signal tables
  (market_serving/legacy_views.py:409); remaining work is cutover
  market_serving/urls.py:30 to the native view name + FE adapter switch.
- COMPAT-002 (compat app sunset): owner BE, target 2026-11-30. Remove shim
  only when COMPAT-001 DONE and no other legacy import remains.

DO NOT ADD NEW CODE HERE. Add to the appropriate domain app instead.
"""
default_app_config = 'compat.apps.CompatConfig'