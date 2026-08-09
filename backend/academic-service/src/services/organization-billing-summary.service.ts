import { serviceAuthorizationHeaders } from '@lms/shared';

// Same gating/degradation pattern as report-data.service.ts's
// buildBillingRevenueReport: billing is a feature-flagged, optional service —
// a disabled flag, missing URL, or unreachable service must degrade to "no
// figure available," never block the org-admin dashboard from loading.
export const getOrganizationBillingSummary = async (
  organizationId: string,
): Promise<{ revenue: number; receivable: number; currency: string } | null> => {
  const baseUrl = process.env.BILLING_SERVICE_URL;
  if (!baseUrl || process.env.FEATURE_BILLING_ENABLED !== 'true') return null;
  try {
    const response = await fetch(
      `${baseUrl.replace(/\/+$/, '')}/internal/organizations/${encodeURIComponent(organizationId)}/revenue-summary`,
      { headers: serviceAuthorizationHeaders('academic-service'), signal: AbortSignal.timeout(5_000) },
    );
    if (!response.ok) return null;
    const payload = await response.json() as {
      data: { totalRevenue: number; totalOutstanding: number; currency: string };
    };
    return {
      revenue: payload.data.totalRevenue,
      receivable: payload.data.totalOutstanding,
      currency: payload.data.currency,
    };
  } catch (error) {
    console.warn('[Dashboard] billing-service revenue summary unavailable', error);
    return null;
  }
};
