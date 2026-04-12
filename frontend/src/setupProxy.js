const { createProxyMiddleware } = require('http-proxy-middleware');

// QUAN TRỌNG: Dùng `pathFilter` bên trong createProxyMiddleware thay vì
// `app.use('/api', ...)` để Express KHÔNG tự strip prefix '/api'.
// Nếu dùng app.use('/api', proxy), Express truyền '/realtime/...' (đã strip)
// xuống backend → Django nhận sai path → 404.
module.exports = function(app) {
  // API REST — giữ nguyên /api prefix khi forward đến Django
  app.use(
    createProxyMiddleware({
      pathFilter: '/api',
      target: 'http://localhost:8000',
      changeOrigin: true,
    })
  );

  // WebSocket realtime
  app.use(
    createProxyMiddleware({
      pathFilter: '/ws',
      target: 'http://localhost:8000',
      ws: true,
      changeOrigin: true,
    })
  );
};
