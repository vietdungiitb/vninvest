# Frontend Design — DNSE Historical Backfill Whale & Dark Flow
**Ngày**: 2026-05-19

---

## 1. Tổng quan

3 điểm vào giao diện:

| Surface | Who | Vị trí | Mục đích |
|---|---|---|---|
| SOC DataOps Panel | Admin | `/soc` → tab DataOps | Trigger system backfill cho nhiều symbol |
| User Settings | Authenticated user | `/settings` → tab "Kết nối DNSE" | Lưu credential DNSE cá nhân |
| Whale Alerts per-symbol | Authenticated user có credential | `/whale-alerts/:symbol` | Trigger user backfill cho symbol đang xem |

---

## 2. SOC DataOps Panel — Backfill Widget

### Component: `WhaleBackfillPanel`
**File**: `packages/web/src/components/soc/WhaleBackfillPanel.jsx`

```jsx
// Layout
<WhaleBackfillPanel>
  <SectionHeader title={t('soc.dataops.whaleBackfill.title')} />

  <SymbolMultiSelect
    label={t('soc.dataops.whaleBackfill.symbolsLabel')}
    placeholder={t('soc.dataops.whaleBackfill.symbolsPlaceholder')}
    value={selectedSymbols}
    onChange={setSelectedSymbols}
  />

  <DaysBackSlider
    label={t('soc.dataops.whaleBackfill.daysBackLabel')}  // "Số ngày lùi"
    min={1} max={365} default={90}
    value={daysBack}
    onChange={setDaysBack}
  />

  <Checkbox
    label={t('soc.dataops.whaleBackfill.overwriteLabel')}  // "Ghi đè dữ liệu đã có"
    checked={overwrite}
    onChange={setOverwrite}
  />

  <StatusBadge text={systemCredentialStatus} />
  // "✓ Đã cấu hình tài khoản hệ thống" nếu is_system_provider set
  // "⚠ Chưa cấu hình tài khoản DNSE hệ thống" nếu chưa

  <Button
    label={t('soc.dataops.whaleBackfill.submitLabel')}  // "Bắt đầu Backfill"
    disabled={!selectedSymbols.length || loading || !systemCredentialOk}
    onClick={handleSubmit}
  />

  <TaskProgress taskId={taskId} />
  // Polling every 3s khi taskId có
  // Hiển thị: ticks_inserted / dates_inserted / dates_skipped / errors
</WhaleBackfillPanel>
```

### State
```js
const [selectedSymbols, setSelectedSymbols] = useState([])
const [daysBack, setDaysBack] = useState(90)
const [overwrite, setOverwrite] = useState(false)
const [loading, setLoading] = useState(false)
const [taskId, setTaskId] = useState(null)
const [systemCredentialOk, setSystemCredentialOk] = useState(false)
```

### API call
```js
import { triggerWhaleBackfillSystem } from '../../../api/coreApiAdapter'

const handleSubmit = async () => {
  setLoading(true)
  try {
    const resp = await triggerWhaleBackfillSystem({
      symbols: selectedSymbols,
      days_back: daysBack,
      overwrite,
    })
    setTaskId(resp.task_id)
  } finally {
    setLoading(false)
  }
}
```

---

## 3. User Settings — Tab "Kết nối DNSE"

### Component: `DNSECredentialTab`
**File**: `packages/web/src/components/settings/DNSECredentialTab.jsx`

```jsx
<DNSECredentialTab>
  <SectionHeader title={t('settings.dnse.title')} />
  // "Kết nối tài khoản DNSE"

  <InfoBox>
    {t('settings.dnse.description')}
    // "Kết nối tài khoản DNSE để tự động tải lịch sử giao dịch khớp lệnh
    // giúp phân tích cá mập và dòng tiền tối cho cổ phiếu bạn theo dõi."
  </InfoBox>

  {hasCredential ? (
    <CredentialStatus
      isVerified={credentialStatus.is_verified}
      lastVerifiedAt={credentialStatus.last_verified_at}
    />
  ) : (
    <CredentialForm
      onSave={handleSave}
      loading={saving}
    />
  )}

  {isAdmin && hasCredential && (
    <AdminSection>
      <Toggle
        label={t('settings.dnse.systemProviderLabel')}
        // "Dùng tài khoản này làm nguồn cấp dữ liệu hệ thống"
        checked={isSystemProvider}
        onChange={handleToggleSystemProvider}
      />
    </AdminSection>
  )}

  {hasCredential && (
    <DangerZone>
      <Button variant="danger"
        label={t('settings.dnse.deleteLabel')}
        // "Xóa kết nối DNSE"
        onClick={handleDelete}
      />
    </DangerZone>
  )}
</DNSECredentialTab>
```

### CredentialForm sub-component
```jsx
<CredentialForm>
  <TextInput
    label={t('settings.dnse.apiKeyLabel')}  // "Mã khóa API (API ID)"
    type="text"
    value={apiKey}
    onChange={setApiKey}
  />
  <TextInput
    label={t('settings.dnse.apiSecretLabel')}  // "Mật khẩu API (API Secret)"
    type="password"
    value={apiSecret}
    onChange={setApiSecret}
  />
  <Button
    label={t('settings.dnse.saveAndVerifyLabel')}  // "Xác minh và Lưu"
    onClick={handleSaveAndVerify}
    loading={saving}
  />
</CredentialForm>
```

