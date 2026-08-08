import { apiClient } from './apiClient';

const safeSession = session => ({
  id: String(session.id),
  deviceName: session.deviceName || 'Тодорхойгүй төхөөрөмж',
  userAgent: session.userAgent || '',
  ipAddress: session.ipAddress || '—',
  createdAt: session.createdAt || null,
  lastUsedAt: session.lastUsedAt || null,
  expiresAt: session.expiresAt || null,
  revokedAt: session.revokedAt || null,
  current: session.current === true,
});

export const fetchActiveSessions = async () => {
  const response = await apiClient.get('/auth/sessions');
  const sessions = Array.isArray(response.data?.data) ? response.data.data : [];
  return sessions.map(safeSession);
};

export const revokeActiveSession = async sessionId => {
  const response = await apiClient.delete(`/auth/sessions/${encodeURIComponent(sessionId)}`);
  return response.data;
};

export const logoutAllSessions = async () => {
  const response = await apiClient.post('/auth/logout-all');
  return response.data;
};
