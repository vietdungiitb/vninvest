import React, { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  createSupportTicket,
  getSupportTicketDetail,
  listSupportTickets,
  reopenSupportTicket,
  replySupportTicket,
} from '../api/support';
import SupportTicketList from '../components/support/SupportTicketList';
import TicketComposer from '../components/support/TicketComposer';
import TicketCreationForm from '../components/support/TicketCreationForm';
import TicketMetaPanel from '../components/support/TicketMetaPanel';
import TicketThread from '../components/support/TicketThread';
import { useI18n } from '../context/LangContext';

export default function Support() {
  const { t } = useI18n();
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

  const selectedTicketId = useMemo(
    () => searchParams.get('ticketId') || '',
    [searchParams],
  );

  const loadTickets = async () => {
    setLoadingTickets(true);
    setErrorMessage('');
    try {
      const response = await listSupportTickets({ page_size: 50 });
      const rows = response.data?.results || [];
      setTickets(rows);

      if (!rows.length) {
        setSelectedTicket(null);
        setThreadMessages([]);
        setCreatingNew(true);
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
  }, []);

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
      await replySupportTicket(selectedTicket.id, payload);
      await loadTicketDetail(selectedTicket.id);
      await loadTickets();
    } catch (error) {
      setErrorMessage(error?.response?.data?.detail || t('support.replyFailed'));
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

      {errorMessage && (
        <div className="rounded-lg border border-rose-700/70 bg-rose-900/20 px-3 py-2 text-sm text-rose-200">
          {errorMessage}
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[340px_1fr]">
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-300">{t('support.myTickets')}</h2>
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
          </div>
          <SupportTicketList
            tickets={tickets}
            selectedTicketId={selectedTicket?.id || ''}
            loading={loadingTickets}
            onSelect={handleSelectTicket}
            t={t}
          />
        </div>

        <div className="space-y-3">
          {creatingNew || !selectedTicket ? (
            <div>
              <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-300">{t('support.createFirstTicket')}</h2>
              <TicketCreationForm onCreateTicket={handleCreateTicket} loading={submitting} t={t} />
            </div>
          ) : (
            <>
              <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-300">{selectedTicket.subject}</h2>
              <TicketMetaPanel
                ticket={selectedTicket}
                t={t}
                onReopen={handleReopen}
                reopenLoading={reopenLoading}
              />
              <TicketThread messages={threadMessages} loading={loadingThread} t={t} />
              <TicketComposer disabled={submitting} onSubmit={handleReply} t={t} />
            </>
          )}
        </div>
      </div>
    </div>
  );
}
