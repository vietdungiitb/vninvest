import { useEffect, useState } from "react";
import { coreApiAdapter } from "../../adapters/coreApiAdapter.js";
import { ShellPageChrome, ShellPanel } from "../../components/ShellPageTemplate.js";
interface I18nContext {
  t: (key: string, options?: { defaultValue?: string }) => string;
  language: string;
}

function useI18n(): I18nContext {
  return {
    t: (key: string, options?: { defaultValue?: string }) => {
      const map: Record<string, string> = {
        'commercial.paymentReturn.title': 'Kết quả thanh toán',
        'commercial.paymentReturn.loading': 'Đang xác thực trạng thái giao dịch từ máy chủ...',
        'commercial.paymentReturn.errorNoTxnRef': 'Không tìm thấy mã giao dịch (txn_ref) trong URL.',
        'commercial.paymentReturn.errorInvalidResponse': 'Phản hồi từ máy chủ không hợp lệ.',
        'commercial.paymentReturn.errorCheckStatus': 'Không thể kiểm tra trạng thái giao dịch.',
        'commercial.paymentReturn.errorTitle': 'Lỗi xác thực',
        'commercial.paymentReturn.backToBilling': 'Quay lại Trung tâm Thanh toán',
        'commercial.paymentReturn.successTitle': 'Thanh toán thành công',
        'commercial.paymentReturn.failureTitle': 'Thanh toán thất bại',
        'commercial.paymentReturn.txnRefLabel': 'Mã giao dịch: ',
        'commercial.paymentReturn.amountLabel': 'Số tiền: ',
        'commercial.paymentReturn.reasonLabel': 'Lý do: ',
        'commercial.paymentReturn.reasonDefault': 'Giao dịch bị từ chối hoặc đã hủy',
      };
      return map[key] || options?.defaultValue || key;
    },
    language: 'vi',
  };
}

const RETURN_CUSTOM_STYLES = `
.return-card-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  padding: 30px 10px;
}

.return-status-icon {
  width: 72px;
  height: 72px;
  border-radius: 99px;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 20px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.2);
}

.return-status-icon--success {
  background: rgba(34, 197, 94, 0.15);
  color: #4ade80;
  border: 2px solid rgba(34, 197, 94, 0.3);
}

.return-status-icon--failure {
  background: rgba(239, 68, 68, 0.15);
  color: #fb7185;
  border: 2px solid rgba(239, 68, 68, 0.3);
}

.return-title {
  font-size: 24px;
  font-weight: 800;
  color: var(--text-primary);
  margin: 0 0 10px 0;
}

.return-desc {
  font-size: 14px;
  color: var(--text-secondary);
  max-width: 460px;
  margin: 0 auto 30px auto;
  line-height: 1.6;
}

.return-details-box {
  background: rgba(15, 23, 42, 0.5);
  border: 1px solid var(--border-shell);
  border-radius: 20px;
  padding: 20px;
  width: 100%;
  max-width: 440px;
  margin-bottom: 30px;
  text-align: left;
  display: grid;
  gap: 12px;
}

.return-detail-row {
  display: flex;
  justify-content: space-between;
  font-size: 13.5px;
  border-bottom: 1px dashed var(--border-shell);
  padding-bottom: 10px;
}

.return-detail-row:last-child {
  border-bottom: 0;
  padding-bottom: 0;
}

.return-detail-label {
  color: var(--text-secondary);
  font-weight: 600;
}

.return-detail-value {
  color: var(--text-primary);
  font-weight: 700;
}

.return-action-btn {
  padding: 12px 24px;
  border-radius: 14px;
  font-size: 14.5px;
  font-weight: 800;
  color: white;
  text-decoration: none;
  background: linear-gradient(135deg, #00b4d8 0%, #0077b6 100%);
  box-shadow: 0 8px 24px rgba(0, 180, 216, 0.25);
  transition: all 0.3s ease;
  display: inline-flex;
  align-items: center;
  gap: 8px;
}

.return-action-btn:hover {
  transform: translateY(-2px);
  box-shadow: 0 12px 28px rgba(0, 180, 216, 0.35);
}
`;

interface PaymentStatusData {
  status?: string;
  txn_ref?: string;
  amount?: number;
  message?: string;
  [key: string]: unknown;
}

const paymentApi = coreApiAdapter as unknown as {
  getPaymentStatus: (txnRef: string) => Promise<PaymentStatusData>;
};

