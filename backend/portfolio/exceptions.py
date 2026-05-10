class PortfolioAppException(Exception):
    default_message = 'Đã xảy ra lỗi ứng dụng.'

    def __init__(self, message=None, *, code=None, payload=None):
        resolved_message = message or self.default_message
        super().__init__(resolved_message)
        self.message = resolved_message
        self.code = code
        self.payload = payload or {}


class MarketDataValidationException(PortfolioAppException):
    default_message = 'Yêu cầu dữ liệu thị trường không hợp lệ.'


class ExternalSystemException(PortfolioAppException):
    default_message = 'Không lấy được dữ liệu từ hệ thống bên ngoài.'


class BusinessLogicRuleException(PortfolioAppException):
    default_message = 'Yêu cầu không thỏa điều kiện nghiệp vụ.'
