import React, { useEffect, useMemo, useState, createElement } from 'react';
import { useSearchParams } from 'react-router-dom';
import { coreApiAdapter } from '../adapters/coreApiAdapter.js';
import SupportQueueFilters from '../components/support/SupportQueueFilters.js';
import SupportOpsDashboard from '../components/support/SupportOpsDashboard.js';
import StaffTicketActions from '../components/support/StaffTicketActions.js';
import SupportTicketList from '../components/support/SupportTicketList.js';
import TicketComposer from '../components/support/TicketComposer.js';
import TicketCreationForm from '../components/support/TicketCreationForm.js';
import TicketMetaPanel from '../components/support/TicketMetaPanel.js';
import TicketThread from '../components/support/TicketThread.js';
import { useI18n } from '../context/LangContext.js';
import { usePortfolio } from '../context/PortfolioContext.js';

const e = createElement;

export function SupportPage() {
  const { t } = useI18n();
  const { userIdentity } = usePortfolio();
  const [searchParams, setSearchParams] = useSearchParams();

  const [tickets, setTickets] = useState([]);
  const [loadingTickets, setLoadingTickets] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [threadMessages, setThreadMessages] = useState([]);
  const [loadingThread, setLoadingThread] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [reopenLoading, setReopenLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [creatingNew, setCreatingNew] = useState(false);
  const [staffMode, setStaffMode] = useState(false);
  const [staffFilters, setStaffFilters] = useState({
    search: '',
    status: '',
    priority: '',
    mineOnly: false,
  });
  const [opsData, setOpsData] = useState(null);
  const [opsLoading, setOpsLoading] = useState(false);

  const isStaffUser = Boolean(userIdentity?.isStaff || userIdentity?.is_staff);

  const selectedTicketId = useMemo(
    () => searchParams.get('ticketId') || '',
    [searchParams],
  );

  const loadTickets = async () => {
    setLoadingTickets(true);
    setErrorMessage('');
    try {
      const response = staffMode
        ? await coreApiAdapter.listStaffSupportTickets({
          page_size: 50,
          q: staffFilters.search || undefined,
          status: staffFilters.status || undefined,
          priority: staffFilters.priority || undefined,
          assignee_id: staffFilters.mineOnly ? userIdentity?.id : undefined,
        })
        : await coreApiAdapter.listSupportTickets({ page_size: 50 });

      const rows = response?.results || response?.data?.results || response || [];
      setTickets(rows);

      if (!rows.length) {
        setSelectedTicket(null);
        setThreadMessages([]);
        setCreatingNew(!staffMode);
        return;
      }

      const matched = rows.find((ticket) => ticket.id === selectedTicketId)
        || rows.find((ticket) => ticket.ticket_code === searchParams.get('ticket'))
        || rows[0];

      setCreatingNew(false);
      setSelectedTicket(matched);
      setSearchParams({ ticketId: matched.id });
    } catch (error) {
      setErrorMessage(error?.message || t('support.loadFailed', 'Không thể tải danh sách vé.'));
    } finally {
      setLoadingTickets(false);
    }
  };

  const loadTicketDetail = async (ticketId) => {
    if (!ticketId) {
      return;
    }
    setLoadingThread(true);
    setErrorMessage('');
    try {
      const response = await coreApiAdapter.getSupportTicketDetail(ticketId);
      const ticket = response?.ticket || response?.data?.ticket || response;
      const messages = response?.messages?.results || response?.data?.messages?.results || response?.messages || [];
      setSelectedTicket(ticket || null);
      setThreadMessages(messages);
    } catch (error) {
      setErrorMessage(error?.message || t('support.loadFailed', 'Không thể tải chi tiết vé.'));
    } finally {
      setLoadingThread(false);
    }
  };

  const loadStaffOpsDashboard = async () => {
    if (!staffMode || !isStaffUser) {
      return;
    }
    setOpsLoading(true);
    try {
      const response = await coreApiAdapter.getStaffSupportDashboard();
      setOpsData(response || response?.data || null);
    } catch {
      setOpsData(null);
    } finally {
      setOpsLoading(false);
    }
  };

  useEffect(() => {
    loadTickets();
  }, [staffMode, staffFilters.search, staffFilters.status, staffFilters.priority, staffFilters.mineOnly, userIdentity?.id]);

  useEffect(() => {
    loadStaffOpsDashboard();
  }, [staffMode, isStaffUser]);

  useEffect(() => {
    if (selectedTicket?.id) {
      loadTicketDetail(selectedTicket.id);
    }
  }, [selectedTicket?.id]);

  const handleSelectTicket = (ticket) => {
    setCreatingNew(false);
    setSelectedTicket(ticket);
    setSearchParams({ ticketId: ticket.id });
  };

  const handleStaffFilterChange = (field, value) => {
    setStaffFilters((prev) => ({ ...prev, [field]: value }));
  };

  const handleCreateTicket = async (payload) => {
    setSubmitting(true);
    setErrorMessage('');
    try {
      await coreApiAdapter.createSupportTicket(payload);
      await loadTickets();
      setCreatingNew(false);
    } catch (error) {
      setErrorMessage(error?.message || t('support.createFailed', 'Tạo vé thất bại.'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleReply = async (payload) => {
    if (!selectedTicket?.id) {
      return;
    }
    setSubmitting(true);
    setErrorMessage('');
    try {
      if (staffMode && isStaffUser) {
        await coreApiAdapter.replyStaffSupportTicket(selectedTicket.id, payload);
      } else {
        await coreApiAdapter.replySupportTicket(selectedTicket.id, payload);
      }
      await loadTicketDetail(selectedTicket.id);
      await loadTickets();
    } catch (error) {
      setErrorMessage(error?.message || t('support.replyFailed', 'Phản hồi thất bại.'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleStaffPatch = async (payload) => {
    if (!selectedTicket?.id) {
      return;
    }
    setSubmitting(true);
    setErrorMessage('');
    try {
      await coreApiAdapter.patchStaffSupportTicket(selectedTicket.id, payload);
      await loadTicketDetail(selectedTicket.id);
      await loadTickets();
    } catch (error) {
      setErrorMessage(error?.message || t('support.staffActions.updateFailed', 'Cập nhật vé thất bại.'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleReopen = async () => {
    if (!selectedTicket?.id) {
      return;
    }
    setReopenLoading(true);
    setErrorMessage('');
    try {
      await coreApiAdapter.reopenSupportTicket(selectedTicket.id);
      await loadTicketDetail(selectedTicket.id);
      await loadTickets();
    } catch (error) {
      setErrorMessage(error?.message || t('support.reopenFailed', 'Mở lại vé thất bại.'));
    } finally {
      setReopenLoading(false);
    }
  };

  const leftPane = e("div", { key: "left-pane", className: "space-y-3" }, [
    e("div", { key: "header-row", className: "flex items-center justify-between gap-3" }, [
      e("h2", { key: "title", className: "text-sm font-semibold uppercase tracking-wide text-slate-300" },
        staffMode ? t('support.queueTitle', 'HÀNG ĐỢI YÊU CẦU') : t('support.myTickets', 'VÉ CỦA TÔI')
      ),
      !staffMode ? e("button", {
        key: "new-btn",
        type: "button",
        onClick: () => {
          setCreatingNew(true);
          setSelectedTicket(null);
          setThreadMessages([]);
          setSearchParams({});
        },
        className: "rounded-lg border border-emerald-600 bg-emerald-600/20 px-3 py-1.5 text-xs font-semibold text-emerald-200 transition-colors hover:bg-emerald-600/30"
      }, t('support.newTicketCta', 'Tạo vé mới')) : null
    ]),
    staffMode ? e(SupportQueueFilters, { key: "filters", filters: staffFilters, onChange: handleStaffFilterChange, t }) : null,
    e(SupportTicketList, {
      key: "ticket-list",
      tickets,
      selectedTicketId: selectedTicket?.id || '',
      loading: loadingTickets,
      onSelect: handleSelectTicket,
      t,
      showRequester: staffMode,
      emptyMessage: staffMode ? t('support.emptyStaffList', 'Không có vé nào trong hàng đợi xử lý.') : t('support.emptyList', 'Bạn chưa tạo vé hỗ trợ nào.')
    })
  ]);

  const rightPane = e("div", { key: "right-pane", className: "space-y-3" },
    (creatingNew || !selectedTicket) && !staffMode ? [
      e("div", { key: "create-wrapper" }, [
        e("h2", { key: "title", className: "mb-2 text-sm font-semibold uppercase tracking-wide text-slate-300" },
          t('support.createFirstTicket', 'TẠO YÊU CẦU HỖ TRỢ MỚI')
        ),
        e(TicketCreationForm, { key: "form", onCreateTicket: handleCreateTicket, loading: submitting, t })
      ])
    ] : !selectedTicket ? [
      e("div", { key: "select-hint", className: "rounded-xl border border-slate-800 bg-slate-900/40 p-6 text-sm text-slate-400" },
        t('support.selectTicketHint', 'Chọn một vé hỗ trợ từ danh sách bên trái để bắt đầu cuộc hội thoại.')
      )
    ] : [
      e("h2", { key: "ticket-subject", className: "text-sm font-semibold uppercase tracking-wide text-slate-300" }, selectedTicket.subject),
      e(TicketMetaPanel, {
        key: "meta-panel",
        ticket: selectedTicket,
        t,
        onReopen: handleReopen,
        reopenLoading,
        showStaffFields: staffMode
      }),
      (staffMode && isStaffUser) ? e(StaffTicketActions, {
        key: "staff-actions",
        ticket: selectedTicket,
        currentUserId: userIdentity?.id,
        loading: submitting,
        onApply: handleStaffPatch,
        t
      }) : null,
      e(TicketThread, { key: "thread", messages: threadMessages, loading: loadingThread, t }),
      e(TicketComposer, { key: "composer", disabled: submitting, onSubmit: handleReply, t })
    ]
  );

  return e("div", { className: "mx-auto max-w-[1550px] space-y-4 px-5 py-6" }, [
    e("div", { key: "page-header" }, [
      e("h1", { className: "text-xl font-bold text-slate-100" }, t('support.pageTitle', 'Trung tâm hỗ trợ kỹ thuật')),
      e("p", { className: "mt-1 text-sm text-slate-400" }, t('support.pageSubtitle', 'Gửi các thắc mắc về kỹ thuật, tài khoản hoặc hóa đơn.'))
    ]),
    isStaffUser ? e("div", { key: "tab-header", className: "flex flex-wrap gap-2" }, [
      e("button", {
        key: "user-portal-btn",
        type: "button",
        onClick: () => {
          setStaffMode(false);
          setCreatingNew(false);
        },
        className: `rounded-full border px-4 py-2 text-sm font-semibold transition-colors ${!staffMode ? 'border-cyan-500/60 bg-cyan-500/15 text-cyan-200' : 'border-slate-700 bg-slate-900/55 text-slate-300 hover:border-slate-600'}`
      }, t('support.tabs.userPortal', 'Cổng người dùng')),
      e("button", {
        key: "staff-queue-btn",
        type: "button",
        onClick: () => {
          setStaffMode(true);
          setCreatingNew(false);
        },
        className: `rounded-full border px-4 py-2 text-sm font-semibold transition-colors ${staffMode ? 'border-amber-500/60 bg-amber-500/15 text-amber-200' : 'border-slate-700 bg-slate-900/55 text-slate-300 hover:border-slate-600'}`
      }, t('support.tabs.staffQueue', 'Hàng đợi kỹ thuật viên'))
    ]) : null,
    errorMessage ? e("div", { key: "error-banner", className: "rounded-lg border border-rose-700/70 bg-rose-900/20 px-3 py-2 text-sm text-rose-200" }, errorMessage) : null,
    (staffMode && isStaffUser) ? e(SupportOpsDashboard, { key: "ops-dashboard", data: opsData, loading: opsLoading, t }) : null,
    e("div", { key: "main-layout", className: "grid grid-cols-1 gap-4 xl:grid-cols-[340px_1fr]" }, [
      leftPane,
      rightPane
    ])
  ]);
}
