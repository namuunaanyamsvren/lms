// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import Notifications from './Notifications';

const api = vi.hoisted(() => ({
  clearNotifications: vi.fn(),
  deleteNotification: vi.fn(),
  fetchNotifications: vi.fn(),
  markAllNotificationsAsRead: vi.fn(),
  markNotificationAsRead: vi.fn(),
}));

vi.mock('../services/api', () => api);
vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({ user: { role: 'STUDENT' } }),
}));

describe('Notifications page state', () => {
  beforeEach(() => {
    api.fetchNotifications.mockResolvedValue([
      { id: 'n-1', title: 'Шинэ даалгавар', description: 'Даалгавар нэмэгдлээ', read: false, createdAt: '2026-08-05T00:00:00.000Z' },
      { id: 'n-2', title: 'Уншсан мэдээ', description: 'Аль хэдийн уншсан', read: true, createdAt: '2026-08-04T00:00:00.000Z' },
    ]);
    api.markNotificationAsRead.mockResolvedValue({ success: true });
    api.markAllNotificationsAsRead.mockResolvedValue({ success: true });
    api.deleteNotification.mockResolvedValue({ success: true });
    api.clearNotifications.mockResolvedValue({ success: true });
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('marks one notification as read and updates unread state', async () => {
    render(<MemoryRouter><Notifications /></MemoryRouter>);
    await screen.findByText('Шинэ даалгавар');

    fireEvent.click(screen.getByTitle('Уншсанаар тэмдэглэх'));

    await waitFor(() => expect(api.markNotificationAsRead).toHaveBeenCalledWith('n-1'));
    expect(screen.getByText('0 уншаагүй мэдэгдэл байна')).toBeTruthy();
  });

  it('clears all notifications from the visible list', async () => {
    render(<MemoryRouter><Notifications /></MemoryRouter>);
    await screen.findByText('Шинэ даалгавар');

    fireEvent.click(screen.getByText('Бүгдийг цэвэрлэх').closest('button'));

    await waitFor(() => expect(api.clearNotifications).toHaveBeenCalled());
    expect(screen.getByText('Мэдэгдэл алга')).toBeTruthy();
  });
});