---

## 4. Whale Alerts per-symbol — Backfill button

### Component: `SymbolBackfillTrigger`
**File**: `packages/web/src/components/whale/SymbolBackfillTrigger.jsx`

Vị trí: Hiển thị ở góc trên phải của `WhaleAlertsSymbolPage`, chỉ khi `hasVerifiedDnseCredential === true`.

```jsx
{hasVerifiedDnseCredential && (
  <Button
    variant="outline"
    label={t('whale.symbol.backfillLabel')}
    // "Tải lịch sử 3 tháng"
    onClick={() => setBackfillModalOpen(true)}
  />
)}

<BackfillModal
  open={backfillModalOpen}
  symbol={symbol}
  onClose={() => setBackfillModalOpen(false)}
  onConfirm={handleUserBackfill}
>
  <p>{t('whale.symbol.backfillConfirm', { symbol })}</p>
  // "Bạn sẽ tải lịch sử 90 ngày giao dịch cho {symbol} từ DNSE.
  //  Dữ liệu sẽ được chia sẻ với hệ thống để phân tích dòng tiền."
  <DaysBackSlider min={1} max={180} default={90} value={days} onChange={setDays} />
  <Button label={t('whale.symbol.backfillStart')} onClick={handleConfirm} />
</BackfillModal>
```

---

## 5. coreApiAdapter additions

```js
// packages/web/src/api/coreApiAdapter.js

export const getDnseCredentialStatus = () =>
  coreGet('/user/dnse-credential/')

export const saveDnseCredential = (data) =>
  corePost('/user/dnse-credential/', data)

export const deleteDnseCredential = () =>
  coreDelete('/user/dnse-credential/')

export const verifyDnseCredential = () =>
  corePost('/user/dnse-credential/verify/')

export const setDnseSystemProvider = (enabled) =>
  corePatch('/user/dnse-credential/set-system-provider/', { is_system_provider: enabled })

export const triggerWhaleBackfillSystem = (params) =>
  corePost('/data-ingest/trigger/whale-backfill/', params)

export const triggerWhaleBackfillUser = (symbol, days_back) =>
  corePost('/whale/backfill-symbol/', { symbol, days_back })
```

---

## 6. i18n keys

```json
// vi.json additions
{
  "soc.dataops.whaleBackfill.title": "Bù lịch sử Cá Mập / Dòng Tiền Tối",
  "soc.dataops.whaleBackfill.symbolsLabel": "Danh sách mã cổ phiếu",
  "soc.dataops.whaleBackfill.symbolsPlaceholder": "Ví dụ: HPG, VNM, SSI",
  "soc.dataops.whaleBackfill.daysBackLabel": "Số ngày cần tải lịch sử",
  "soc.dataops.whaleBackfill.overwriteLabel": "Ghi đè nếu đã tồn tại",
  "soc.dataops.whaleBackfill.submitLabel": "Bắt đầu Bù Lịch Sử",
  "soc.dataops.whaleBackfill.systemCredentialOk": "✓ Đã cấu hình tài khoản DNSE hệ thống",
  "soc.dataops.whaleBackfill.systemCredentialMissing": "⚠ Chưa cấu hình tài khoản DNSE hệ thống",
  "settings.dnse.title": "Kết nối tài khoản DNSE",
  "settings.dnse.description": "Kết nối tài khoản DNSE để tự động tải lịch sử khớp lệnh, phục vụ phân tích cá mập và dòng tiền tối.",
  "settings.dnse.apiKeyLabel": "Mã khóa API (API ID)",
  "settings.dnse.apiSecretLabel": "Mật khẩu API (API Secret)",
  "settings.dnse.saveAndVerifyLabel": "Xác minh và Lưu",
  "settings.dnse.systemProviderLabel": "Dùng tài khoản này làm nguồn cấp hệ thống",
  "settings.dnse.deleteLabel": "Xóa kết nối DNSE",
  "settings.dnse.verified": "✓ Đã xác minh",
  "settings.dnse.notVerified": "Chưa xác minh",
  "whale.symbol.backfillLabel": "Tải lịch sử 3 tháng",
  "whale.symbol.backfillConfirm": "Bạn sẽ tải lịch sử giao dịch {symbol} từ DNSE. Dữ liệu được chia sẻ cho hệ thống phân tích.",
  "whale.symbol.backfillStart": "Bắt đầu tải",
  "whale.symbol.backfillRateLimit": "Bạn đã đạt giới hạn 5 lần/ngày. Thử lại vào ngày mai."
}
```

---

## 7. Error handling

| Error | Display |
|---|---|
| HTTP 400 `no_dnse_credential` | Toast: "Bạn chưa kết nối tài khoản DNSE. Vào Cài đặt → Kết nối DNSE." |
| HTTP 429 | Toast: "Bạn đã đạt giới hạn 5 lần/ngày. Thử lại vào ngày mai." |
| HTTP 403 (system backfill) | Toast: "Bạn không có quyền thực hiện thao tác này." |
| Network error | Toast: "Lỗi kết nối. Vui lòng thử lại." |
| Verify credential fail | Inline: "Thông tin DNSE không hợp lệ. Vui lòng kiểm tra lại API ID và API Secret." |
