# FRONTEND DESIGN: Nâng cấp Đăng ký Người dùng SaaS Native OpenAPI kèm Chống Spam
**Mã tài liệu**: `FRONTEND_DESIGN_SAAS_NATIVE_USER_REGISTRATION_SPAM_PROTECTION_20260524`  
**Ngày phát hành**: 24-05-2026  
**Trạng thái**: BAN HÀNH CHÍNH THỨC  
**Phạm vi**: Web Frontend (`packages/web`)  

---

## 1. THIẾT KẾ GIAO DIỆN & MỸ THUẬT CAO CẤP (PREMIUM DESIGN SYSTEM)

Giao diện đăng ký người dùng SaaS được thiết kế theo trường phái **Glassmorphism kết hợp Sleek Dark Mode** sang trọng, mang lại cảm giác cực kỳ premium và chuyên nghiệp cho sản phẩm đầu tư tài chính VNInvest.

### 1.1 Curated Color Palette (Bảng màu tailored HSL)
- **Background**: Sleek Black Deep (`hsl(220, 25%, 5%)`)
- **Card Background (Glass)**: Dark Slate Translucent (`hsla(217, 19%, 10%, 0.65)`) với blur filter `backdrop-filter: blur(16px) saturate(180%)`
- **Border Focus**: Neon Cyan Blue (`hsl(190, 100%, 50%)`)
- **Gradients**:
  - Gold Pearl to Cyan: `linear-gradient(135deg, hsl(45, 100%, 60%) 0%, hsl(190, 100%, 50%) 100%)`
- **Typography**:
  - Dùng Google Fonts **Outfit** cho headings (`font-weight: 600` hoặc `700`) mang tính hiện đại, sắc sảo.
  - Dùng **Inter** cho body và inputs để tối ưu hoá khả năng đọc hiển thị.

### 1.2 Hiệu ứng Tương tác & Micro-animations
- **Hover Button**: Scale nhẹ `scale(1.02)` kết hợp hiệu ứng phát quang biên (`box-shadow: 0 0 20px hsla(190, 100%, 50%, 0.4)`).
- **Transitions**: Chuyển trạng thái mượt mà bằng CSS spring presets (`transition: all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1)`).
- **Error Shake**: Hộp thoại hoặc trường lỗi sẽ lắc nhẹ (shake micro-animation) khi submit lỗi để thu hút sự tập trung của người dùng.

---

## 2. TÍCH HỢP CLOUDFLARE TURNSTILE WIDGET (CAPTCHA SHIELD)

Để chống đăng ký spam tự động, frontend tích hợp Turnstile Widget của Cloudflare sử dụng thư viện `@marsview/react-turnstile`.

### 2.1 Cài đặt Thư viện & Cấu hình Widget
```bash
# Thực hiện cài đặt tại packages/web
npm install @marsview/react-turnstile
```

### 2.2 Triển khai Component React
```tsx
// Location: packages/web/src/components/auth/TurnstileWidget.tsx
import React, { useRef } from 'react';
import Turnstile from '@marsview/react-turnstile';

interface TurnstileWidgetProps {
  onVerify: (token: string) => void;
  onError?: () => void;
  onExpire?: () => void;
}

export const TurnstileWidget: React.FC<TurnstileWidgetProps> = ({ onVerify, onError, onExpire }) => {
  // Lấy sitekey từ cấu hình môi trường Vite
  const siteKey = import.meta.env.VITE_TURNSTILE_SITE_KEY || '1x00000000000000000000AA'; // Test key mặc định của Cloudflare

  return (
    <div className="turnstile-container my-4 flex justify-center">
      <Turnstile
        sitekey={siteKey}
        onSuccess={(token) => {
          onVerify(token);
        }}
        onError={() => {
          if (onError) onError();
        }}
        onExpire={() => {
          if (onExpire) onExpire();
        }}
        options={{
          theme: 'dark',
          size: 'normal',
        }}
      />
    </div>
  );
};
```

---

## 3. BẪY BOT SPAM BẰNG HONEYPOT FIELD (HIDDEN INPUT)

Trường `website` được hiển thị nhưng ẩn hoàn toàn khỏi tầm nhìn và hành vi của người dùng thật. Bots đọc cấu trúc HTML sẽ tự động điền giá trị vào đây, giúp backend nhận dạng và chặn spam ngay lập tức.

### 3.1 Styling Honeypot ẩn tuyệt đối
Chúng ta sử dụng CSS layout định vị ngoài viewport thay vì `display: none` (vì một số bot thông minh biết bỏ qua các thẻ có `display: none` hoặc `visibility: hidden`):

```css
/* Location: packages/web/src/styles/honeypot.css */
.invisible-honeypot {
  position: absolute;
  left: -9999px;
  top: auto;
  width: 1px;
  height: 1px;
  overflow: hidden;
  opacity: 0;
  pointer-events: none;
  z-index: -1;
}
```

