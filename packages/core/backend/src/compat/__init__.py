"""
Compat app - Temporary shim layer for legacy API routes.

This app exists solely to host legacy compatibility views during migration.
All views here are TEMPORARY and scheduled for removal.

Migration Target: All routes should move to their respective domain apps
under /core/v1/ namespace with proper versioning.

DO NOT ADD NEW CODE HERE. Add to the appropriate domain app instead.
"""
default_app_config = 'compat.apps.CompatConfig'