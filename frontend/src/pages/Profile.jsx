import { useAuth } from '../context/AuthContext';
import Card from '../components/ui/Card';
import PageHeader from '../components/ui/PageHeader';

export default function Profile() {
  const { user } = useAuth();

  if (!user) {
    return (
      <div className="space-y-6">
        <PageHeader title="Profile" subtitle="Your personal information." />
        <Card>
          <p>Loading user profile...</p>
        </Card>
      </div>
    );
  }

  const profileFields = [
    { label: 'First Name', value: user.firstName },
    { label: 'Last Name', value: user.lastName },
    { label: 'Email', value: user.email },
    { label: 'Role', value: user.role },
    { label: 'Organization ID', value: user.organizationId },
  ];

  return (
    <div className="space-y-6">
      <PageHeader title="My Profile" subtitle="Your personal information." />
      <Card>
        <dl className="grid gap-4 sm:grid-cols-2">
          {profileFields.map((field, index) => (
            <div key={index} className="rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3">
              <dt className="text-xs uppercase tracking-wide text-slate-400">{field.label}</dt>
              <dd className="mt-1 text-sm font-semibold text-slate-900">{field.value || 'N/A'}</dd>
            </div>
          ))}
        </dl>
      </Card>
    </div>
  );
}
