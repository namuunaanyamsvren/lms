import { useState } from 'react';
import PageHeader from '../../components/ui/PageHeader';
import { useTheme } from '../../context/ThemeContext';
import { Monitor, Sun, Moon, Palette } from 'lucide-react';

export default function AppearanceSettings() {
  const { theme, setThemeMode, THEME_PREFERENCES } = useTheme();
  const [accentColor, setAccentColor] = useState('indigo');

  const accentColors = [
    { name: 'Indigo', value: 'indigo', class: 'bg-indigo-600' },
    { name: 'Blue', value: 'blue', class: 'bg-blue-600' },
    { name: 'Green', value: 'green', class: 'bg-green-600' },
    { name: 'Purple', value: 'purple', class: 'bg-purple-600' },
    { name: 'Red', value: 'red', class: 'bg-red-600' },
    { name: 'Orange', value: 'orange', class: 'bg-orange-600' },
  ];

  const handleSave = () => {
    console.log('Saving appearance settings:', { theme, accentColor });
    // Implement save functionality
  };

  return (
    <div className="space-y-6">
      <PageHeader 
        title="Appearance Settings" 
        subtitle="Customize the look and feel of your dashboard"
      />

      <div className="space-y-6">
        {/* Theme Selection */}
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-6">
          <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-4">Theme</h3>
          
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <button
              onClick={() => setThemeMode(THEME_PREFERENCES.SYSTEM)}
              className={`p-4 rounded-xl border-2 transition-all ${
                theme === THEME_PREFERENCES.SYSTEM
                  ? 'border-indigo-600 bg-indigo-50 dark:bg-indigo-900/20'
                  : 'border-slate-200 dark:border-slate-700 hover:border-slate-300'
              }`}
            >
              <Monitor size={32} className={`mx-auto mb-2 ${theme === THEME_PREFERENCES.SYSTEM ? 'text-indigo-600' : 'text-slate-400'}`} />
              <p className="font-medium text-slate-900 dark:text-slate-100 text-center">System</p>
              <p className="text-xs text-slate-500 dark:text-slate-400 text-center mt-1">Follow system preference</p>
            </button>

            <button
              onClick={() => setThemeMode(THEME_PREFERENCES.LIGHT)}
              className={`p-4 rounded-xl border-2 transition-all ${
                theme === THEME_PREFERENCES.LIGHT
                  ? 'border-indigo-600 bg-indigo-50 dark:bg-indigo-900/20'
                  : 'border-slate-200 dark:border-slate-700 hover:border-slate-300'
              }`}
            >
              <Sun size={32} className={`mx-auto mb-2 ${theme === THEME_PREFERENCES.LIGHT ? 'text-indigo-600' : 'text-slate-400'}`} />
              <p className="font-medium text-slate-900 dark:text-slate-100 text-center">Light</p>
              <p className="text-xs text-slate-500 dark:text-slate-400 text-center mt-1">Always light mode</p>
            </button>

            <button
              onClick={() => setThemeMode(THEME_PREFERENCES.DARK)}
              className={`p-4 rounded-xl border-2 transition-all ${
                theme === THEME_PREFERENCES.DARK
                  ? 'border-indigo-600 bg-indigo-50 dark:bg-indigo-900/20'
                  : 'border-slate-200 dark:border-slate-700 hover:border-slate-300'
              }`}
            >
              <Moon size={32} className={`mx-auto mb-2 ${theme === THEME_PREFERENCES.DARK ? 'text-indigo-600' : 'text-slate-400'}`} />
              <p className="font-medium text-slate-900 dark:text-slate-100 text-center">Dark</p>
              <p className="text-xs text-slate-500 dark:text-slate-400 text-center mt-1">Always dark mode</p>
            </button>
          </div>
        </div>

        {/* Accent Color */}
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-6">
          <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-4">Accent Color</h3>
          
          <div className="flex items-center gap-3">
            <Palette size={20} className="text-slate-400" />
            <div className="flex gap-3 flex-wrap">
              {accentColors.map((color) => (
                <button
                  key={color.value}
                  onClick={() => setAccentColor(color.value)}
                  className={`w-10 h-10 rounded-full ${color.class} transition-transform hover:scale-110 ${
                    accentColor === color.value ? 'ring-2 ring-offset-2 ring-slate-900 dark:ring-slate-100' : ''
                  }`}
                  title={color.name}
                />
              ))}
            </div>
          </div>
        </div>

        {/* Density */}
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-6">
          <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-4">Interface Density</h3>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <button className="p-4 rounded-xl border-2 border-slate-200 dark:border-slate-700 hover:border-slate-300 transition-all">
              <p className="font-medium text-slate-900 dark:text-slate-100">Comfortable</p>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">More spacing, relaxed layout</p>
            </button>

            <button className="p-4 rounded-xl border-2 border-indigo-600 bg-indigo-50 dark:bg-indigo-900/20 transition-all">
              <p className="font-medium text-slate-900 dark:text-slate-100">Compact</p>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Less spacing, dense layout</p>
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
