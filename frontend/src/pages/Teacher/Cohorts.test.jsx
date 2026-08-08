// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ConfirmProvider } from '../../components/ui/ConfirmDialog';
import { ToastProvider } from '../../context/ToastContext';
import Cohorts from './Cohorts';

const api = vi.hoisted(() => ({
  createCohort: vi.fn(),
  createAnnouncement: vi.fn(),
  completeCohort: vi.fn(),
  enrollStudent: vi.fn(),
  fetchAssignments: vi.fn(),
  fetchAvailableStudents: vi.fn(),
  fetchCohorts: vi.fn(),
  fetchCourses: vi.fn(),
  fetchAttendance: vi.fn(),
  fetchReportData: vi.fn(),
  fetchSubmissions: vi.fn(),
  importCohortEnrollments: vi.fn(),
  removeEnrollment: vi.fn(),
}));

vi.mock('../../services/api', () => api);

const renderCohorts = () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <ConfirmProvider>
          <MemoryRouter><Cohorts /></MemoryRouter>
        </ConfirmProvider>
      </ToastProvider>
    </QueryClientProvider>,
  );
};

describe('Cohorts enrollment UI', () => {
  beforeEach(() => {
    api.fetchCohorts.mockResolvedValue([{
      id: 'cohort-1',
      name: '2026 намар А',
      course: { title: 'Математик' },
      enrollments: [{ id: 'enrollment-1', userId: 'student-1', user: { firstName: 'Болд', lastName: 'Сурагч', email: 'bold@example.test' } }],
    }]);
    api.fetchCourses.mockResolvedValue({ items: [{ id: 'course-1', title: 'Математик' }] });
    api.fetchAvailableStudents.mockResolvedValue([
      { id: 'student-1', firstName: 'Болд', lastName: 'Сурагч', email: 'bold@example.test' },
      { id: 'student-2', firstName: 'Сараа', lastName: 'Сурагч', email: 'saraa@example.test' },
    ]);
    api.enrollStudent.mockResolvedValue({ success: true });
    api.removeEnrollment.mockResolvedValue({ success: true });
    api.createCohort.mockResolvedValue({ success: true });
    api.createAnnouncement.mockResolvedValue({ success: true });
    api.completeCohort.mockResolvedValue({ data: { results: [] } });
    api.fetchAttendance.mockResolvedValue([]);
    api.fetchAssignments.mockResolvedValue([]);
    api.fetchSubmissions.mockResolvedValue([]);
    api.fetchReportData.mockResolvedValue({ columns: [], rows: [] });
    api.importCohortEnrollments.mockResolvedValue({ data: { imported: 0, total: 0, results: [] } });
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('selects a cohort, filters already-enrolled students, and enrolls a new student', async () => {
    renderCohorts();

    fireEvent.click(await screen.findByText(/Математик/));
    await waitFor(() => expect(api.fetchAvailableStudents).toHaveBeenCalled());
    expect(screen.getByText(/Болд Сурагч/)).toBeTruthy();

    const select = screen.getByDisplayValue('Шинэ сурагч сонгох');
    await waitFor(() => {
      const optionText = Array.from(select.options).map(option => option.textContent).join('\n');
      expect(optionText).not.toContain('bold@example.test');
      expect(optionText).toContain('saraa@example.test');
    });
    fireEvent.change(select, { target: { value: 'student-2' } });
    fireEvent.click(screen.getByRole('button', { name: /Нэмэх/ }));

    await waitFor(() => expect(api.enrollStudent).toHaveBeenCalledWith('cohort-1', 'student-2'));
  });
});
