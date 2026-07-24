const BASE_ACADEMIC_URL = 'http://localhost:8003/api';

// A helper function for making authenticated API requests.
// It retrieves the JWT token from localStorage and adds it to the Authorization header.
const fetchWithAuth = async (url, options = {}) => {
  const token = localStorage.getItem('lms_token');
  const headers = {
    'Content-Type': 'application/json',
    ...options.headers,
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(url, { ...options, headers });

  if (!response.ok) {
    throw new Error(`API request failed with status ${response.status}`);
  }
  return response.json();
};

export const fetchCourses = async () => {
  try {
    const data = await fetchWithAuth(`${BASE_ACADEMIC_URL}/courses`);
    return data.success ? data.data : [];
  } catch (err) {
    console.error('Failed to fetch courses:', err);
    return [];
  }
};

export const getStudentDashboardData = async () => {
  return fetchWithAuth(`${BASE_ACADEMIC_URL}/dashboards/student`);
};

export const getAdminDashboardData = async () => {
  return fetchWithAuth(`${BASE_ACADEMIC_URL}/dashboards/admin`);
};

export const getTeacherDashboardData = async () => {
  return fetchWithAuth(`${BASE_ACADEMIC_URL}/dashboards/teacher`);
};

export const getParentDashboardData = async () => {
  return fetchWithAuth(`${BASE_ACADEMIC_URL}/dashboards/parent`);
};

export const getStaffDashboardData = async () => {
  return fetchWithAuth(`${BASE_ACADEMIC_URL}/dashboards/staff`);
};

export const getPrincipalDashboardData = async () => {
  return fetchWithAuth(`${BASE_ACADEMIC_URL}/dashboards/principal`);
};

export const fetchAssignments = async () => {
  try {
    const data = await fetchWithAuth(`${BASE_ACADEMIC_URL}/assignments`);
    return data.success ? data.data : [];
  } catch (err) {
    console.error('Failed to fetch assignments:', err);
    return [];
  }
};

export const fetchQuizzes = async () => {
  try {
    const data = await fetchWithAuth(`${BASE_ACADEMIC_URL}/quizzes`);
    return data.success ? data.data : [];
  } catch (err) {
    console.error('Failed to fetch quizzes:', err);
    return [];
  }
};

export const fetchAttendance = async () => {
  try {
    const data = await fetchWithAuth(`${BASE_ACADEMIC_URL}/attendance`);
    return data.success ? data.data : [];
  } catch (err) {
    console.error('Failed to fetch attendance:', err);
    return [];
  }
};

export const fetchGrades = async () => {
  try {
    const data = await fetchWithAuth(`${BASE_ACADEMIC_URL}/grades`);
    return data.success ? data.data : [];
  } catch (err) {
    console.error('Failed to fetch grades:', err);
    return [];
  }
};

export const fetchUsers = async () => {
  try {
    const data = await fetchWithAuth(`${BASE_ACADEMIC_URL}/users`);
    return data.success ? data.data : [];
  } catch (err) {
    console.error('Failed to fetch users:', err);
    return [];
  }
};
