const { createProxyMiddleware } = require('http-proxy-middleware');

// QUAN TRỌNG: Dùng `pathFilter` bên trong createProxyMiddleware thay vì
// `app.use('/api', ...)` để Express KHÔNG tự strip prefix '/api'.
// Nếu dùng app.use('/api', proxy), Express truyền '/realtime/...' (đã strip)
// xuống backend → Django nhận sai path → 404.
module.exports = function(app) {
  // API REST — giữ nguyên /api prefix khi forward đến Django
  app.use(
    '/api',
    createProxyMiddleware({
      target: 'http://localhost:8000',
      changeOrigin: true,
    })
  );

  // WebSocket realtime — QUAN TRỌNG: chỉ proxy /ws/realtime (Django),
  // KHÔNG dùng /ws (sẽ chặn webpack HMR WebSocket → "Invalid frame header").
  app.use(
    '/ws/realtime',
    createProxyMiddleware({
      target: 'http://localhost:8000',
      ws: true,
      changeOrigin: true,
    })
  );
};
