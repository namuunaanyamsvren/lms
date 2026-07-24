import { useState } from 'react';
import PageHeader from '../../components/ui/PageHeader';
import { Shield, Lock, Key, Eye, EyeOff, AlertTriangle } from 'lucide-react';

export default function SecuritySettings() {
  const [showPassword, setShowPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [formData, setFormData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });

  const handleChange = (e) => {
    setFormData(prev => ({
      ...prev,
      [e.target.name]: e.target.value
    }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    console.log('Updating password:', formData);
    // Implement password update functionality
  };

  return (
    <div className="space-y-6">
      <PageHeader 
        title="Security Settings" 
        subtitle="Manage your password and security preferences"
      />

      <div className="space-y-6">
        {/* Password Change */}
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-6">
          <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-4">Change Password</h3>
          
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                Current Password
              </label>
              <div className="relative">
                <Lock size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  name="currentPassword"
                  value={formData.currentPassword}
                  onChange={handleChange}
                  className="w-full pl-10 pr-12 py-2.5 rounded-lg bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                  placeholder="Enter current password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                New Password
              </label>
              <div className="relative">
                <Key size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type={showNewPassword ? 'text' : 'password'}
                  name="newPassword"
                  value={formData.newPassword}
                  onChange={handleChange}
                  className="w-full pl-10 pr-12 py-2.5 rounded-lg bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                  placeholder="Enter new password"
                />
                <button
                  type="button"
                  onClick={() => setShowNewPassword(!showNewPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  {showNewPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                Confirm New Password
              </label>
              <div className="relative">
                <Key size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type={showConfirmPassword ? 'text' : 'password'}
                  name="confirmPassword"
                  value={formData.confirmPassword}
                  onChange={handleChange}
                  className="w-full pl-10 pr-12 py-2.5 rounded-lg bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                  placeholder="Confirm new password"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
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
                type="submit"
                className="px-6 py-2.5 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition"
              >
                Update Password
              </button>
            </div>
          </form>
        </div>

        {/* Two-Factor Authentication */}
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-6">
          <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-4">Two-Factor Authentication</h3>
          
          <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-700 rounded-lg">
            <div className="flex items-center gap-3">
              <Shield size={20} className="text-indigo-600" />
              <div>
                <p className="font-medium text-slate-900 dark:text-slate-100">Enable 2FA</p>
                <p className="text-sm text-slate-500 dark:text-slate-400">Add an extra layer of security to your account</p>
              </div>
            </div>
            <button className="px-4 py-2 text-sm font-medium text-indigo-600 hover:bg-indigo-50 rounded-lg transition">
              Enable
            </button>
          </div>
        </div>

        {/* Active Sessions */}
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-6">
          <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-4">Active Sessions</h3>
          
          <div className="space-y-3">
            <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-700 rounded-lg">
              <div>
                <p className="font-medium text-slate-900 dark:text-slate-100">Current Session</p>
                <p className="text-sm text-slate-500 dark:text-slate-400">Chrome on macOS • Active now</p>
              </div>
              <span className="px-3 py-1 text-xs font-medium text-green-600 bg-green-50 rounded-full">
                Active
              </span>
            </div>

            <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-700 rounded-lg">
              <div>
                <p className="font-medium text-slate-900 dark:text-slate-100">Safari on iPhone</p>
                <p className="text-sm text-slate-500 dark:text-slate-400">Last active 2 hours ago</p>
              </div>
              <button className="px-3 py-1 text-xs font-medium text-red-600 hover:bg-red-50 rounded-lg transition">
                Revoke
              </button>
            </div>
          </div>
        </div>

        {/* Security Alert */}
        <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle size={20} className="text-amber-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-medium text-amber-900 dark:text-amber-100">Security Tip</p>
              <p className="text-sm text-amber-700 dark:text-amber-300 mt-1">
                Use a strong, unique password and enable two-factor authentication to keep your account secure.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
