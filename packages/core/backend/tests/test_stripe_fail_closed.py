"""Stripe fail-closed: gia tri la KHONG QUEN THI KHONG cap quyen.

## Bang chung goc (2 loi doc tu file that)

1. `commercial/stripe_webhooks.py:113` (cu) `_plan_from_price_id` het bang
   `return 'pro'  # fallback`. Mot price_id bat ky - price Stripe moi them, hoac
   price ta chua cau hinh - deu **im lang** cap plan `pro`.

2. `:292` (cu) `return mapping.get(stripe_status, ACTIVE)`. Mot subscription status
   chua phan loai - ke ca status Stripe moi them - van giữ subscription **day du
   quyen**.

Ca hai deu la **fail-open**: gia tri ma ta khong biet, va ta van gia dinh la
thuận loi.

## Vi sao raise la dung, khong phai tra loi

`post()` (:92-95) bat moi exception, log, va tra 200 de Stripe khong retry. Raise
o day ⇒ handler dung truoc khi ghi ⇒ **khong co gi duoc ghi**, va loi van duoc
ghi nhan. Day la fail-closed: so ghi = 0, khong phai "cap nham gi do va dua tin
vao log".

## Ranh gioi can giu nguyen

`map` goc **co** tinh phan loai het 6 status Stripe. Cac status do khong duoc doi
ve khong - chi status **la** la bi tu choi.
"""

import os
import sys

_src_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'src'))
if _src_dir not in sys.path:
    sys.path.insert(0, _src_dir)

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'vninvest_core.settings')

import django

django.setup()

from django.test import SimpleTestCase
from unittest import mock

from commercial.models import Subscription
from commercial.stripe_webhooks import (
    StripeUnknownPlan,
    StripeUnknownStatus,
    StripeWebhookView,
)
from commercial import stripe_webhooks


def _view():
    return StripeWebhookView()


class PlanFromPriceIdTests(SimpleTestCase):
    """A5: price_id la -> cap plan; price_id la -> tu choi."""

    def _with_prices(self, mapping):
        fake = mock.Mock()
        fake.price_ids = mapping
        return mock.patch.object(stripe_webhooks, 'stripe_service', fake)

    def test_known_price_maps_to_its_plan(self):
        with self._with_prices({'basic': 'price_basic', 'pro': 'price_pro'}):
            self.assertEqual(_view()._plan_from_price_id('price_pro'), 'pro')
            self.assertEqual(_view()._plan_from_price_id('price_basic'), 'basic')

    def test_unknown_price_refuses_instead_of_granting_pro(self):
        with self._with_prices({'basic': 'price_basic', 'pro': 'price_pro'}):
            with self.assertRaises(StripeUnknownPlan):
                _view()._plan_from_price_id('price_brand_new_from_stripe')

    def test_empty_config_refuses_every_price(self):
        """Khong cau hinh gi thi khong duoc cap gi ca."""
        with self._with_prices({}):
            with self.assertRaises(StripeUnknownPlan):
                _view()._plan_from_price_id('price_anything')

    def test_refusal_message_lists_configured_prices(self):
        with self._with_prices({'pro': 'price_pro'}):
            with self.assertRaises(StripeUnknownPlan) as ctx:
                _view()._plan_from_price_id('price_typo')
        self.assertIn('price_pro', str(ctx.exception))


class MapStripeStatusTests(SimpleTestCase):
    """A6: status da phan loai -> giu nguyen; status la -> tu choi."""

    def test_every_classified_status_is_unchanged(self):
        view = _view()
        cases = {
            'active': Subscription.StatusChoices.ACTIVE,
            'trialing': Subscription.StatusChoices.TRIALING,
            'past_due': Subscription.StatusChoices.PAST_DUE,
            'canceled': Subscription.StatusChoices.CANCELLED,
            'incomplete': Subscription.StatusChoices.PAST_DUE,
            'incomplete_expired': Subscription.StatusChoices.CANCELLED,
            'unpaid': Subscription.StatusChoices.PAST_DUE,
        }
        for stripe_status, expected in cases.items():
            with self.subTest(status=stripe_status):
                self.assertEqual(view._map_stripe_status(stripe_status), expected)

    def test_unknown_status_refuses_instead_of_defaulting_active(self):
        with self.assertRaises(StripeUnknownStatus):
            _view()._map_stripe_status('paused_by_stripe_in_2027')

    def test_empty_status_refuses(self):
        with self.assertRaises(StripeUnknownStatus):
            _view()._map_stripe_status('')

    def test_refusal_message_lists_known_statuses(self):
        with self.assertRaises(StripeUnknownStatus) as ctx:
            _view()._map_stripe_status('who_knows')
        self.assertIn('active', str(ctx.exception))