export function PaymentReturnPage() {
  const { t } = useI18n();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusData, setStatusData] = useState<PaymentStatusData | null>(null);

  useEffect(() => {
    async function checkPaymentStatus() {
      try {
        setLoading(true);
        setError(null);

        const params = new URLSearchParams(window.location.search);
        const txnRef = params.get("txn_ref") || params.get("vnp_TxnRef");

        if (!txnRef) {
          throw new Error(t('commercial.paymentReturn.errorNoTxnRef'));
        }

        const response = await paymentApi.getPaymentStatus(txnRef);

        if (response && response.status) {
          setStatusData(response);
        } else {
          throw new Error(t('commercial.paymentReturn.errorInvalidResponse'));
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : t('commercial.paymentReturn.errorCheckStatus'));
      } finally {
        setLoading(false);
      }
    }

    checkPaymentStatus();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (loading) {
    return (
      <ShellPageChrome
        title={t('commercial.paymentReturn.title')}
        description={t('commercial.paymentReturn.loading')}
      >
        <div style={{ padding: "40px", textAlign: "center", color: "#486581" }}>
          {t('commercial.paymentReturn.loading')}
        </div>
      </ShellPageChrome>
    );
  }

  if (error) {
    return (
      <ShellPageChrome title={t('commercial.paymentReturn.title')}>
        <style>{RETURN_CUSTOM_STYLES}</style>
        <ShellPanel>
          <div className="return-card-container">
            <div className="return-status-icon return-status-icon--failure">
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
            <h2 className="return-title">{t('commercial.paymentReturn.errorTitle')}</h2>
            <p className="return-desc">{error}</p>
            <a href="/commercial/billing" className="return-action-btn">
              <svg style={{ width: "16px", height: "16px" }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              {t('commercial.paymentReturn.backToBilling')}
            </a>
          </div>
        </ShellPanel>
      </ShellPageChrome>
    );
  }

  const isSuccess = statusData?.status === "SUCCESS";

  return (
    <ShellPageChrome
      eyebrow="SaaS Commerce System"
      title={t('commercial.paymentReturn.title')}
      description="Kết quả đối soát trạng thái giao dịch từ cổng thanh toán trực tuyến."
    >
      <style>{RETURN_CUSTOM_STYLES}</style>
      <ShellPanel>
        <div className="return-card-container">
          {isSuccess ? (
            <div className="return-status-icon return-status-icon--success">
              <svg style={{ width: "36px", height: "36px" }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" />
              </svg>
            </div>
          ) : (
            <div className="return-status-icon return-status-icon--failure">
              <svg style={{ width: "36px", height: "36px" }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
          )}

          <h2 className="return-title">
            {isSuccess ? t('commercial.paymentReturn.successTitle') : t('commercial.paymentReturn.failureTitle')}
          </h2>

          <p className="return-desc">
            {isSuccess
              ? "Tài khoản của bạn đã được nâng cấp thành công lên gói cước VIP. Xin cảm ơn quý khách đã tin dùng dịch vụ của VNInvest!"
              : "Giao dịch thanh toán đã bị huỷ bỏ hoặc từ chối từ phía ngân hàng phát hành thẻ/ví điện tử."}
          </p>

          <div className="return-details-box">
            <div className="return-detail-row">
              <span className="return-detail-label">{t('commercial.paymentReturn.txnRefLabel')}</span>
              <span className="return-detail-value"><code>{statusData?.txn_ref}</code></span>
            </div>
            <div className="return-detail-row">
              <span className="return-detail-label">{t('commercial.paymentReturn.amountLabel')}</span>
              <span className="return-detail-value" style={{ color: isSuccess ? "#166534" : "#991b1b" }}>
                {`${Number(statusData?.amount || 0).toLocaleString('vi-VN')} đ`}
              </span>
            </div>
            {!isSuccess ? (
              <div className="return-detail-row">
                <span className="return-detail-label">{t('commercial.paymentReturn.reasonLabel')}</span>
                <span className="return-detail-value" style={{ color: "#991b1b", maxWidth: "240px", textAlign: "right" }}>
                  {statusData?.message || t('commercial.paymentReturn.reasonDefault')}
                </span>
              </div>
            ) : null}
          </div>

          <a href="/commercial/billing" className="return-action-btn">
            <svg style={{ width: "16px", height: "16px" }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            {t('commercial.paymentReturn.backToBilling')}
          </a>
        </div>
      </ShellPanel>
    </ShellPageChrome>
  );
}
