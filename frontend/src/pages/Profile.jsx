import { useEffect, useRef, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import Card from '../components/ui/Card';
import PageHeader from '../components/ui/PageHeader';
import { updateMyProfile, uploadAvatar, getSignedFileUrl } from '../services/api';
import { useToast } from '../context/ToastContext';
import { Camera } from 'lucide-react';

const ROLE_LABELS = {
  USER: 'Энгийн хэрэглэгч',
  STUDENT: 'Сурагч',
  INSTRUCTOR: 'Багш',
  PARENT: 'Эцэг эх',
  PRINCIPAL: 'Захирал',
  ORG_ADMIN: 'Менежер',
  SUPER_ADMIN: 'Ерөнхий менежер',
};

const LANGUAGES = [{ value: 'mn', label: 'Монгол' }, { value: 'en', label: 'English' }];
const TIMEZONES = ['Asia/Ulaanbaatar', 'UTC'];

export default function Profile() {
  const { user, refreshUser } = useAuth();
  const { showToast } = useToast();
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef(null);

  useEffect(() => {
    if (!user) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setForm({
      firstName: user.firstName || '',
      lastName: user.lastName || '',
      phone: user.phone || '',
      language: user.language || 'mn',
      timezone: user.timezone || 'Asia/Ulaanbaatar',
      notificationPreferences: user.notificationPreferences || {},
    });
    if (user.profileImageKey) {
      getSignedFileUrl(user.profileImageKey).then((res) => setAvatarUrl(res.url)).catch(() => {});
    }
  }, [user]);

  if (!user || !form) {
    return (
      <div className="space-y-6">
        <PageHeader title="Хувийн мэдээлэл" subtitle="Таны бүртгэлийн мэдээлэл." />
        <Card><p>Хувийн мэдээллийг ачааллаж байна...</p></Card>
      </div>
    );
  }

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await updateMyProfile(form);
      await refreshUser();
      showToast('Мэдээлэл шинэчлэгдлээ.', 'success');
    } catch (err) {
      showToast(err?.response?.data?.message || 'Хадгалахад алдаа гарлаа', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleAvatarChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const asset = await uploadAvatar(file);
      await updateMyProfile({ profileImageKey: asset.storageKey });
      const signed = await getSignedFileUrl(asset.storageKey);
      setAvatarUrl(signed.url);
      await refreshUser();
      showToast('Профайл зураг шинэчлэгдлээ.', 'success');
    } catch (err) {
      showToast(err?.response?.data?.message || 'Зураг оруулахад алдаа гарлаа', 'error');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const toggleNotification = (channel) => {
    setForm({
      ...form,
      notificationPreferences: {
        ...form.notificationPreferences,
        [channel]: !form.notificationPreferences?.[channel],
      },
    });
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Миний мэдээлэл" subtitle="Таны бүртгэлийн мэдээлэл болон тохиргоо." />

      <Card>
        <div className="flex items-center gap-4">
          <div className="relative">
            <div className="w-16 h-16 rounded-full bg-indigo-100 overflow-hidden flex items-center justify-center text-indigo-600 font-bold text-xl">
              {avatarUrl ? <img src={avatarUrl} alt="Avatar" className="w-full h-full object-cover" /> : (user.firstName?.[0] || user.email?.[0] || '?')}
            </div>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="absolute -bottom-1 -right-1 rounded-full bg-indigo-600 p-1.5 text-white shadow-md hover:bg-indigo-700 disabled:opacity-50"
              title="Зураг солих"
            >
              <Camera size={13} />
            </button>
            <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarChange} />
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-900">{[user.lastName, user.firstName].filter(Boolean).join(' ') || user.email}</p>
            <p className="text-xs text-slate-500">{ROLE_LABELS[user.role] || user.role} · {user.email}</p>
          </div>
        </div>
      </Card>

      <Card title="Хувийн мэдээлэл засах">
        <form onSubmit={handleSave} className="space-y-4 text-xs">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Нэр</label>
              <input value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} className="w-full rounded-2xl border border-slate-200 bg-slate-50 p-2.5 text-xs focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500" />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Овог</label>
              <input value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} className="w-full rounded-2xl border border-slate-200 bg-slate-50 p-2.5 text-xs focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500" />
            </div>
          </div>
          <div>
            <label className="block font-semibold text-slate-700 mb-1">Утасны дугаар</label>
            <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="w-full rounded-2xl border border-slate-200 bg-slate-50 p-2.5 text-xs focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500" />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Хэл</label>
              <select value={form.language} onChange={(e) => setForm({ ...form, language: e.target.value })} className="w-full rounded-2xl border border-slate-200 bg-slate-50 p-2.5 text-xs focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500">
                {LANGUAGES.map((l) => <option key={l.value} value={l.value}>{l.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Цагийн бүс</label>
              <select value={form.timezone} onChange={(e) => setForm({ ...form, timezone: e.target.value })} className="w-full rounded-2xl border border-slate-200 bg-slate-50 p-2.5 text-xs focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500">
                {TIMEZONES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="block font-semibold text-slate-700 mb-2">Мэдэгдэл хүлээн авах суваг</label>
            <div className="flex gap-4">
              {['email', 'sms', 'push'].map((channel) => (
                <label key={channel} className="flex items-center gap-2">
                  <input type="checkbox" checked={Boolean(form.notificationPreferences?.[channel])} onChange={() => toggleNotification(channel)} />
                  <span className="capitalize">{channel}</span>
                </label>
              ))}
            </div>
          </div>
          <div className="flex justify-end pt-3 border-t border-slate-100">
            <button type="submit" disabled={saving} className="rounded-2xl bg-indigo-600 px-5 py-2 text-xs font-semibold text-white hover:bg-indigo-700 shadow-md transition disabled:opacity-50">
              {saving ? 'Хадгалж байна...' : 'Хадгалах'}
            </button>
          </div>
        </form>
      </Card>
    </div>
  );
}
