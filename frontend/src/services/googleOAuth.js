const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || '/api/v1';

export const buildGoogleLoginUrl = organizationId => {
  if (typeof window === 'undefined') {
    throw new Error('Google login can only be started in a browser');
  }
  const normalizedOrganizationId = organizationId?.trim();
  if (!normalizedOrganizationId) throw new Error('Байгууллагын ID оруулна уу.');

  const base = apiBaseUrl.endsWith('/') ? apiBaseUrl : `${apiBaseUrl}/`;
  const url = new URL('auth/google', new URL(base, window.location.origin));
  url.searchParams.set('organizationId', normalizedOrganizationId);
  return url.toString();
};
