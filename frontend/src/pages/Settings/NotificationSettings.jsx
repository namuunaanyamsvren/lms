import { useState } from 'react';
import PageHeader from '../../components/ui/PageHeader';
import { Bell, Mail, Smartphone, Check } from 'lucide-react';

export default function NotificationSettings() {
  const [settings, setSettings] = useState({
    emailNotifications: true,
    pushNotifications: true,
    smsNotifications: false,
    assignmentReminders: true,
    gradeUpdates: true,
    announcementAlerts: true,
    meetingReminders: true,
    systemUpdates: false,
  });

  const handleToggle = (key) => {
    setSettings(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  const handleSave = () => {
    console.log('Saving notification settings:', settings);
    // Implement save functionality
  };

  return (
    <div className="space-y-6">
      <PageHeader 
        title="Notification Settings" 
        subtitle="Manage how you receive notifications"
      />

      <div className="space-y-6">
        {/* Notification Channels */}
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-6">
          <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-4">Notification Channels</h3>
          
          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-700 rounded-lg">
              <div className="flex items-center gap-3">
                <Mail size={20} className="text-indigo-600" />
                <div>
                  <p className="font-medium text-slate-900 dark:text-slate-100">Email Notifications</p>
                  <p className="text-sm text-slate-500 dark:text-slate-400">Receive notifications via email</p>
                </div>
              </div>
              <button
                onClick={() => handleToggle('emailNotifications')}
                className={`relative w-12 h-6 rounded-full transition-colors ${
                  settings.emailNotifications ? 'bg-indigo-600' : 'bg-slate-300'
                }`}
              >
                <span
                  className={`absolute top-1 left-1 w-4 h-4 rounded-full bg-white transition-transform ${
                    settings.emailNotifications ? 'translate-x-6' : ''
                  }`}
                />
              </button>
            </div>

            <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-700 rounded-lg">
              <div className="flex items-center gap-3">
                <Smartphone size={20} className="text-indigo-600" />
                <div>
                  <p className="font-medium text-slate-900 dark:text-slate-100">Push Notifications</p>
                  <p className="text-sm text-slate-500 dark:text-slate-400">Receive push notifications on your device</p>
                </div>
              </div>
              <button
                onClick={() => handleToggle('pushNotifications')}
                className={`relative w-12 h-6 rounded-full transition-colors ${
                  settings.pushNotifications ? 'bg-indigo-600' : 'bg-slate-300'
                }`}
              >
                <span
                  className={`absolute top-1 left-1 w-4 h-4 rounded-full bg-white transition-transform ${
                    settings.pushNotifications ? 'translate-x-6' : ''
                  }`}
                />
              </button>
            </div>

            <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-700 rounded-lg">
              <div className="flex items-center gap-3">
                <Smartphone size={20} className="text-indigo-600" />
                <div>
                  <p className="font-medium text-slate-900 dark:text-slate-100">SMS Notifications</p>
                  <p className="text-sm text-slate-500 dark:text-slate-400">Receive SMS notifications</p>
                </div>
              </div>
              <button
                onClick={() => handleToggle('smsNotifications')}
                className={`relative w-12 h-6 rounded-full transition-colors ${
                  settings.smsNotifications ? 'bg-indigo-600' : 'bg-slate-300'
                }`}
              >
                <span
                  className={`absolute top-1 left-1 w-4 h-4 rounded-full bg-white transition-transform ${
                    settings.smsNotifications ? 'translate-x-6' : ''
                  }`}
                />
              </button>
            </div>
          </div>
        </div>

        {/* Notification Types */}
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-6">
          <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-4">Notification Types</h3>
          
          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-700 rounded-lg">
              <div className="flex items-center gap-3">
                <Bell size={20} className="text-indigo-600" />
                <div>
                  <p className="font-medium text-slate-900 dark:text-slate-100">Assignment Reminders</p>
                  <p className="text-sm text-slate-500 dark:text-slate-400">Get notified about upcoming assignments</p>
                </div>
              </div>
              <button
                onClick={() => handleToggle('assignmentReminders')}
                className={`relative w-12 h-6 rounded-full transition-colors ${
                  settings.assignmentReminders ? 'bg-indigo-600' : 'bg-slate-300'
                }`}
              >
                <span
                  className={`absolute top-1 left-1 w-4 h-4 rounded-full bg-white transition-transform ${
                    settings.assignmentReminders ? 'translate-x-6' : ''
                  }`}
                />
              </button>
            </div>

            <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-700 rounded-lg">
              <div className="flex items-center gap-3">
                <Check size={20} className="text-indigo-600" />
                <div>
                  <p className="font-medium text-slate-900 dark:text-slate-100">Grade Updates</p>
                  <p className="text-sm text-slate-500 dark:text-slate-400">Get notified when grades are posted</p>
                </div>
              </div>
              <button
                onClick={() => handleToggle('gradeUpdates')}
                className={`relative w-12 h-6 rounded-full transition-colors ${
                  settings.gradeUpdates ? 'bg-indigo-600' : 'bg-slate-300'
                }`}
              >
                <span
                  className={`absolute top-1 left-1 w-4 h-4 rounded-full bg-white transition-transform ${
                    settings.gradeUpdates ? 'translate-x-6' : ''
                  }`}
                />
              </button>
            </div>

            <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-700 rounded-lg">
              <div className="flex items-center gap-3">
                <Bell size={20} className="text-indigo-600" />
                <div>
                  <p className="font-medium text-slate-900 dark:text-slate-100">Announcement Alerts</p>
                  <p className="text-sm text-slate-500 dark:text-slate-400">Get notified about school announcements</p>
                </div>
              </div>
              <button
                onClick={() => handleToggle('announcementAlerts')}
                className={`relative w-12 h-6 rounded-full transition-colors ${
                  settings.announcementAlerts ? 'bg-indigo-600' : 'bg-slate-300'
                }`}
              >
                <span
                  className={`absolute top-1 left-1 w-4 h-4 rounded-full bg-white transition-transform ${
                    settings.announcementAlerts ? 'translate-x-6' : ''
                  }`}
                />
              </button>
            </div>

            <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-700 rounded-lg">
              <div className="flex items-center gap-3">
                <Bell size={20} className="text-indigo-600" />
                <div>
                  <p className="font-medium text-slate-900 dark:text-slate-100">Meeting Reminders</p>
                  <p className="text-sm text-slate-500 dark:text-slate-400">Get reminded about upcoming meetings</p>
                </div>
              </div>
              <button
                onClick={() => handleToggle('meetingReminders')}
                className={`relative w-12 h-6 rounded-full transition-colors ${
                  settings.meetingReminders ? 'bg-indigo-600' : 'bg-slate-300'
                }`}
              >
                <span
                  className={`absolute top-1 left-1 w-4 h-4 rounded-full bg-white transition-transform ${
                    settings.meetingReminders ? 'translate-x-6' : ''
                  }`}
                />
              </button>
            </div>

            <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-700 rounded-lg">
              <div className="flex items-center gap-3">
                <Bell size={20} className="text-indigo-600" />
                <div>
                  <p className="font-medium text-slate-900 dark:text-slate-100">System Updates</p>
                  <p className="text-sm text-slate-500 dark:text-slate-400">Get notified about system updates</p>
                </div>
              </div>
              <button
                onClick={() => handleToggle('systemUpdates')}
                className={`relative w-12 h-6 rounded-full transition-colors ${
                  settings.systemUpdates ? 'bg-indigo-600' : 'bg-slate-300'
                }`}
              >
                <span
                  className={`absolute top-1 left-1 w-4 h-4 rounded-full bg-white transition-transform ${
                    settings.systemUpdates ? 'translate-x-6' : ''
                  }`}
                />
              </button>
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-3">
          <button
            type="button"
            className="px-6 py-2.5 text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="px-6 py-2.5 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition"
          >
            Save Changes
          </button>
        </div>
      </div>
    </div>
  );
}
