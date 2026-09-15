"""
Compat app - Temporary shim layer for legacy API routes.

This app exists solely to host legacy compatibility views during migration.
All views here are TEMPORARY and scheduled for removal.

Migration Target: All routes should move to their respective domain apps
under /core/v1/ namespace with proper versioning.

Migration tickets (W6 — every TEMPORARY route has ticket + target date;
see urls.py for the live tracking table):
- COMPAT-001 (market_serving RealtimeWhaleFeedAggregateView → native alias):
  owner BE, target 2026-10-15. **DONE 2026-09-15**: route cutover
  market_serving/urls.py:30 → native_views.RealtimeWhaleFeedAggregateView
  (name 'realtime-whale-feed-aggregate'), FE adapter đã trỏ native
  (getWhaleAnalyticsSnapshotEndpoint → /workspace/whale-analytics/). Class
  body vẫn re-export từ legacy_views.py — việc relocate vật lý + xoá
  legacy_views.py được gom vào COMPAT-002.
- COMPAT-002 (compat app sunset): owner BE, target 2026-11-30. Remove shim
  only when COMPAT-001 DONE and no other legacy import remains. Bao gồm:
  relocate class body whale-feed-aggregate vào native_views.py, xoá
  legacy_views.py (RealtimeWhaleCampaignsView không được route ở đâu cả).

DO NOT ADD NEW CODE HERE. Add to the appropriate domain app instead.
"""
default_app_config = 'compat.apps.CompatConfig'