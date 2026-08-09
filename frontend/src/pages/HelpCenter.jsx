import { useState } from 'react';
import PageHeader from '../components/ui/PageHeader';
import { HelpCircle, Search, Book, MessageCircle, Phone, Mail, ChevronRight, FileText, Video, Users } from 'lucide-react';

export default function HelpCenter() {
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedFaq, setExpandedFaq] = useState(null);

  const faqs = [
    {
      id: 1,
      question: 'Нууц үгээ хэрхэн шинэчлэх вэ?',
      answer: 'Тохиргоо хэсгийн Аюулгүй байдал руу орж “Нууц үг солих”-ыг сонгоно.',
    },
    {
      id: 2,
      question: 'Хичээлүүдээ хаанаас харах вэ?',
      answer: 'Бүртгэлтэй хичээлүүд “Миний хичээлүүд” хэсэгт харагдана.',
    },
    {
      id: 3,
      question: 'Даалгавраа хэрхэн илгээх вэ?',
      answer: 'Даалгавар хэсгээс илгээх ажлаа сонгон зааврын дагуу материалаа оруулна.',
    },
    {
      id: 4,
      question: 'Дүнгээ хаанаас харах вэ?',
      answer: 'Хянах самбарын Дүн хэсэгт таны бүх дүн харагдана.',
    },
    {
      id: 5,
      question: 'Багштайгаа хэрхэн холбогдох вэ?',
      answer: 'Хичээлийн дэлгэрэнгүй мэдээлэлд байгаа багшийн холбоо барих мэдээллийг ашиглана.',
    },
  ];

  const helpCategories = [
    { title: 'Эхлэх заавар', icon: Book, items: 12, color: 'text-blue-600 bg-blue-50 dark:bg-blue-900/20' },
    { title: 'Видео заавар', icon: Video, items: 8, color: 'text-purple-600 bg-purple-50 dark:bg-purple-900/20' },
    { title: 'Баримт бичиг', icon: FileText, items: 15, color: 'text-green-600 bg-green-50 dark:bg-green-900/20' },
    { title: 'Хэрэглэгчдийн бүлэг', icon: Users, items: 24, color: 'text-orange-600 bg-orange-50 dark:bg-orange-900/20' },
  ];

  const contactMethods = [
    { title: 'Шууд чат', icon: MessageCircle, description: 'Тусламжийн багтай чатлах', available: '24/7' },
    { title: 'И-мэйл тусламж', icon: Mail, description: 'support@lms.edu', available: '24 цагийн дотор хариулна' },
    { title: 'Утасны тусламж', icon: Phone, description: '+976 7000-0000', available: 'Даваа–Баасан 09:00–17:00' },
  ];

  return (
    <div className="space-y-6">
      <PageHeader 
        title="Тусламж"
        subtitle="Асуултынхаа хариултыг олж, тусламж аваарай"
      />

      {/* Search */}
      <div className="relative max-w-2xl">
        <Search size={20} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          type="text"
          placeholder="Тусламжийн мэдээлэл хайх..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-12 pr-4 py-4 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
        />
      </div>

      {/* Help Categories */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {helpCategories.map((category) => {
          const Icon = category.icon;
          return (
            <button key={category.title} className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-6 hover:shadow-lg transition-shadow text-left">
              <div className={`w-12 h-12 rounded-lg ${category.color} flex items-center justify-center mb-4`}>
                <Icon size={24} />
              </div>
              <h3 className="font-semibold text-slate-900 dark:text-slate-100">{category.title}</h3>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">{category.items} нийтлэл</p>
              <ChevronRight size={16} className="text-slate-400 mt-4" />
            </button>
          );
        })}
      </div>

      {/* FAQs */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-6">
        <div className="flex items-center gap-3 mb-6">
          <HelpCircle size={24} className="text-indigo-600" />
          <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Түгээмэл асуултууд</h3>
        </div>
        
        <div className="space-y-3">
          {faqs.map((faq) => (
            <div key={faq.id} className="border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden">
              <button
                onClick={() => setExpandedFaq(expandedFaq === faq.id ? null : faq.id)}
                className="w-full flex items-center justify-between p-4 text-left hover:bg-slate-50 dark:hover:bg-slate-700/50 transition"
              >
                <span className="font-medium text-slate-900 dark:text-slate-100">{faq.question}</span>
                <ChevronRight 
                  size={16} 
                  className={`text-slate-400 transition-transform ${expandedFaq === faq.id ? 'rotate-90' : ''}`} 
                />
              </button>
              {expandedFaq === faq.id && (
                <div className="p-4 pt-0 text-sm text-slate-600 dark:text-slate-400">
                  {faq.answer}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Contact Methods */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-6">
        <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-6">Тусламжтай холбогдох</h3>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {contactMethods.map((method) => {
            const Icon = method.icon;
            return (
              <button key={method.title} className="p-6 rounded-xl border border-slate-200 dark:border-slate-700 hover:border-indigo-300 dark:hover:border-indigo-600 hover:shadow-md transition-all text-left">
                <Icon size={24} className="text-indigo-600 mb-3" />
                <h4 className="font-semibold text-slate-900 dark:text-slate-100">{method.title}</h4>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">{method.description}</p>
                <p className="text-xs text-slate-400 mt-2">{method.available}</p>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
