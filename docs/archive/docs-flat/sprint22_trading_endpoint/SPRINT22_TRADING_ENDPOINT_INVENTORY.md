# Sprint 22 - Trading endpoint inventory va transaction boundary

Trang thai: IMPLEMENTED (backend inventory + skeleton boundary)

## 1) Endpoint inventory (legacy -> refactored)

| Domain | Endpoint | Method | Legacy view | Refactored view | Serializer | Auth | Transaction boundary |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| Portfolio | /api/portfolio/portfolios/ | GET, POST | PortfolioListCreateView | trading_views.PortfolioListCreateView | PortfolioSerializer | JWT | POST trong transaction.atomic |
| Portfolio | /api/portfolio/portfolios/{pk}/ | GET, PUT, PATCH, DELETE | PortfolioDetailView | trading_views.PortfolioDetailView | PortfolioSerializer | JWT | DRF default per request |
| SubAccount | /api/portfolio/subaccounts/ | GET, POST | SubAccountListCreateView | trading_views.SubAccountListCreateView | SubAccountSerializer | JWT | POST trong transaction.atomic |
| SubAccount | /api/portfolio/subaccounts/{pk}/ | GET, PUT, PATCH, DELETE | SubAccountDetailView | trading_views.SubAccountDetailView | SubAccountSerializer | JWT | DRF default per request |
| Transaction | /api/portfolio/subaccounts/{sub_account_id}/transactions/ | GET, POST | TransactionListCreateView | trading_views.TransactionListCreateView | TransactionSerializer | JWT | POST trong transaction.atomic |
| Transaction | /api/portfolio/transactions/{pk}/ | GET, PUT, PATCH, DELETE | TransactionDetailView | trading_views.TransactionDetailView | TransactionSerializer | JWT | DRF default per request |

## 2) Business rules da map vao service boundary

- Portfolio create: auto bind voi request.user.
- SubAccount create: bat buoc user phai co it nhat 1 portfolio, neu khong -> 400 ValidationError.
- Transaction create: sub_account_id phai thuoc user dang dang nhap, neu khong -> 404.
- Transaction symbol validation: thong qua TransactionSerializer.validate_symbol (StockProfile phai ton tai).

## 3) Toggle / rollout strategy

- Feature flag: ENABLE_NEW_TRADING_VIEWS (default false).
- Routing point: backend/portfolio/urls.py (helper _toggle_trading_view).
- Rollback: tat flag de quay lai legacy views ma khong can deploy code moi.

## 4) Dependencies

- Models: Portfolio, SubAccount, Transaction, StockProfile.
- Serializer: PortfolioSerializer, SubAccountSerializer, TransactionSerializer.
- Permission: IsAuthenticated (JWT).

## 5) Test coverage toi thieu da them

- Toggle route sang trading_views khi ENABLE_NEW_TRADING_VIEWS=true.
- Error path: tao SubAccount khi user chua co Portfolio -> 400.
- Critical auth boundary: tao Transaction voi sub_account cua user khac -> 404.
