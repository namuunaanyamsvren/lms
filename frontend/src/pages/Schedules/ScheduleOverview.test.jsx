// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import ScheduleOverview from './ScheduleOverview';

const schedule = {
  id: '44444444-4444-4444-8444-444444444444',
  courseId: '11111111-1111-4111-8111-111111111111',
  title: 'Математикийн лекц',
  dayOfWeek: 'MONDAY',
  startTime: '09:00',
  endTime: '10:30',
  semester: '2026-FALL',
  room: '201',
  course: { code: 'MATH101', title: 'Математик' },
  teacher: { firstName: 'Болд', lastName: 'Багш' },
  term: { name: 'Намрын улирал', startDate: '2026-08-20T00:00:00.000Z', endDate: '2026-12-20T00:00:00.000Z' },
};

const api = vi.hoisted(() => ({
  fetchSchedules: vi.fn(),
  fetchMySchedules: vi.fn(),
  fetchScheduleOptions: vi.fn(),
  deleteSchedule: vi.fn(),
}));

vi.mock('../../services/api', () => api);

describe('ScheduleOverview integration', () => {
  beforeEach(() => {
    api.fetchSchedules.mockResolvedValue([schedule]);
    api.fetchMySchedules.mockResolvedValue([schedule]);
    api.fetchScheduleOptions.mockResolvedValue({
      timezone: 'Asia/Ulaanbaatar',
      courses: [{ id: schedule.courseId, code: 'MATH101', title: 'Математик' }],
      terms: [{ id: 'term-1', code: '2026-FALL', name: 'Намар' }],
      rooms: [],
      teachers: [],
      children: [],
    });
    api.deleteSchedule.mockResolvedValue({ success: true });
  });
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('loads teacher schedules and changes between table and calendar views', async () => {
    render(<MemoryRouter><ScheduleOverview audience="teacher" /></MemoryRouter>);
    expect((await screen.findAllByText('Математикийн лекц')).length).toBeGreaterThan(0);
    expect(screen.getByText('Даваа')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: '7 хоног' }));
    expect(screen.getByRole('region', { name: 'Хуваарийн харагдац' })).toBeTruthy();
    expect(api.fetchSchedules).toHaveBeenCalled();
  });

  it('requires an explicit confirmation before deleting', async () => {
    render(<MemoryRouter><ScheduleOverview audience="teacher" /></MemoryRouter>);
    await screen.findAllByText('Математикийн лекц');
    fireEvent.click(screen.getAllByRole('button', { name: 'Математикийн лекц устгах' })[0]);
    const dialog = screen.getByRole('dialog', { name: 'Хуваарь устгах уу?' });
    expect(dialog).toBeTruthy();
    expect(api.deleteSchedule).not.toHaveBeenCalled();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Устгах' }));
    await waitFor(() => expect(api.deleteSchedule).toHaveBeenCalledWith(schedule.id));
  });
});
