import { useState } from 'react';
import { Bell, CheckCheck, Trash2, Search, Filter } from 'lucide-react';
import PageHeader from '../components/ui/PageHeader';
import EmptyState from '../components/ui/EmptyState';
import { formatDate } from '../utils/formatDate';

export default function Notifications() {
  const [filter, setFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [notifications, setNotifications] = useState([
    { id: 1, title: 'System Update', description: 'New features have been added to the platform.', createdAt: new Date(Date.now() - 10 * 60 * 1000), read: false, type: 'info' },
    { id: 2, title: 'New Assignment', description: 'You have a new assignment due next week.', createdAt: new Date(Date.now() - 60 * 60 * 1000), read: false, type: 'warning' },
    { id: 3, title: 'School Announcement', description: 'Important announcement about the upcoming semester.', createdAt: new Date(Date.now() - 3 * 60 * 60 * 1000), read: true, type: 'info' },
    { id: 4, title: 'Grade Posted', description: 'Your grade for Math 101 has been posted.', createdAt: new Date(Date.now() - 24 * 60 * 60 * 1000), read: true, type: 'success' },
    { id: 5, title: 'Meeting Reminder', description: 'Don\'t forget about your advisor meeting tomorrow.', createdAt: new Date(Date.now() - 48 * 60 * 60 * 1000), read: true, type: 'warning' },
  ]);

  const filteredNotifications = notifications.filter(notification => {
    const matchesFilter = filter === 'all' || 
      (filter === 'unread' && !notification.read) || 
      (filter === 'read' && notification.read);
    
    const matchesSearch = notification.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      notification.description.toLowerCase().includes(searchQuery.toLowerCase());
    
    return matchesFilter && matchesSearch;
  });

  const handleMarkAsRead = (id) => {
    setNotifications(prev => prev.map(n => 
      n.id === id ? { ...n, read: true } : n
    ));
  };

  const handleMarkAllAsRead = () => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
  };

  const handleClearAll = () => {
    setNotifications([]);
  };

  const handleDelete = (id) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  };

  const unreadCount = notifications.filter(n => !n.read).length;

  return (
    <div className="space-y-6">
      <PageHeader 
        title="Notifications" 
        subtitle={`You have ${unreadCount} unread notification${unreadCount !== 1 ? 's' : ''}`}
        right={
          <div className="flex items-center gap-2">
            {unreadCount > 0 && (
              <button
                onClick={handleMarkAllAsRead}
                className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-indigo-600 hover:bg-indigo-50 rounded-lg transition"
              >
                <CheckCheck size={16} />
                Mark all as read
              </button>
            )}
            {notifications.length > 0 && (
              <button
                onClick={handleClearAll}
                className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50 rounded-lg transition"
              >
                <Trash2 size={16} />
                Clear all
              </button>
            )}
          </div>
        }
      />

      {/* Filters and Search */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div className="flex items-center gap-2">
          <Filter size={18} className="text-slate-400" />
          <div className="flex gap-1">
            {['all', 'unread', 'read'].map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-4 py-2 text-sm font-medium rounded-lg transition ${
                  filter === f
                    ? 'bg-indigo-600 text-white'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                {f.charAt(0).toUpperCase() + f.slice(1)}
              </button>
            ))}
          </div>
        </div>

        <div className="relative w-full sm:w-64">
          <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search notifications..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 rounded-lg bg-white border border-slate-200 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
          />
        </div>
      </div>

      {/* Notifications List */}
      {filteredNotifications.length > 0 ? (
        <div className="space-y-3">
          {filteredNotifications.map((notification) => (
            <div
              key={notification.id}
              className={`bg-white dark:bg-slate-800 rounded-xl border ${
                notification.read 
                  ? 'border-slate-200 dark:border-slate-700' 
                  : 'border-indigo-200 dark:border-indigo-700 bg-indigo-50/50 dark:bg-indigo-900/20'
              } p-4 hover:shadow-md transition-all`}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    {!notification.read && (
                      <span className="h-2 w-2 rounded-full bg-indigo-600" />
                    )}
                    <h3 className={`font-semibold text-slate-900 dark:text-slate-100 ${
                      notification.read ? 'text-sm' : 'text-base'
                    }`}>
                      {notification.title}
                    </h3>
                  </div>
                  <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                    {notification.description}
                  </p>
                  <p className="text-xs text-slate-400 mt-2">
                    {formatDate(notification.createdAt)}
                  </p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  {!notification.read && (
                    <button
                      onClick={() => handleMarkAsRead(notification.id)}
                      className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition"
                      title="Mark as read"
                    >
                      <CheckCheck size={16} />
                    </button>
                  )}
                  <button
                    onClick={() => handleDelete(notification.id)}
                    className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition"
                    title="Delete"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <EmptyState
          title="No notifications"
          description={searchQuery ? 'No notifications match your search.' : 'You\'re all caught up!'}
          icon={<Bell size={48} className="text-slate-300" />}
        />
      )}
    </div>
  );
}