### 3.2 HTML Markup trong form
```tsx
<div className="invisible-honeypot" aria-hidden="true">
  <label htmlFor="website">Website cá nhân</label>
  <input
    id="website"
    type="text"
    name="website"
    value={formData.website}
    onChange={handleInputChange}
    tabIndex={-1} // Ngăn người dùng thật nhấn Tab nhảy vào input này
    autoComplete="off"
  />
</div>
```

---

## 4. BẢN ĐỒ ÁNH XẠ LỖI VÀ i18n TIẾNG VIỆT (ERROR MAPPING ENVELOPE)

Khi API backend trả về lỗi chuẩn OpenAPI Envelope, frontend có nhiệm vụ phân rã cấu trúc lỗi và gắn vào các input tương ứng để người dùng biết điểm sai trực quan.

### 4.1 Hàm Xử lý Lỗi API (API Error Parser)
```typescript
// Location: packages/web/src/utils/apiErrorHandler.ts

interface ApiErrorResponse {
  detail?: string;
  code?: string;
  field_errors?: Record<string, string[]>;
}

export function parseApiErrors(errorResponse: any): ApiErrorResponse {
  if (errorResponse && errorResponse.data) {
    const data = errorResponse.data;
    return {
      detail: data.detail || 'Đã xảy ra lỗi không xác định.',
      code: data.code || 'unknown_error',
      field_errors: data.field_errors || {}
    };
  }
  return {
    detail: 'Không thể kết nối đến máy chủ đầu tư.',
    code: 'network_error',
    field_errors: {}
  };
}
```

### 4.2 UI Input Mapping (Hiển thị Lỗi trực quan)
Mỗi trường input (email, password, password_confirm) được bao quanh bởi border chuyển đỏ kèm dòng chú thích Validation tiếng Việt có dấu đầy đủ dưới chân input:

