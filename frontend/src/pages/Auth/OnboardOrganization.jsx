import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { onboardOrganization } from '../../services/api';
import { t } from '../../i18n';
import { getPasswordMinimumLength, validatePasswordForForm } from '../../utils/passwordPolicy';

export default function OnboardOrganization() {
  const navigate = useNavigate();
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
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
  const submit = async event => {
    event.preventDefault();
    setError('');
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
    try {
      await onboardOrganization({
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
      navigate(`/login?tenant=${encodeURIComponent(normalizedSlug)}`, {
        state: { organizationCreated: true, tenantSlug: normalizedSlug },
      });
    } catch (requestError) {
      setError(formatRequestError(requestError));
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
      {error && <p className="whitespace-pre-line text-sm text-red-600">{error}</p>}
      <button disabled={saving} className="w-full rounded-lg bg-primary py-2.5 font-semibold text-white disabled:opacity-50">{saving ? t('onboarding.saving') : t('onboarding.submit')}</button>
      <p className="text-center text-sm text-slate-500">{t('onboarding.haveTenant')} <Link className="text-primary" to="/login">{t('onboarding.signIn')}</Link></p>
    </form>
  );
}
