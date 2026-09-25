import { readFileSync } from "node:fs";

const files = [
  "src/components/AIUsageDashboard.tsx",
  "src/components/AIAgentFederationPanel.tsx",
  "src/components/AIAuditLogsPanel.tsx",
  "src/components/AIAdvisoryPromptConfigDrawer.js",
];

const patterns = [
  "vi-VN",
  "Thời gian",
  "Token vào",
  "Token ra",
  "7 ngày",
  "30 ngày",
  "90 ngày",
  "← Trước",
  "Sau →",
  "Hiển thị:",
  "VD: Phân tích",
  "phân_tích_ngành",
  "Tất cả hành động",
  "Người thực hiện",
  "VD: admin",
  "Từ ngày",
  "Đến ngày",
  "Áp dụng bộ lọc",
  "Xóa bộ lọc",
  "Đang tải audit",
  "Chưa có bản ghi",
  "Lý do:",
  "bản ghi — Trang",
  "Cấu hình được đồng bộ",
  '"Có"',
  '"Không"',
  "Chưa cấu hình",
];

let hits = 0;
for (const f of files) {
  const src = readFileSync(f, "utf8");
  for (const p of patterns) {
    let idx = 0;
    let n = 0;
    while ((idx = src.indexOf(p, idx)) !== -1) {
      n += 1;
      idx += p.length;
    }
    if (n > 0) {
      hits += n;
      console.log(`HIT ${f} :: ${JSON.stringify(p)} x${n}`);
    }
  }
}
console.log(`TOTAL_HITS=${hits}`);

const positive = [
  ["src/components/AIUsageDashboard.tsx", "TABLE_HEADER_KEYS"],
  ["src/components/AIUsageDashboard.tsx", "CSV_HEADER_KEYS"],
  ["src/components/AIUsageDashboard.tsx", "toLocaleString(localeTag)"],
  ["src/components/AIAgentFederationPanel.tsx", "aiAgentFederation.yes"],
  ["src/components/AIAgentFederationPanel.tsx", "placeholderName"],
  ["src/components/AIAuditLogsPanel.tsx", "auditShowing"],
  ["src/components/AIAuditLogsPanel.tsx", "reasonPrefix"],
  ["src/components/AIAdvisoryPromptConfigDrawer.js", "promptDrawerFooter"],
  ["src/components/AISliceE.i18n.component.test.js", "E-AC1"],
  ["src/components/AISliceE.i18n.component.test.js", "ConfirmModal.js"],
];
for (const [f, p] of positive) {
  const src = readFileSync(f, "utf8");
  console.log(`CHECK ${f} :: ${p} => ${src.includes(p) ? "OK" : "MISSING"}`);
}
process.exit(hits === 0 ? 0 : 1);
