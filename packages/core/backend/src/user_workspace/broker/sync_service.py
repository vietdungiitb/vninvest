"""Wave 1 B1.1: BrokerSyncService — cua ngo dieu phoi sync da-broker.

Vai tro (ADR-006): tang DIEU PHOI thuoc vninvest (lay credential tu
UserBrokerConfig, mo adapter, truyen error code). Mọi I/O broker that nam
trong `broker/adapters.py` + thu vien vnbroker — service nay KHONG goi mang
truc tiep, KHONG chua logic protocol.

Wave 1 sau (B1.3+) dung service nay de viet PositionSnapshot/AccountSnapshot
thay vi goi adapter roi rac nhu `tasks.py` DNSE hien tai.
"""
from __future__ import annotations

from .adapters import (
    BrokerAccount,
    BrokerAdapter,
    BrokerAdapterError,
    BrokerBalance,
    BrokerOrder,
    BrokerPosition,
    get_broker_adapter,
)

CODE_CONFIG_MISSING = 'broker_config_missing'


class BrokerConfigMissingError(BrokerAdapterError):
    """Chua cau hinh credential cho (user, provider)."""

    def __init__(self, provider: str = ''):
        super().__init__(
            f'Chua cau hinh broker: {provider}', code=CODE_CONFIG_MISSING)


class BrokerSyncService:
    """Wrap mot BrokerAdapter + biet minh dang phuc vu provider nao.

    Nhan adapter da dung san (inject de test khong can I/O). Factory
    `for_config`/`for_user` dung adapter that (lazy, khong ket noi luc dung).
    """

    def __init__(self, adapter: BrokerAdapter):
        self.adapter = adapter

    @property
    def provider_id(self) -> str:
        return self.adapter.provider_id

    @classmethod
    def for_config(cls, config, adapter_cls=None) -> BrokerSyncService:
        """Dung service tu mot UserBrokerConfig (secrets giai ma tu DB)."""
        from ..models import UserBrokerConfig as _UBC

        if not isinstance(config, _UBC):
            raise BrokerAdapterError(
                f'config khong phai UserBrokerConfig: {type(config).__name__}',
                code='broker_config_invalid',
            )
        provider = str(config.provider or '').strip().lower()
        secrets = config.get_secrets() or {}
        if adapter_cls is None:
            adapter = get_broker_adapter(provider, **dict(secrets))
        else:
            adapter = adapter_cls(**dict(secrets))
        return cls(adapter)

    @classmethod
    def for_user(cls, user, provider: str, label: str = 'Mặc định',
                 tenant=None) -> BrokerSyncService:
        """Giai (user, provider[, label, tenant]) -> service. Thieu config
        => BrokerConfigMissingError (fail-closed, co code)."""
        from ..models import get_user_broker_config

        normalized = str(provider or '').strip().lower()
        config = get_user_broker_config(user, normalized, label, tenant=tenant)
        if config is None:
            raise BrokerConfigMissingError(normalized)
        return cls.for_config(config)

    # -- Uy thac doc (read-only o Wave 1) -------------------------------
    def list_accounts(self) -> list[BrokerAccount]:
        return self.adapter.list_accounts()

    def get_balance(self, account_no: str) -> BrokerBalance:
        return self.adapter.get_balance(account_no)

    def get_positions(self, account_no: str) -> list[BrokerPosition]:
        return self.adapter.get_positions(account_no)

    def get_orders(self, account_no: str) -> list[BrokerOrder]:
        return self.adapter.get_orders(account_no)
