import PageHeader from '../components/ui/PageHeader';
import { BookOpen, Clock, Users, Star, ArrowRight } from 'lucide-react';

export default function MyCourses() {
  const courses = [
    {
      id: 1,
      title: 'Introduction to Computer Science',
      instructor: 'Dr. Sarah Johnson',
      progress: 75,
      enrolled: 'Jan 15, 2026',
      students: 45,
      rating: 4.8,
      image: 'https://images.unsplash.com/photo-1517694712202-14dd9538aa97?w=400&h=200&fit=crop',
    },
    {
      id: 2,
      title: 'Advanced Mathematics',
      instructor: 'Prof. Michael Chen',
      progress: 45,
      enrolled: 'Feb 1, 2026',
      students: 32,
      rating: 4.6,
      image: 'https://images.unsplash.com/photo-1635070041078-e363dbe005cb?w=400&h=200&fit=crop',
    },
    {
      id: 3,
      title: 'Web Development Fundamentals',
      instructor: 'Ms. Emily Davis',
      progress: 90,
      enrolled: 'Jan 20, 2026',
      students: 58,
      rating: 4.9,
      image: 'https://images.unsplash.com/photo-1461749280684-dccba630e2f6?w=400&h=200&fit=crop',
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader 
        title="My Courses" 
        subtitle="View and manage your enrolled courses"
      />

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {courses.map((course) => (
          <div key={course.id} className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden hover:shadow-lg transition-shadow">
            <div className="relative h-40">
              <img 
                src={course.image} 
                alt={course.title}
                className="w-full h-full object-cover"
              />
              <div className="absolute top-3 right-3 bg-white/90 dark:bg-slate-900/90 backdrop-blur px-2 py-1 rounded-lg text-xs font-medium text-slate-900 dark:text-slate-100">
                <div className="flex items-center gap-1">
                  <Star size={12} className="text-yellow-500 fill-yellow-500" />
                  {course.rating}
                </div>
              </div>
            </div>
            
            <div className="p-4">
              <h3 className="font-semibold text-slate-900 dark:text-slate-100 line-clamp-2">{course.title}</h3>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">{course.instructor}</p>
              
              <div className="mt-4 space-y-2">
                <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                  <span>Progress</span>
                  <span>{course.progress}%</span>
                </div>
                <div className="h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-indigo-600 rounded-full transition-all"
                    style={{ width: `${course.progress}%` }}
                  />
                </div>
              </div>

              <div className="mt-4 flex items-center gap-4 text-xs text-slate-500 dark:text-slate-400">
                <div className="flex items-center gap-1">
                  <Clock size={14} />
                  <span>{course.enrolled}</span>
                </div>
                <div className="flex items-center gap-1">
                  <Users size={14} />
                  <span>{course.students} students</span>
                </div>
              </div>

              <button className="mt-4 w-full flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-lg transition">
                Continue Learning
                <ArrowRight size={16} />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
