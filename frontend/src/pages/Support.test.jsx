import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import { MemoryRouter } from 'react-router-dom';
import Support from './Support';
import {
  createSupportTicket,
  getSupportTicketDetail,
  listStaffSupportTickets,
  listSupportTickets,
  patchStaffSupportTicket,
  replyStaffSupportTicket,
} from '../api/support';
import { useI18n } from '../context/LangContext';
import { usePortfolio } from '../context/PortfolioContext';

jest.mock('../api/support');
jest.mock('../context/LangContext');
jest.mock('../context/PortfolioContext');

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/support']} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <Support />
    </MemoryRouter>,
  );
}

const baseTicket = {
  id: 'ticket-1',
  ticket_code: 'VNST-20260418-000001',
  requester: 10,
  requester_username: 'alice',
  subject: 'Need help with support ticket workflow',
  category: 'TECHNICAL',
  priority: 'HIGH',
  status: 'OPEN',
  assignee: null,
  assignee_username: '',
  updated_at: '2026-04-18T10:00:00Z',
};

const baseThread = {
  ticket: baseTicket,
  messages: {
    results: [
      {
        id: 'msg-1',
        sender: 10,
        sender_username: 'alice',
        sender_role: 'USER',
        body: 'Initial message body for support ticket.',
        attachments: [],
        created_at: '2026-04-18T10:01:00Z',
      },
    ],
  },
};

describe('Support page', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useI18n.mockReturnValue({
      t: (key) => key,
    });
    usePortfolio.mockReturnValue({
      userIdentity: {
        id: 5,
        username: 'tester',
        email: 'tester@example.com',
        isStaff: false,
        isSuperuser: false,
      },
    });
  });

  it('renders create form when the user has no existing tickets', async () => {
    listSupportTickets.mockResolvedValueOnce({ data: { results: [] } });

    renderPage();

    expect(await screen.findByText('support.createFirstTicket')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('support.subjectPlaceholder')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('support.descriptionPlaceholder')).toBeInTheDocument();
  });

  it('creates a new ticket from the user portal', async () => {
    listSupportTickets
      .mockResolvedValueOnce({ data: { results: [] } })
      .mockResolvedValueOnce({ data: { results: [baseTicket] } })
      .mockResolvedValueOnce({ data: { results: [baseTicket] } });
    createSupportTicket.mockResolvedValueOnce({ data: baseTicket });
    getSupportTicketDetail.mockResolvedValueOnce({ data: baseThread });

    renderPage();

    await screen.findByText('support.createFirstTicket');

    await userEvent.type(screen.getByPlaceholderText('support.subjectPlaceholder'), 'Need help with support ticket workflow');
    await userEvent.type(screen.getByPlaceholderText('support.descriptionPlaceholder'), 'Detailed reproduction steps for the issue so support can investigate quickly.');
    fireEvent.click(screen.getByRole('button', { name: 'support.createTicket' }));

    await waitFor(() => {
      expect(createSupportTicket).toHaveBeenCalledWith({
        subject: 'Need help with support ticket workflow',
        category: 'TECHNICAL',
        priority: 'MEDIUM',
        body: 'Detailed reproduction steps for the issue so support can investigate quickly.',
      });
    });

    await waitFor(() => {
      expect(getSupportTicketDetail).toHaveBeenCalledWith('ticket-1', { page_size: 100 });
    });
  });

  it('lets staff assign and update a ticket from the queue', async () => {
    usePortfolio.mockReturnValue({
      userIdentity: {
        id: 77,
        username: 'staffer',
        email: 'staffer@example.com',
        isStaff: true,
        isSuperuser: false,
      },
    });
    listSupportTickets.mockResolvedValueOnce({ data: { results: [] } });
    listStaffSupportTickets
      .mockResolvedValueOnce({ data: { results: [baseTicket] } })
      .mockResolvedValue({ data: { results: [{ ...baseTicket, assignee: 77, assignee_username: 'staffer' }] } });
    getSupportTicketDetail
      .mockResolvedValueOnce({ data: baseThread })
      .mockResolvedValue({ data: { ...baseThread, ticket: { ...baseTicket, assignee: 77, assignee_username: 'staffer' } } });
    patchStaffSupportTicket.mockResolvedValueOnce({ data: { ...baseTicket, assignee: 77, assignee_username: 'staffer' } });

    renderPage();

    fireEvent.click(await screen.findByRole('button', { name: 'support.tabs.staffQueue' }));

    await waitFor(() => {
      expect(listStaffSupportTickets).toHaveBeenCalled();
      expect(getSupportTicketDetail).toHaveBeenCalledWith('ticket-1', { page_size: 100 });
    });

    fireEvent.click(screen.getByRole('button', { name: 'support.staffActions.assignToMe' }));
    fireEvent.click(screen.getByRole('button', { name: 'support.staffActions.saveChanges' }));

    await waitFor(() => {
      expect(patchStaffSupportTicket).toHaveBeenCalledWith('ticket-1', {
        status: 'OPEN',
        priority: 'HIGH',
        assignee_id: 77,
      });
    });
  });

  it('uses the staff reply endpoint when staff responds in queue mode', async () => {
    usePortfolio.mockReturnValue({
      userIdentity: {
        id: 77,
        username: 'staffer',
        email: 'staffer@example.com',
        isStaff: true,
        isSuperuser: false,
      },
    });
    listSupportTickets.mockResolvedValueOnce({ data: { results: [] } });
    listStaffSupportTickets
      .mockResolvedValueOnce({ data: { results: [baseTicket] } })
      .mockResolvedValue({ data: { results: [baseTicket] } });
    getSupportTicketDetail
      .mockResolvedValueOnce({ data: baseThread })
      .mockResolvedValue({ data: baseThread });
    replyStaffSupportTicket.mockResolvedValueOnce({
      data: {
        id: 'msg-2',
        sender_role: 'STAFF',
        body: 'We have started investigating this issue.',
      },
    });

    renderPage();

    fireEvent.click(await screen.findByRole('button', { name: 'support.tabs.staffQueue' }));

    await waitFor(() => {
      expect(getSupportTicketDetail).toHaveBeenCalledWith('ticket-1', { page_size: 100 });
    });

    await userEvent.type(screen.getByPlaceholderText('support.replyPlaceholder'), 'We have started investigating this issue.');
    fireEvent.click(screen.getByRole('button', { name: 'support.sendReply' }));

    await waitFor(() => {
      expect(replyStaffSupportTicket).toHaveBeenCalledWith('ticket-1', {
        body: 'We have started investigating this issue.',
      });
    });
  });
});