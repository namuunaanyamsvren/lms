import { beforeEach, describe, expect, it } from 'vitest';
import { authClient, resetApiClientForTests } from './apiClient';
import { resolveTenant } from './tenantResolution';

const axiosResponse = (config, data, status = 200) => ({
  config,
  data,
  status,
  statusText: status === 200 ? 'OK' : 'Error',
  headers: {},
});

describe('tenant resolution', () => {
  beforeEach(() => {
    resetApiClientForTests();
  });

  it('reads the tenant from the authRequest response body', async () => {
    const calls = [];
    authClient.defaults.adapter = async config => {
      calls.push(config.url);
      return axiosResponse(config, {
        success: true,
        data: {
          id: 'org-real',
          name: 'Монгол Эрдэм',
          slug: 'mongol-erdem',
          primaryColor: '#4F46E5',
        },
      });
    };

    const tenant = await resolveTenant('Mongol Erdem');

    expect(calls).toEqual(['/organizations/resolve?host=mongol-erdem']);
    expect(tenant).toMatchObject({
      id: 'org-real',
      slug: 'mongol-erdem',
    });
  });
});
