import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Card from '../../components/ui/Card';
import PageHeader from '../../components/ui/PageHeader';
import LoadingSpinner from '../../components/ui/LoadingSpinner';
import { useToast } from '../../context/ToastContext';
import {
  getParentDashboardData,
  fetchNotificationPreferences,
  updateNotificationPreferences,
} from '../../services/api';
import {
  Calendar,
  MessageCircle,
  User,
  Users,
  Mail,
} from 'lucide-react';

const ATTENDANCE_TONE = { 'Ирсэн': 'text-emerald-600', 'Тасалсан': 'text-rose-600', 'Хоцорсон': 'text-amber-600' };

const DIGEST_LABELS = { IMMEDIATE: 'Тэр даруй', DAILY: 'Өдөр бүр нэгтгэл', WEEKLY: 'Долоо хоног бүр нэгтгэл', NONE: 'Идэвхгүй' };

function NotificationPreferencesForm({ initialData }) {
  const { showToast } = useToast();
  const queryClient = useQueryClient();
  const [form, setForm] = useState({
    digestMode: initialData.digestMode || 'IMMEDIATE',
    emailEnabled: initialData.emailEnabled ?? true,
    inAppEnabled: initialData.inAppEnabled ?? true,
    pushEnabled: initialData.pushEnabled ?? false,
    smsEnabled: initialData.smsEnabled ?? false,
  });

  const saveMutation = useMutation({
    mutationFn: updateNotificationPreferences,
    onSuccess: (updated) => {
      queryClient.setQueryData(['notificationPreferences'], updated);
      showToast('Мэдэгдлийн тохиргоо хадгалагдлаа.', 'success');
    },
    onError: (err) => showToast(err?.response?.data?.message || 'Хадгалахад алдаа гарлаа', 'error'),
  });

  const toggle = (key) => setForm((prev) => ({ ...prev, [key]: !prev[key] }));

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-xs font-semibold text-slate-600 mb-1.5">Мэдэгдэл хүлээн авах давтамж</label>
        <select
          value={form.digestMode}
          onChange={(e) => setForm((prev) => ({ ...prev, digestMode: e.target.value }))}
          className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          {Object.entries(DIGEST_LABELS).map(([value, label]) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </select>
      </div>

      <div className="flex flex-wrap gap-4">
        {[
          ['emailEnabled', 'И-мэйл'],
          ['inAppEnabled', 'Апп доторх'],
          ['pushEnabled', 'Push мэдэгдэл'],
          ['smsEnabled', 'СМС'],
        ].map(([key, label]) => (
          <label key={key} className="flex items-center gap-2 text-xs font-medium text-slate-600">
            <input type="checkbox" checked={Boolean(form[key])} onChange={() => toggle(key)} className="rounded border-slate-300" />
            {label}
          </label>
        ))}
      </div>

      <button
        onClick={() => saveMutation.mutate(form)}
        disabled={saveMutation.isPending}
        className="flex items-center gap-2 rounded-2xl bg-indigo-600 px-5 py-2.5 text-xs font-semibold text-white hover:bg-indigo-700 shadow-md transition disabled:opacity-50"
      >
        <Mail size={15} /><span>{saveMutation.isPending ? 'Хадгалж байна...' : 'Хадгалах'}</span>
      </button>
    </div>
  );
}

function NotificationPreferencesCard() {
  const { data, isLoading } = useQuery({ queryKey: ['notificationPreferences'], queryFn: fetchNotificationPreferences });

  if (isLoading || !data) {
    return <div className="flex min-h-[15vh] items-center justify-center"><LoadingSpinner /></div>;
  }
  return <NotificationPreferencesForm initialData={data} />;
}

export default function Parent() {
  const [studentId, setStudentId] = useState('');
  const { data, isLoading } = useQuery({
    queryKey: ['dashboards', 'parent', studentId],
    queryFn: () => getParentDashboardData(studentId),
  });

  const children = data?.children || [];
  const selectedId = studentId || data?.child?.id || '';
  const attendancePct = data?.child?.profileStat?.progress ?? 0;
  const attendanceHint = data?.child?.profileStat?.hint || '';
  const attendanceBreakdown = data?.attendanceBreakdown || [];
  const recentGrades = data?.recentGrades || [];
  const assignmentProgress = data?.assignmentProgress || [];
  const upcomingEvents = data?.upcomingEvents || [];
  const teacherMessages = data?.teacherMessages || [];
  const courseContacts = data?.courseContacts || [];

  if (!isLoading && data?.hasChild === false) {
    return (
      <div className="space-y-6">
        <PageHeader title="Эцэг эхийн хяналтын хэсэг" subtitle="Хүүхдийнхээ сурлагын ахиц, ирц болон сургуулийн мэдээллийг нэг дороос хянах." />
        <Card>
          <div className="rounded-2xl border border-dashed border-slate-200 py-12 text-center">
            <Users size={36} className="mx-auto text-slate-300" />
            <p className="mt-3 text-sm font-semibold text-slate-700">Одоогоор батлагдсан хүүхдийн холбоос алга</p>
            <p className="mt-1 text-xs text-slate-400">"Асран хамгаалагч холбоос" хэсгээс хүүхэдтэйгээ холбогдох хүсэлт илгээнэ үү.</p>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Эцэг эхийн хяналтын хэсэг"
        subtitle="Хүүхдийнхээ сурлагын ахиц, ирц болон сургуулийн мэдээллийг нэг дороос хянах."
        right={<div><div className="font-medium text-slate-900">Өнөөдөр</div><div className="mt-1">{new Date().toLocaleDateString('mn-MN')}</div></div>}
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card title="Хүүхдийн хураангуй" className="lg:col-span-2">
          <div id="child" className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-3 rounded-3xl bg-slate-50 p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-600 text-white">
                  <User size={20} />
                </div>
                <div className="flex-1">
                  <div className="text-sm text-slate-500">Сурагч</div>
                  {children.length > 1 ? (
                    <select
                      value={selectedId}
                      onChange={(e) => setStudentId(e.target.value)}
                      className="mt-1 rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-sm font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    >
                      {children.map((child) => (
                        <option key={child.id} value={child.id}>{child.name}</option>
                      ))}
                    </select>
                  ) : (
                    <div className="text-lg font-semibold text-slate-900">{data?.child?.name || '—'}</div>
                  )}
                </div>
              </div>
              <div className="text-sm text-slate-500">{data?.child?.meta || ''}</div>
            </div>

            <div className="space-y-3 rounded-3xl bg-slate-50 p-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm text-slate-500">Ирцийн хувь</div>
                  <div className="text-3xl font-semibold text-slate-900">{isLoading ? '—' : `${attendancePct}%`}</div>
                </div>
                <div className="rounded-2xl bg-white p-3 border border-slate-200">
                  <Calendar size={20} className="text-indigo-600" />
                </div>
              </div>
              <div className="h-2 rounded-full bg-slate-200">
                <div className="h-2 rounded-full bg-emerald-500" style={{ width: `${attendancePct}%` }} />
              </div>
              <div className="text-sm text-slate-500">{attendanceHint}</div>
            </div>
          </div>
        </Card>

        <Card title="Ирцийн нэгтгэл" id="attendance">
          {isLoading ? (
            <div className="flex min-h-[15vh] items-center justify-center"><LoadingSpinner /></div>
          ) : attendanceBreakdown.length === 0 ? (
            <p className="text-sm text-slate-500">Ирцийн мэдээлэл алга.</p>
          ) : (
            <div className="space-y-4">
              {attendanceBreakdown.map((item, index) => (
                <div key={index} className="rounded-3xl bg-slate-50 p-4 border border-slate-200">
                  <div className="flex items-center justify-between text-sm font-medium text-slate-700">
                    <span>{item.label}</span>
                    <span className={ATTENDANCE_TONE[item.label] || 'text-slate-700'}>{item.value}%</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card title="Сүүлийн дүнгүүд" id="grades">
          {isLoading ? (
            <div className="flex min-h-[15vh] items-center justify-center"><LoadingSpinner /></div>
          ) : recentGrades.length === 0 ? (
            <p className="text-sm text-slate-500">Дүнгийн мэдээлэл алга.</p>
          ) : (
            <div className="space-y-3">
              {recentGrades.map((grade, index) => (
                <div key={index} className="flex items-center justify-between rounded-3xl bg-slate-50 p-4 border border-slate-200">
                  <div>
                    <div className="font-medium text-slate-900">{grade.label}</div>
                    <div className="text-sm text-slate-500">{grade.subtitle}</div>
                  </div>
                  <div className="text-xl font-semibold text-slate-900">{grade.value}</div>
                </div>
              ))}
            </div>
          )}
        </Card>

        <div id="academic-progress" className="hidden" />
        <Card title="Даалгаврын ахиц" id="assignments">
          {isLoading ? (
            <div className="flex min-h-[15vh] items-center justify-center"><LoadingSpinner /></div>
          ) : assignmentProgress.length === 0 ? (
            <p className="text-sm text-slate-500">Даалгаврын мэдээлэл алга.</p>
          ) : (
            <div className="space-y-4">
              {assignmentProgress.map((item, index) => (
                <div key={index}>
                  <div className="flex items-center justify-between text-sm font-medium text-slate-700">
                    <span>{item.label}</span>
                    <span>{item.progress}%</span>
                  </div>
                  <div className="mt-3 h-2 rounded-full bg-slate-200">
                    <div
                      className="h-2 rounded-full bg-indigo-600"
                      style={{ width: `${item.progress}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card title="Ойрын даалгавар" id="calendar" className="lg:col-span-2">
          {isLoading ? (
            <div className="flex min-h-[15vh] items-center justify-center"><LoadingSpinner /></div>
          ) : upcomingEvents.length === 0 ? (
            <p className="text-sm text-slate-500">Ойрын даалгавар алга.</p>
          ) : (
            <div className="space-y-4">
              {upcomingEvents.map((event, index) => (
                <div key={index} className="flex flex-col gap-1 rounded-3xl border border-slate-200 bg-slate-50 p-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="font-semibold text-slate-900">{event.title}</div>
                  <div className="rounded-full bg-white px-3 py-2 text-sm text-slate-600 border border-slate-200">
                    {event.subtitle}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card title="Багш, хичээлийн мэдээлэл" id="contacts" className="lg:col-span-2">
          {isLoading ? (
            <div className="flex min-h-[15vh] items-center justify-center"><LoadingSpinner /></div>
          ) : courseContacts.length === 0 ? (
            <p className="text-sm text-slate-500">Бүртгэлтэй хичээл алга.</p>
          ) : (
            <div className="space-y-4">
              {courseContacts.map((course) => (
                <div key={course.courseId} className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
                  <div className="flex items-center gap-3">
                    <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-indigo-600 text-white">
                      <MessageCircle size={20} />
                    </div>
                    <div>
                      <div className="text-sm font-semibold text-slate-900">{course.courseTitle} ({course.courseCode})</div>
                      <div className="text-xs text-slate-500">
                        {course.instructorName ? `Багш: ${course.instructorName}` : 'Багш томилогдоогүй'}
                        {course.instructorEmail ? ` · ${course.instructorEmail}` : ''}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card title="Мэдэгдэл" id="notifications">
          {isLoading ? (
            <div className="flex min-h-[15vh] items-center justify-center"><LoadingSpinner /></div>
          ) : teacherMessages.length === 0 ? (
            <p className="text-sm text-slate-500">Шинэ мэдэгдэл алга.</p>
          ) : (
            <div className="space-y-3">
              {teacherMessages.map((message, index) => (
                <div key={index} className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
                  <div className="text-sm font-semibold text-slate-900">{message.subject}</div>
                  <p className="mt-1 text-xs leading-5 text-slate-600">{message.body}</p>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card title="Мэдэгдлийн тохиргоо" id="settings" className="lg:col-span-3">
          <NotificationPreferencesCard />
        </Card>
      </div>
    </div>
  );
}
