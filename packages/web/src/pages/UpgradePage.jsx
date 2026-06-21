import { Link } from 'react-router-dom';
import { usePortfolio } from '../context/PortfolioContext';

const PLAN_DEFS = [
  {
    key: 'basic',
    accent: 'border-slate-700 bg-slate-900/70',
    features: ['Đến 3 danh mục đầu tư', 'Dữ liệu thị trường cơ bản', 'Cảnh báo giá cơ bản'],
  },
  {
    key: 'pro',
    accent: 'border-cyan-800/70 bg-cyan-950/20',
    features: ['Danh mục không giới hạn', 'Dữ liệu intraday realtime', 'Phân tích kỹ thuật nâng cao', 'Cảnh báo thông minh'],
  },
  {
    key: 'premium',
    accent: 'border-amber-700/70 bg-amber-950/20',
    features: ['Tất cả tính năng Pro', 'Tín hiệu Whale & Dark Flow', 'API truy xuất dữ liệu', 'Hỗ trợ ưu tiên 24/7', 'Phân tích AI chuyên sâu'],
  },
];

export default function UpgradePage() {
  const { userPlan } = usePortfolio();

  return (
    <div className="mx-auto flex min-h-full max-w-6xl flex-col gap-5 p-4 xl:px-5">
      <section className="card-section px-5 py-6">
        <p className="text-label">Nâng cấp tài khoản</p>
        <h1 className="mt-2 text-3xl font-semibold text-slate-100">Chọn gói phù hợp với bạn</h1>
        <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-400">
          {userPlan ? `Bạn đang sử dụng gói ${userPlan}. Nâng cấp để mở khóa thêm tính năng.` : 'Khám phá các gói dịch vụ của VNInvest.'}
        </p>
        <div className="mt-5 flex flex-wrap items-center gap-3">
          <Link to="/dashboard" className="btn-secondary inline-flex items-center justify-center">
            Quay lại Dashboard
          </Link>
          <Link to="/watchlist" className="btn-primary inline-flex items-center justify-center">
            Mở Market Radar
          </Link>
        </div>
      </section>

      <div className="grid gap-4 lg:grid-cols-3">
        {PLAN_DEFS.map((plan) => (
          <section key={plan.key} className={`card-section px-5 py-5 ${plan.accent}`}>
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-lg font-semibold text-slate-100 capitalize">{plan.key}</h2>
              {userPlan === plan.key && (
                <span className="rounded-full border border-emerald-700/70 bg-emerald-950/30 px-2.5 py-1 text-[11px] font-semibold text-emerald-300">
                  Gói hiện tại
                </span>
              )}
            </div>
            <div className="mt-4 space-y-2 text-sm text-slate-300">
              {plan.features.map((feature) => (
                <p key={feature}>- {feature}</p>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
