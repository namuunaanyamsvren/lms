import { useState } from 'react';
import PageHeader from '../components/ui/PageHeader';
import { Activity as ActivityIcon, Clock, BookOpen, FileText, CheckCircle, TrendingUp } from 'lucide-react';
import { formatDate } from '../utils/formatDate';

export default function Activity() {
  const [filter, setFilter] = useState('all');

  const activities = [
    {
      id: 1,
      type: 'assignment',
      title: 'Submitted Assignment: Calculus Problem Set',
      description: 'Completed and submitted the calculus problem set',
      timestamp: new Date(Date.now() - 30 * 60 * 1000),
      icon: FileText,
      color: 'text-blue-600 bg-blue-50 dark:bg-blue-900/20',
    },
    {
      id: 2,
      type: 'course',
      title: 'Completed Lesson: React Fundamentals',
      description: 'Finished the React fundamentals module',
      timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000),
      icon: BookOpen,
      color: 'text-green-600 bg-green-50 dark:bg-green-900/20',
    },
    {
      id: 3,
      type: 'achievement',
      title: 'Earned Badge: Quick Learner',
      description: 'Completed 5 lessons in one day',
      timestamp: new Date(Date.now() - 5 * 60 * 60 * 1000),
      icon: CheckCircle,
      color: 'text-yellow-600 bg-yellow-50 dark:bg-yellow-900/20',
    },
    {
      id: 4,
      type: 'quiz',
      title: 'Quiz Completed: JavaScript Basics',
      description: 'Scored 95% on the JavaScript basics quiz',
      timestamp: new Date(Date.now() - 24 * 60 * 60 * 1000),
      icon: CheckCircle,
      color: 'text-purple-600 bg-purple-50 dark:bg-purple-900/20',
    },
    {
      id: 5,
      type: 'course',
      title: 'Started Course: Data Structures',
      description: 'Enrolled in the data structures course',
      timestamp: new Date(Date.now() - 48 * 60 * 60 * 1000),
      icon: BookOpen,
      color: 'text-indigo-600 bg-indigo-50 dark:bg-indigo-900/20',
    },
  ];

  const stats = [
    { label: 'Total Activities', value: activities.length, icon: ActivityIcon, color: 'text-indigo-600 bg-indigo-50 dark:bg-indigo-900/20' },
    { label: 'Courses Completed', value: 3, icon: BookOpen, color: 'text-green-600 bg-green-50 dark:bg-green-900/20' },
    { label: 'Assignments Done', value: 12, icon: FileText, color: 'text-blue-600 bg-blue-50 dark:bg-blue-900/20' },
    { label: 'Quizzes Passed', value: 8, icon: CheckCircle, color: 'text-purple-600 bg-purple-50 dark:bg-purple-900/20' },
  ];

  const filteredActivities = filter === 'all' 
    ? activities 
    : activities.filter(a => a.type === filter);

  return (
    <div className="space-y-6">
      <PageHeader 
        title="Activity" 
        subtitle="Track your learning progress and achievements"
      />

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <div key={stat.label} className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4">
              <div className={`w-10 h-10 rounded-lg ${stat.color} flex items-center justify-center mb-3`}>
                <Icon size={20} />
              </div>
              <p className="text-2xl font-bold text-slate-900 dark:text-slate-100">{stat.value}</p>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{stat.label}</p>
            </div>
          );
        })}
      </div>

      {/* Filter */}
      <div className="flex items-center gap-2">
        <TrendingUp size={18} className="text-slate-400" />
        <div className="flex gap-1">
          {['all', 'course', 'assignment', 'quiz', 'achievement'].map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-4 py-2 text-sm font-medium rounded-lg transition ${
                filter === f
                  ? 'bg-indigo-600 text-white'
                  : 'bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600'
              }`}
            >
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Activity Timeline */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-6">
        <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-4">Recent Activity</h3>
        
        <div className="space-y-4">
          {filteredActivities.map((activity, index) => {
            const Icon = activity.icon;
            return (
              <div key={activity.id} className="flex gap-4">
                <div className={`w-10 h-10 rounded-lg ${activity.color} flex items-center justify-center flex-shrink-0`}>
                  <Icon size={20} />
                </div>
                <div className="flex-1 pb-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <h4 className="font-medium text-slate-900 dark:text-slate-100">{activity.title}</h4>
                      <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">{activity.description}</p>
                    </div>
                    <div className="flex items-center gap-1 text-xs text-slate-400">
                      <Clock size={12} />
                      <span>{formatDate(activity.timestamp)}</span>
                    </div>
                  </div>
                  {index < filteredActivities.length - 1 && (
                    <div className="mt-4 ml-5 border-l-2 border-slate-200 dark:border-slate-700 h-4" />
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
