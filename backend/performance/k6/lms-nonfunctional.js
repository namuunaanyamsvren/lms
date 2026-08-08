import http from 'k6/http';
import { check, group, sleep } from 'k6';
import { Trend, Rate } from 'k6/metrics';

const BASE_URL = __ENV.BASE_URL || 'http://127.0.0.1:8080/api/v1';
const TENANT = __ENV.TENANT || 'e2e-school';
const EMAIL = __ENV.EMAIL || 'admin@example.test';
const PASSWORD = __ENV.PASSWORD || 'Correct horse battery staple 47';

export const dashboardLatency = new Trend('dashboard_latency_ms');
export const listLatency = new Trend('list_latency_ms');
export const loginFailures = new Rate('login_failures');

export const options = {
  scenarios: {
    smoke_load: {
      executor: 'ramping-vus',
      stages: [
        { duration: '30s', target: Number(__ENV.LOAD_VUS || 10) },
        { duration: '1m', target: Number(__ENV.LOAD_VUS || 10) },
        { duration: '30s', target: 0 },
      ],
      exec: 'loadJourney',
    },
    spike: {
      executor: 'ramping-vus',
      startTime: '2m10s',
      stages: [
        { duration: '10s', target: Number(__ENV.SPIKE_VUS || 50) },
        { duration: '30s', target: Number(__ENV.SPIKE_VUS || 50) },
        { duration: '10s', target: 0 },
      ],
      exec: 'loadJourney',
    },
    soak: {
      executor: 'constant-vus',
      startTime: '3m10s',
      vus: Number(__ENV.SOAK_VUS || 5),
      duration: __ENV.SOAK_DURATION || '5m',
      exec: 'loadJourney',
    },
  },
  thresholds: {
    http_req_failed: ['rate<0.05'],
    http_req_duration: ['p(95)<1500'],
    dashboard_latency_ms: ['p(95)<1500'],
    list_latency_ms: ['p(95)<1500'],
    login_failures: ['rate<0.01'],
  },
};

const jsonHeaders = { 'content-type': 'application/json' };

function resolveTenant() {
  const res = http.get(`${BASE_URL}/organizations/resolve?host=${encodeURIComponent(TENANT)}`);
  check(res, { 'tenant resolved': r => r.status === 200 });
  const body = res.json();
  return body?.data?.id || body?.data?.data?.id || 'org_e2e';
}

function login(organizationId) {
  const res = http.post(`${BASE_URL}/auth/login`, JSON.stringify({
    organizationId,
    identifier: EMAIL,
    email: EMAIL,
    password: PASSWORD,
  }), { headers: jsonHeaders });
  const ok = check(res, { 'login ok': r => r.status === 200 && Boolean(r.json('data.token')) });
  loginFailures.add(!ok);
  return res.json('data.token');
}

export function loadJourney() {
  let token;
  group('gateway/login', () => {
    token = login(resolveTenant());
  });
  if (!token) return;

  const authHeaders = { authorization: `Bearer ${token}` };
  group('dashboard', () => {
    const start = Date.now();
    const res = http.get(`${BASE_URL}/dashboards/admin`, { headers: authHeaders });
    dashboardLatency.add(Date.now() - start);
    check(res, { 'dashboard available': r => [200, 403, 404].includes(r.status) });
  });

  group('list endpoints', () => {
    for (const path of ['/users?page=1&pageSize=10', '/courses?limit=10', '/notifications?limit=20']) {
      const start = Date.now();
      const res = http.get(`${BASE_URL}${path}`, { headers: authHeaders });
      listLatency.add(Date.now() - start);
      check(res, { [`${path} bounded response`]: r => r.status < 500 });
    }
  });

  sleep(1);
}
