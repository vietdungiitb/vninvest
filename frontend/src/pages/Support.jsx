import React, { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  createSupportTicket,
  getSupportTicketDetail,
  listSupportTickets,
  listStaffSupportTickets,
  patchStaffSupportTicket,
  reopenSupportTicket,
  replyStaffSupportTicket,
  replySupportTicket,
} from '../api/support';
import SupportQueueFilters from '../components/support/SupportQueueFilters';
import StaffTicketActions from '../components/support/StaffTicketActions';
import SupportTicketList from '../components/support/SupportTicketList';
import TicketComposer from '../components/support/TicketComposer';
import TicketCreationForm from '../components/support/TicketCreationForm';
import TicketMetaPanel from '../components/support/TicketMetaPanel';
import TicketThread from '../components/support/TicketThread';
import { useI18n } from '../context/LangContext';
import { usePortfolio } from '../context/PortfolioContext';

export default function Support() {
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

  const isStaffUser = Boolean(userIdentity?.isStaff);

  const selectedTicketId = useMemo(
    () => searchParams.get('ticketId') || '',
    [searchParams],
  );

  const loadTickets = async () => {
    setLoadingTickets(true);
    setErrorMessage('');
    try {
      const response = staffMode
        ? await listStaffSupportTickets({
          page_size: 50,
          q: staffFilters.search || undefined,
          status: staffFilters.status || undefined,
          priority: staffFilters.priority || undefined,
          assignee_id: staffFilters.mineOnly ? userIdentity?.id : undefined,
        })
        : await listSupportTickets({ page_size: 50 });
      const rows = response.data?.results || [];
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
      setErrorMessage(error?.response?.data?.detail || t('support.loadFailed'));
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
      const response = await getSupportTicketDetail(ticketId, { page_size: 100 });
      const ticket = response.data?.ticket;
      const messages = response.data?.messages?.results || [];
      setSelectedTicket(ticket || null);
      setThreadMessages(messages);
    } catch (error) {
      setErrorMessage(error?.response?.data?.detail || t('support.loadFailed'));
    } finally {
      setLoadingThread(false);
    }
  };

  useEffect(() => {
    loadTickets();
  }, [staffMode, staffFilters.search, staffFilters.status, staffFilters.priority, staffFilters.mineOnly, userIdentity?.id]);

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
      await createSupportTicket(payload);
      await loadTickets();
      setCreatingNew(false);
    } catch (error) {
      setErrorMessage(error?.response?.data?.detail || t('support.createFailed'));
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
        await replyStaffSupportTicket(selectedTicket.id, payload);
      } else {
        await replySupportTicket(selectedTicket.id, payload);
      }
      await loadTicketDetail(selectedTicket.id);
      await loadTickets();
    } catch (error) {
      setErrorMessage(error?.response?.data?.detail || t('support.replyFailed'));
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
      await patchStaffSupportTicket(selectedTicket.id, payload);
      await loadTicketDetail(selectedTicket.id);
      await loadTickets();
    } catch (error) {
      setErrorMessage(error?.response?.data?.detail || t('support.staffActions.updateFailed'));
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
      await reopenSupportTicket(selectedTicket.id);
      await loadTicketDetail(selectedTicket.id);
      await loadTickets();
    } catch (error) {
      setErrorMessage(error?.response?.data?.detail || t('support.reopenFailed'));
    } finally {
      setReopenLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-[1550px] space-y-4 px-5 py-6">
      <div>
        <h1 className="text-xl font-bold text-slate-100">{t('support.pageTitle')}</h1>
        <p className="mt-1 text-sm text-slate-400">{t('support.pageSubtitle')}</p>
      </div>

      {isStaffUser && (
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => {
              setStaffMode(false);
              setCreatingNew(false);
            }}
            className={`rounded-full border px-4 py-2 text-sm font-semibold transition-colors ${!staffMode ? 'border-cyan-500/60 bg-cyan-500/15 text-cyan-200' : 'border-slate-700 bg-slate-900/55 text-slate-300 hover:border-slate-600'}`}
          >
            {t('support.tabs.userPortal')}
          </button>
          <button
            type="button"
            onClick={() => {
              setStaffMode(true);
              setCreatingNew(false);
            }}
            className={`rounded-full border px-4 py-2 text-sm font-semibold transition-colors ${staffMode ? 'border-amber-500/60 bg-amber-500/15 text-amber-200' : 'border-slate-700 bg-slate-900/55 text-slate-300 hover:border-slate-600'}`}
          >
            {t('support.tabs.staffQueue')}
          </button>
        </div>
      )}

      {errorMessage && (
        <div className="rounded-lg border border-rose-700/70 bg-rose-900/20 px-3 py-2 text-sm text-rose-200">
          {errorMessage}
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[340px_1fr]">
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-300">{staffMode ? t('support.queueTitle') : t('support.myTickets')}</h2>
            {!staffMode && (
              <button
                type="button"
                onClick={() => {
                  setCreatingNew(true);
                  setSelectedTicket(null);
                  setThreadMessages([]);
                  setSearchParams({});
                }}
                className="rounded-lg border border-emerald-600 bg-emerald-600/20 px-3 py-1.5 text-xs font-semibold text-emerald-200 transition-colors hover:bg-emerald-600/30"
              >
                {t('support.newTicketCta')}
              </button>
            )}
          </div>
          {staffMode && <SupportQueueFilters filters={staffFilters} onChange={handleStaffFilterChange} t={t} />}
          <SupportTicketList
            tickets={tickets}
            selectedTicketId={selectedTicket?.id || ''}
            loading={loadingTickets}
            onSelect={handleSelectTicket}
            t={t}
            showRequester={staffMode}
            emptyMessage={staffMode ? t('support.emptyStaffList') : t('support.emptyList')}
          />
        </div>

        <div className="space-y-3">
          {(creatingNew || !selectedTicket) && !staffMode ? (
            <div>
              <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-300">{t('support.createFirstTicket')}</h2>
              <TicketCreationForm onCreateTicket={handleCreateTicket} loading={submitting} t={t} />
            </div>
          ) : !selectedTicket ? (
            <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-6 text-sm text-slate-400">
              {t('support.selectTicketHint')}
            </div>
          ) : (
            <>
              <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-300">{selectedTicket.subject}</h2>
              <TicketMetaPanel
                ticket={selectedTicket}
                t={t}
                onReopen={handleReopen}
                reopenLoading={reopenLoading}
                showStaffFields={staffMode}
              />
              {staffMode && isStaffUser && (
                <StaffTicketActions
                  ticket={selectedTicket}
                  currentUserId={userIdentity?.id}
                  loading={submitting}
                  onApply={handleStaffPatch}
                  t={t}
                />
              )}
              <TicketThread messages={threadMessages} loading={loadingThread} t={t} />
              <TicketComposer disabled={submitting} onSubmit={handleReply} t={t} />
            </>
          )}
        </div>
      </div>
    </div>
  );
}
