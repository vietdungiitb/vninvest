import apiClient from './client';

export const listSupportTickets = (params = {}) =>
  apiClient.get('/support/tickets/', { params });

export const createSupportTicket = (payload) =>
  apiClient.post('/support/tickets/', payload);

export const getSupportTicketDetail = (ticketId, params = {}) =>
  apiClient.get(`/support/tickets/${ticketId}/`, { params });

export const replySupportTicket = (ticketId, payload) =>
  apiClient.post(`/support/tickets/${ticketId}/reply/`, payload);

export const reopenSupportTicket = (ticketId) =>
  apiClient.post(`/support/tickets/${ticketId}/reopen/`);

export const listStaffSupportTickets = (params = {}) =>
  apiClient.get('/support/staff/tickets/', { params });

export const getStaffSupportDashboard = () =>
  apiClient.get('/support/staff/dashboard/');

export const patchStaffSupportTicket = (ticketId, payload) =>
  apiClient.patch(`/support/staff/tickets/${ticketId}/`, payload);

export const replyStaffSupportTicket = (ticketId, payload) =>
  apiClient.post(`/support/staff/tickets/${ticketId}/reply/`, payload);
