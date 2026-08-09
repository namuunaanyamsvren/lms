// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import ActiveSessions, { summarizeUserAgent } from './ActiveSessions';
import { apiClient, resetApiClientForTests } from '../../services/apiClient';

const axiosResponse = (config, data) => ({
  config,
  data,
  status: 200,
  statusText: 'OK',
  headers: {},
});

const sessions = [
  {
    id: 'current-session',
    deviceName: 'Work MacBook',
    userAgent: 'Mozilla/5.0 (Mac OS X) AppleWebKit Safari/537.36',
    ipAddress: '203.0.xxx.xxx',
    createdAt: '2026-07-20T00:00:00.000Z',
    lastUsedAt: new Date().toISOString(),
    expiresAt: '2026-08-20T00:00:00.000Z',
    current: true,
  },
  {
    id: 'other-session',
    deviceName: 'Android phone',
    userAgent: 'Mozilla/5.0 (Linux; Android 14) Chrome/126.0',
    ipAddress: '198.51.xxx.xxx',
    createdAt: '2026-07-21T00:00:00.000Z',
    lastUsedAt: '2026-07-27T00:00:00.000Z',
    expiresAt: '2026-08-21T00:00:00.000Z',
    current: false,
  },
];

describe('active session management', () => {
  beforeEach(() => {
    resetApiClientForTests();
    document.cookie = 'lms_csrf=test-csrf-token; path=/';
  });

  afterEach(() => cleanup());

  it('shows safe device metadata and browser summaries', async () => {
    apiClient.defaults.adapter = async config =>
      axiosResponse(config, { success: true, data: sessions });

    render(<ActiveSessions />);

    expect(await screen.findByText('Work MacBook')).toBeTruthy();
    expect(screen.getByText('Android phone')).toBeTruthy();
    expect(screen.getByText('203.0.xxx.xxx')).toBeTruthy();
    expect(screen.getByText('Энэ төхөөрөмж')).toBeTruthy();
    expect(screen.queryByText(/tokenFamily|tokenHash|refreshToken/i)).toBeNull();
    expect(summarizeUserAgent(sessions[1].userAgent)).toBe('Chrome • Android');
  });

  it('confirms and revokes a non-current session without ending current auth', async () => {
    const terminated = vi.fn();
    const calls = [];
    apiClient.defaults.adapter = async config => {
      calls.push(`${config.method} ${config.url}`);
      if (config.method === 'get') {
        return axiosResponse(config, { success: true, data: sessions });
      }
      return axiosResponse(config, { success: true });
    };
    render(<ActiveSessions onSessionTerminated={terminated} />);
    await screen.findByText('Android phone');

    fireEvent.click(screen.getByLabelText('Android phone session-ийг цуцлах'));
    expect(screen.getByRole('alertdialog')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Баталгаажуулах' }));

    await waitFor(() => expect(screen.queryByText('Android phone')).toBeNull());
    expect(screen.getByRole('status').textContent).toContain('амжилттай');
    expect(calls).toContain('delete /auth/sessions/other-session');
    expect(terminated).not.toHaveBeenCalled();
  });

  it('ends local auth after current-session revoke', async () => {
    const terminated = vi.fn();
    apiClient.defaults.adapter = async config => {
      if (config.method === 'get') {
        return axiosResponse(config, { success: true, data: sessions });
      }
      return axiosResponse(config, { success: true });
    };
    render(<ActiveSessions onSessionTerminated={terminated} />);
    await screen.findByText('Work MacBook');

    fireEvent.click(screen.getByLabelText('Work MacBook session-ийг цуцлах'));
    fireEvent.click(screen.getByRole('button', { name: 'Баталгаажуулах' }));

    await waitFor(() => {
      expect(terminated).toHaveBeenCalledWith('current-session-revoked');
    });
  });

  it('requires confirmation before logging out all devices', async () => {
    const terminated = vi.fn();
    apiClient.defaults.adapter = async config => {
      if (config.method === 'get') {
        return axiosResponse(config, { success: true, data: sessions });
      }
      return axiosResponse(config, { success: true });
    };
    render(<ActiveSessions onSessionTerminated={terminated} />);
    await screen.findByText('Work MacBook');

    fireEvent.click(screen.getByRole('button', { name: 'Бүх төхөөрөмжөөс гарах' }));
    expect(screen.getByRole('alertdialog')).toBeTruthy();
    expect(terminated).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Баталгаажуулах' }));

    await waitFor(() => {
      expect(terminated).toHaveBeenCalledWith('all-sessions-revoked');
    });
  });
});
