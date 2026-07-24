import { useState, useEffect } from 'react';
import Card from '../../components/ui/Card';
import PageHeader from '../../components/ui/PageHeader';
import StatCard from '../../components/ui/StatCard';
import { Bell, ClipboardList, BarChart2, Users, Star } from 'lucide-react';
import { getStaffDashboardData } from '../../services/api';

const STAT_ICONS = {
  Documents: ClipboardList,
  Scholarships: Star,
  Announcements: Bell,
  Reports: BarChart2,
};

export default function Staff() {
  const [dashboardData, setDashboardData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true);
        setError(null);
        const data = await getStaffDashboardData();
        setDashboardData(data);
      } catch (err) {
        setError('Ажилтны хяналтын самбарын мэдээллийг ачааллахад алдаа гарлаа.');
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  if (loading) {
    return <div className="space-y-6">Ачааллаж байна...</div>;
  }

  if (error) {
    return <div className="space-y-6">{error}</div>;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Staff Dashboard"
        subtitle="Manage student docs, scholarships, announcements, and quick staff metrics."
        right={<>
          <div className="font-medium text-slate-900">Today</div>
          <div className="mt-1">{new Date().toLocaleDateString('en-US', { day: '2-digit', month: 'short', year: 'numeric' })}</div>
        </>}
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {dashboardData.stats.map((item, index) => (
          <StatCard
            key={index}
            title={item.label}
            value={item.value}
            icon={STAT_ICONS[item.label]}
          />
        ))}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="space-y-6 xl:col-span-2">
          <Card title="Pending Documents" id="student-documents">
            {dashboardData.pendingDocuments.length === 0 ? (
              <p className="text-sm text-slate-500">No pending documents right now.</p>
            ) : (
              <div className="space-y-3">
                {dashboardData.pendingDocuments.map((doc, index) => (
                  <div key={index} className="flex flex-col gap-2 rounded-3xl bg-slate-50 p-4 border border-slate-200 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="font-semibold text-slate-900">{doc.title}</p>
                      <p className="text-sm text-slate-500">{doc.student}</p>
                    </div>
                    <span className={`rounded-full px-3 py-1 text-xs font-medium ${doc.status === 'Pending' ? 'bg-amber-100 text-amber-700' : 'bg-sky-100 text-sky-700'}`}>
                      {doc.status}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </Card>

          <Card title="Scholarship Requests" id="scholarship-management">
            {dashboardData.scholarshipRequests.length === 0 ? (
              <p className="text-sm text-slate-500">No scholarship requests right now.</p>
            ) : (
              <div className="space-y-3">
                {dashboardData.scholarshipRequests.map((request, index) => (
                  <div key={index} className="rounded-3xl bg-slate-50 p-4 border border-slate-200">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="font-semibold text-slate-900">{request.student}</p>
                        <p className="text-sm text-slate-500">{request.program}</p>
                      </div>
                      <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700">{request.status}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>

          <Card title="Recent Announcements" id="announcements">
            {dashboardData.announcements.length === 0 ? (
              <p className="text-sm text-slate-500">No announcements yet.</p>
            ) : (
              <div className="space-y-3">
                {dashboardData.announcements.map((item, index) => (
                  <div key={index} className="rounded-3xl bg-slate-50 p-4 border border-slate-200">
                    <div className="flex items-center justify-between gap-3">
                      <p className="font-medium text-slate-900">{item.title}</p>
                      <span className="text-xs text-slate-500">{item.time}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>

        <div className="space-y-6">
          <Card title="Recent Activities" id="reports">
            {dashboardData.recentActivities.length === 0 ? (
              <p className="text-sm text-slate-500">No recent activity yet.</p>
            ) : (
              <ul className="space-y-3 text-sm text-slate-600">
                {dashboardData.recentActivities.map((activity, index) => (
                  <li key={index} className="rounded-3xl bg-slate-50 p-4 border border-slate-200">{activity}</li>
                ))}
              </ul>
            )}
          </Card>

          <Card title="Quick Statistics" id="notifications">
            <div className="space-y-4">
              <div className="flex items-center justify-between rounded-3xl bg-slate-50 p-4 border border-slate-200">
                <div>
                  <p className="text-sm text-slate-500">Open Applications</p>
                  <p className="text-xl font-semibold text-slate-900">{dashboardData.quickStats.openApplications}</p>
                </div>
                <Users size={22} className="text-sky-600" />
              </div>
              <div className="flex items-center justify-between rounded-3xl bg-slate-50 p-4 border border-slate-200">
                <div>
                  <p className="text-sm text-slate-500">Today's Notices</p>
                  <p className="text-xl font-semibold text-slate-900">{dashboardData.quickStats.todaysNotices}</p>
                </div>
                <Bell size={22} className="text-amber-600" />
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
