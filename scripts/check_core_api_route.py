import os
from django.urls import resolve

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "vninvest_core.settings")

import django

django.setup()

import vninvest_core.urls as urls_module

print(urls_module.__file__)

for path in ("/core/v1/health", "/api/health/", "/api/health"):
    try:
        match = resolve(path)
        print(path, "->", match.view_name)
    except Exception as exc:
        print(path, "->", type(exc).__name__)
