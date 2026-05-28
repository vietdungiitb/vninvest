import React, { useEffect, useState } from "react";
import { coreApiAdapter } from "../../adapters/coreApiAdapter.js";

const e = React.createElement;

function useI18n() {
  return {
    t: (key, options) => {
      const map = {
        'commercial.paymentReturn.title': 'Kết quả thanh toán',
        'commercial.paymentReturn.loading': 'Đang kiểm tra trạng thái giao dịch từ máy chủ...',
        'commercial.paymentReturn.errorNoTxnRef': 'Không tìm thấy mã giao dịch (txn_ref) trong URL.',
        'commercial.paymentReturn.errorInvalidResponse': 'Phản hồi từ máy chủ không hợp lệ.',
        'commercial.paymentReturn.errorCheckStatus': 'Không thể kiểm tra trạng thái giao dịch.',
        'commercial.paymentReturn.errorTitle': 'Lỗi',
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

export function PaymentReturnPage() {
  const { t } = useI18n();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [statusData, setStatusData] = useState(null);

  useEffect(() => {
    async function checkPaymentStatus() {
      try {
        setLoading(true);
        setError(null);

        // Extract txn_ref from URL query parameters safely
        const params = new URLSearchParams(window.location.search);
        // VNPay usually returns vnp_TxnRef or similar. If we map it to txn_ref in our redirect:
        const txnRef = params.get("txn_ref") || params.get("vnp_TxnRef");
        
        if (!txnRef) {
          throw new Error(t('commercial.paymentReturn.errorNoTxnRef'));
        }

        // Fetch status before concluding (DO NOT trust query params for truth)
        const response = await coreApiAdapter.getPaymentStatus(txnRef);
        
        if (response && response.status) {
          setStatusData(response);
        } else {
          throw new Error(t('commercial.paymentReturn.errorInvalidResponse'));
        }
      } catch (err) {
        setError(err.message || t('commercial.paymentReturn.errorCheckStatus'));
      } finally {
        setLoading(false);
      }
    }

    checkPaymentStatus();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (loading) {
    return e("div", { className: "shellPage" },
      e("header", { className: "shellPage__header" },
        e("h1", { className: "shellPage__title" }, t('commercial.paymentReturn.title'))
      ),
      e("main", { className: "shellPage__content" },
        e("p", { "aria-live": "polite" }, t('commercial.paymentReturn.loading'))
      )
    );
  }

  if (error) {
    return e("div", { className: "shellPage" },
      e("header", { className: "shellPage__header" },
        e("h1", { className: "shellPage__title" }, t('commercial.paymentReturn.title'))
      ),
      e("main", { className: "shellPage__content" },
        e("div", { className: "shellPage__panel", role: "alert" },
          e("h2", { className: "shellPage__panelTitle", style: { color: "red" } }, t('commercial.paymentReturn.errorTitle')),
          e("p", { className: "shellPage__panelSubtitle" }, error),
          e("a", { href: "/commercial/billing", style: { marginTop: "1rem", display: "inline-block" } }, t('commercial.paymentReturn.backToBilling'))
        )
      )
    );
  }

  const isSuccess = statusData?.status === "SUCCESS";

  return e("div", { className: "shellPage" },
    e("header", { className: "shellPage__header" },
      e("h1", { className: "shellPage__title" }, t('commercial.paymentReturn.title'))
    ),
    e("main", { className: "shellPage__content" },
      e("div", { className: "shellPage__panel" },
        e("h2", { className: "shellPage__panelTitle", style: { color: isSuccess ? "green" : "red" } },
          isSuccess ? t('commercial.paymentReturn.successTitle') : t('commercial.paymentReturn.failureTitle')
        ),
        e("p", null, t('commercial.paymentReturn.txnRefLabel'), e("strong", null, statusData?.txn_ref)),
        e("p", null, t('commercial.paymentReturn.amountLabel'), e("strong", null, statusData?.amount, " VND")),
        !isSuccess ? e("p", null, t('commercial.paymentReturn.reasonLabel'), e("strong", null, statusData?.message || t('commercial.paymentReturn.reasonDefault'))) : null,
        e("div", { style: { marginTop: "2rem" } },
          e("a", { 
            href: "/commercial/billing", 
            style: { padding: "0.5rem 1rem", backgroundColor: "#007BFF", color: "white", textDecoration: "none", borderRadius: "4px" } 
          }, t('commercial.paymentReturn.backToBilling'))
        )
      )
    )
  );
}
