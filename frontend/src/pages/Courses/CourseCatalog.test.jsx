// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import CourseCatalog from './CourseCatalog';

const api = vi.hoisted(() => ({
  fetchCourses: vi.fn(),
}));

vi.mock('../../services/api', () => api);
vi.mock('../../hooks/useNetworkStatus', () => ({ default: () => true }));

describe('CourseCatalog states and student visibility', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it('shows loading, then only renders enrolled course cards returned by the API', async () => {
    api.fetchCourses.mockResolvedValue({
      items: [{
        id: 'course-1',
        code: 'MATH101',
        title: 'Математик',
        description: 'Тооны хичээл',
        credits: 3,
        level: 'beginner',
        _count: { cohorts: 1 },
      }],
      pagination: { page: 1, pages: 1, total: 1 },
    });

    render(<MemoryRouter><CourseCatalog /></MemoryRouter>);

    expect(screen.getByLabelText('Ачааллаж байна')).toBeTruthy();
    await waitFor(() => expect(screen.getByText('Математик')).toBeTruthy());
    expect(screen.queryByText('Хичээл олдсонгүй')).toBeNull();
    expect(screen.queryByText('Нууц course')).toBeNull();
  });

  it('shows an empty state when filters match no courses', async () => {
    api.fetchCourses.mockResolvedValue({
      items: [],
      pagination: { page: 1, pages: 0, total: 0 },
    });

    render(<MemoryRouter><CourseCatalog /></MemoryRouter>);

    await waitFor(() => expect(screen.getByText('Хичээл олдсонгүй')).toBeTruthy());
    expect(screen.getByText('Таны бүртгэлтэй published хичээл одоогоор алга.')).toBeTruthy();
  });

  it('shows a retryable error state when the course request fails', async () => {
    api.fetchCourses.mockRejectedValue(new Error('Network failed'));

    render(<MemoryRouter><CourseCatalog /></MemoryRouter>);

    await waitFor(() => expect(screen.getByRole('alert')).toBeTruthy());
    expect(screen.getByText('Network failed')).toBeTruthy();
    expect(screen.getByRole('button', { name: /Дахин оролдох/ })).toBeTruthy();
  });
});
