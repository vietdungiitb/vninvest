import os
import sys
os.environ['DJANGO_ALLOWED_HOSTS'] = 'localhost,127.0.0.1'
os.environ['DJANGO_SETTINGS_MODULE'] = 'vninvest_core.settings'
sys.argv = ['pytest', 'tests/test_advisory_api_routes.py', '-xvs', '-k', 'AdvisoryLatestHistoryUserScopingTests']
import pytest
pytest.main(sys.argv[1:])