```tsx
// Location: packages/web/src/components/auth/RegisterForm.tsx
import React, { useState } from 'react';
import { parseApiErrors } from '../../utils/apiErrorHandler';
import { TurnstileWidget } from './TurnstileWidget';
import '../../styles/honeypot.css';

export const RegisterForm: React.FC = () => {
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    password: '',
    password_confirm: '',
    website: '', // Honeypot
  });
  
  const [turnstileToken, setTurnstileToken] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [globalError, setGlobalError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
    // Xoá lỗi đỏ khi người dùng gõ lại
    if (errors[e.target.name]) {
      setErrors({ ...errors, [e.target.name]: '' });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setGlobalError('');
    setErrors({});

    const payload = {
      ...formData,
      turnstile_token: turnstileToken
    };

    try {
      const response = await fetch('/api/auth/register/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const resJson = await response.json();
      
      if (!response.ok) {
        const parsed = parseApiErrors({ data: resJson });
        setGlobalError(parsed.detail || 'Không thể đăng ký.');
        
        // Trích xuất lỗi chi tiết cho từng input field
        if (parsed.field_errors) {
          const formattedErrors: Record<string, string> = {};
          Object.entries(parsed.field_errors).forEach(([key, messages]) => {
            formattedErrors[key] = messages[0]; // Lấy câu thông báo lỗi đầu tiên
          });
          setErrors(formattedErrors);
        }
      } else {
        setIsSuccess(true);
      }
    } catch (err) {
      setGlobalError('Lỗi kết nối mạng vật lý. Vui lòng thử lại sau.');
    } finally {
      setIsLoading(false);
    }
  };

  if (isSuccess) {
    return (
      <div className="glass-panel max-w-md w-full p-8 rounded-2xl border border-cyan-500/30 text-center animate-fade-in">
        <h2 className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 to-cyan-400 font-display mb-4">
          ĐĂNG KÝ THÀNH CÔNG!
        </h2>
        <p className="text-gray-300 mb-6 leading-relaxed">
          Chúng tôi đã gửi một email xác thực đến địa chỉ <strong className="text-white">{formData.email}</strong>. Vui lòng kiểm tra hộp thư để kích hoạt tài khoản đầu tư.
        </p>
        <button className="primary-btn w-full" onClick={() => window.location.href = '/login'}>
          Trở về Đăng nhập
        </button>
      </div>
    );
  }

  return (
    <div className="glass-panel max-w-md w-full p-8 rounded-2xl border border-white/10 backdrop-blur-md">
      <h2 className="text-3xl font-bold text-white font-display text-center mb-6">
        Đăng Ký Tài Khoản
      </h2>

      {globalError && (
        <div className="error-alert p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm mb-4 animate-shake">
          {globalError}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Username field */}
        <div className="flex flex-col">
          <label className="text-gray-400 text-sm mb-1">Tên đăng nhập</label>
          <input
            type="text"
            name="username"
            value={formData.username}
            onChange={handleInputChange}
            className={`input-field ${errors.username ? 'border-red-500/50 focus:border-red-500' : 'border-white/10'}`}
            required
            autoComplete="username"
          />
          {errors.username && <span className="text-red-400 text-xs mt-1">{errors.username}</span>}
        </div>

        {/* Email field */}
        <div className="flex flex-col">
          <label className="text-gray-400 text-sm mb-1">Địa chỉ Email</label>
          <input
            type="email"
            name="email"
            value={formData.email}
            onChange={handleInputChange}
            className={`input-field ${errors.email ? 'border-red-500/50 focus:border-red-500' : 'border-white/10'}`}
            required
            autoComplete="email"
          />
          {errors.email && <span className="text-red-400 text-xs mt-1">{errors.email}</span>}
        </div>

        {/* Password field */}
        <div className="flex flex-col">
          <label className="text-gray-400 text-sm mb-1">Mật khẩu</label>
          <input
            type="password"
            name="password"
            value={formData.password}
            onChange={handleInputChange}
            className={`input-field ${errors.password ? 'border-red-500/50 focus:border-red-500' : 'border-white/10'}`}
            required
            autoComplete="new-password"
          />
          {errors.password && <span className="text-red-400 text-xs mt-1">{errors.password}</span>}
        </div>

        {/* Password Confirm field */}
        <div className="flex flex-col">
          <label className="text-gray-400 text-sm mb-1">Xác nhận Mật khẩu</label>
          <input
            type="password"
            name="password_confirm"
            value={formData.password_confirm}
            onChange={handleInputChange}
            className={`input-field ${errors.password_confirm ? 'border-red-500/50 focus:border-red-500' : 'border-white/10'}`}
            required
            autoComplete="new-password"
          />
          {errors.password_confirm && <span className="text-red-400 text-xs mt-1">{errors.password_confirm}</span>}
        </div>

        {/* BẪY HONEYPOT: Ẩn hoàn toàn với người dùng */}
        <div className="invisible-honeypot" aria-hidden="true">
          <label htmlFor="website">Website</label>
          <input
            id="website"
            type="text"
            name="website"
            value={formData.website}
            onChange={handleInputChange}
            tabIndex={-1}
            autoComplete="off"
          />
        </div>

        {/* Turnstile Widget */}
        <TurnstileWidget
          onVerify={(token) => setTurnstileToken(token)}
          onError={() => setGlobalError('Turnstile gặp sự cố tải. Vui lòng tải lại trang.')}
        />
        {errors.turnstile_token && <p className="text-red-400 text-xs text-center">{errors.turnstile_token}</p>}

        {/* Submit button */}
        <button
          type="submit"
          className="submit-btn w-full py-3 rounded-xl bg-gradient-to-r from-yellow-500 to-cyan-500 hover:from-yellow-400 hover:to-cyan-400 text-black font-semibold text-base transition-all disabled:opacity-50"
          disabled={isLoading || !turnstileToken}
        >
          {isLoading ? 'Đang tạo tài khoản...' : 'Đăng Ký Thành Viên'}
        </button>
      </form>
    </div>
  );
};
```

---

## 5. BẢNG DỊCH TIẾNG VIỆT ĐẦY ĐỦ DẤU (I18N LANGUAGE BUNDLE)

Đội ngũ code frontend bắt buộc sử dụng đúng tệp i18n sau để đảm bảo giao diện 100% tiếng Việt mượt mà:

```json
// Location: packages/web/src/locales/vi/auth.json
{
  "register": {
    "title": "Tạo tài khoản VNInvest",
    "submit": "Đăng Ký Thành Viên",
    "submitting": "Đang tạo tài khoản...",
    "success_header": "ĐĂNG KÝ THÀNH CÔNG!",
    "success_desc": "Chúng tôi đã gửi một email xác thực đến địa chỉ của bạn. Vui lòng kiểm tra hộp thư (bao gồm cả thư rác/spam) để kích hoạt tài khoản.",
    "fields": {
      "username": "Tên đăng nhập",
      "email": "Địa chỉ Email",
      "password": "Mật khẩu",
      "password_confirm": "Xác nhận Mật khẩu"
    },
    "errors": {
      "username_exists": "Tên đăng nhập này đã tồn tại trên hệ thống.",
      "email_exists": "Địa chỉ email này đã được sử dụng.",
      "disposable_email": "Không cho phép đăng ký bằng địa chỉ email tạm thời.",
      "password_mismatch": "Mật khẩu xác nhận không khớp.",
      "turnstile_failed": "Xác thực Turnstile không thành công. Bạn có phải là bot?",
      "network_error": "Mất kết nối máy chủ vật lý. Vui lòng thử lại sau ít phút."
    }
  }
}
```
