#!/usr/bin/env python
import os
import sys
import django

sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'backend'))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from django.contrib.auth.models import User
from rest_framework_simplejwt.tokens import RefreshToken

user, _ = User.objects.get_or_create(username='test_api', defaults={'email': 'test@test.com'})
token = str(RefreshToken.for_user(user).access_token)
print(token)
