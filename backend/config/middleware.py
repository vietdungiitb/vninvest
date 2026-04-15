from django.utils.deprecation import MiddlewareMixin

class AllowIframeMiddleware(MiddlewareMixin):
    def process_response(self, request, response):
        # Cho phép nhúng iframe từ mọi domain (hoặc chỉnh sửa theo domain cụ thể)
        response['X-Frame-Options'] = 'ALLOWALL'
        # CSP cho phép frame/iframe từ mọi nguồn (hoặc chỉnh sửa theo domain cụ thể)
        response['Content-Security-Policy'] = "frame-ancestors *;"
        return response
