import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { createOnboardingStripeCheckout, onboardOrganization } from '../../services/api';
import { t } from '../../i18n';
import { getPasswordMinimumLength, validatePasswordForForm } from '../../utils/passwordPolicy';

const billingPlans = [
  { key: 'monthly', label: '1 сар', amount: 99000, caption: 'Сар бүр сунгана' },
  { key: 'yearly', label: '1 жил', amount: 990000, caption: 'Жилийн эрх' },
  { key: 'four_year', label: '4 жил', amount: 2990000, caption: 'Урт хугацааны эрх' },
];
const formatMnt = amount => new Intl.NumberFormat('mn-MN').format(amount);

export default function OnboardOrganization() {
  const navigate = useNavigate();
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [planKey, setPlanKey] = useState('monthly');
  const [pendingOrganization, setPendingOrganization] = useState(null);
  const [form, setForm] = useState({
    name: '', slug: '', domain: '', primaryColor: '#4F46E5', maxUsers: 100,
    email: '', password: '', firstName: '', lastName: '',
  });
  const normalizeSlug = value => value
    .trim()
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 100);
  const formatRequestError = requestError => {
    if (requestError.status === 429) {
      return 'Байгууллага үүсгэх хүсэлт түр хугацаанд хязгаарлагдлаа. Нэг минут хүлээгээд дахин оролдоно уу.';
    }
    const details = requestError.details;
    if (details?.fieldErrors) {
      const messages = Object.entries(details.fieldErrors)
        .flatMap(([field, errors]) => (errors || []).map(message => `${field}: ${message}`));
      if (messages.length) return messages.join('\n');
    }
    return requestError.message || 'Байгууллага үүсгэхэд алдаа гарлаа.';
  };
  const change = event => {
    const { name, value } = event.target;
    setForm(current => ({ ...current, [name]: name === 'slug' ? normalizeSlug(value) : value }));
  };
  const startCheckout = async organization => {
    const checkout = await createOnboardingStripeCheckout({
      organizationId: organization.id,
      planKey,
      onboardingPaymentToken: organization.onboardingPaymentToken,
      successUrl: `${window.location.origin}/login?stripe=success`,
      cancelUrl: `${window.location.origin}/onboard?stripe=cancelled`,
    });
    if (checkout?.checkoutUrl) {
      window.location.assign(checkout.checkoutUrl);
      return true;
    }
    return false;
  };
  const submit = async event => {
    event.preventDefault();
    setError('');
    if (pendingOrganization) {
      setSaving(true);
      try {
        const redirected = await startCheckout(pendingOrganization);
        if (!redirected) navigate('/login', { state: { organizationCreated: true, tenantSlug: pendingOrganization.slug } });
      } catch (requestError) {
        setError(`Байгууллага үүссэн боловч Stripe төлбөрийн хуудас нээгдсэнгүй. Доорх товчийг дахин дарж төлбөрөө үргэлжлүүлнэ үү.\n\n${formatRequestError(requestError)}`);
      } finally {
        setSaving(false);
      }
      return;
    }
    const normalizedSlug = normalizeSlug(form.slug);
    if (!normalizedSlug) {
      setError('Tenant slug талбарт жижиг латин үсэг, тоо эсвэл зураас ашиглана уу. Жишээ: mongol-erdem');
      return;
    }
    if (form.domain && !/^(?!-)[a-z0-9-]+(?:\.[a-z0-9-]+)+$/.test(form.domain.trim().toLowerCase())) {
      setError('Домэйн буруу байна. Жишээ: school.mn эсвэл lms.school.mn');
      return;
    }
    const passwordError = validatePasswordForForm(form.password, form);
    if (passwordError) {
      setError(passwordError);
      return;
    }
    setSaving(true);
    let createdOrganization = null;
    try {
      const organization = await onboardOrganization({
        name: form.name.trim(),
        slug: normalizedSlug,
        ...(form.domain ? { domain: form.domain.trim().toLowerCase() } : {}),
        primaryColor: form.primaryColor,
        maxUsers: Number(form.maxUsers),
        allowRegister: true,
        admin: {
          email: form.email.trim().toLowerCase(),
          password: form.password,
          firstName: form.firstName.trim(),
          lastName: form.lastName.trim(),
        },
      });
      createdOrganization = organization;
      setPendingOrganization(organization);
      const redirected = await startCheckout(organization);
      if (redirected) return;
      navigate('/login', { state: { organizationCreated: true, tenantSlug: normalizedSlug } });
    } catch (requestError) {
      setError(createdOrganization
        ? `Байгууллага үүссэн боловч Stripe төлбөрийн хуудас нээгдсэнгүй. Доорх товчийг дахин дарж төлбөрөө үргэлжлүүлнэ үү.\n\n${formatRequestError(requestError)}`
        : formatRequestError(requestError));
    } finally {
      setSaving(false);
    }
  };
  return (
    <form onSubmit={submit} className="mx-auto w-full max-w-2xl space-y-5 rounded-2xl bg-white p-8 shadow">
      <div><h1 className="text-2xl font-bold">{t('onboarding.title')}</h1><p className="text-sm text-slate-500">{t('onboarding.subtitle')}</p></div>
      <div className="grid gap-4 sm:grid-cols-2">
        {[
          ['name', t('onboarding.name')], ['slug', t('onboarding.slug')], ['domain', t('onboarding.domain')],
          ['firstName', t('onboarding.adminFirstName')], ['lastName', t('onboarding.adminLastName')], ['email', t('onboarding.adminEmail')],
        ].map(([name, label]) => (
          <label key={name} className="space-y-1 text-sm">
            <span>{label}</span>
            <input
              name={name}
              value={form[name]}
              onChange={change}
              required={name !== 'domain'}
              placeholder={name === 'slug' ? 'mongol-erdem' : name === 'domain' ? 'school.mn' : undefined}
              className="w-full rounded-lg border px-3 py-2"
            />
            {name === 'slug' && <span className="block text-xs text-slate-500">Жижиг латин үсэг, тоо, зураас ашиглана.</span>}
          </label>
        ))}
        <label className="space-y-1 text-sm"><span>{t('onboarding.adminPassword')}</span><input type="password" minLength={getPasswordMinimumLength()} maxLength={128} name="password" value={form.password} onChange={change} required className="w-full rounded-lg border px-3 py-2" /></label>
        <label className="space-y-1 text-sm"><span>{t('onboarding.maxUsers')}</span><input type="number" min="1" name="maxUsers" value={form.maxUsers} onChange={change} className="w-full rounded-lg border px-3 py-2" /></label>
      </div>
      <fieldset className="space-y-3">
        <legend className="text-sm font-semibold text-slate-700">SaaS төлбөрийн багц</legend>
        <div className="grid gap-3 sm:grid-cols-3">
          {billingPlans.map(plan => (
            <label
              key={plan.key}
              className={`cursor-pointer rounded-lg border p-4 text-sm transition ${planKey === plan.key ? 'border-primary bg-primary/5 ring-2 ring-primary/20' : 'border-slate-200 hover:border-slate-300'}`}
            >
              <input
                type="radio"
                name="billingPlan"
                value={plan.key}
                checked={planKey === plan.key}
                onChange={() => setPlanKey(plan.key)}
                className="sr-only"
              />
              <span className="block font-semibold text-slate-900">{plan.label}</span>
              <span className="mt-1 block text-lg font-bold text-slate-950">{formatMnt(plan.amount)} MNT</span>
              <span className="mt-1 block text-xs text-slate-500">{plan.caption}</span>
            </label>
          ))}
        </div>
      </fieldset>
      {error && <p className="whitespace-pre-line text-sm text-red-600">{error}</p>}
      <button disabled={saving} className="w-full rounded-lg bg-primary py-2.5 font-semibold text-white disabled:opacity-50">{saving ? 'Stripe төлбөр рүү шилжүүлж байна...' : pendingOrganization ? 'Stripe төлбөрийг дахин нээх' : 'Байгууллага үүсгээд Stripe-аар төлөх'}</button>
      <p className="text-center text-sm text-slate-500">{t('onboarding.haveTenant')} <Link className="text-primary" to="/login">{t('onboarding.signIn')}</Link></p>
    </form>
  );
}
