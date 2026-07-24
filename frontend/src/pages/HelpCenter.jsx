import { useState } from 'react';
import PageHeader from '../components/ui/PageHeader';
import { HelpCircle, Search, Book, MessageCircle, Phone, Mail, ChevronRight, FileText, Video, Users } from 'lucide-react';

export default function HelpCenter() {
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedFaq, setExpandedFaq] = useState(null);

  const faqs = [
    {
      id: 1,
      question: 'How do I reset my password?',
      answer: 'Go to Settings > Security and click on "Change Password". You will need to enter your current password and then create a new one.',
    },
    {
      id: 2,
      question: 'How can I access my courses?',
      answer: 'Your enrolled courses are available in the "My Courses" section of your dashboard. Click on any course to view its content and continue learning.',
    },
    {
      id: 3,
      question: 'How do I submit assignments?',
      answer: 'Navigate to the Assignments section, select the assignment you want to submit, and follow the instructions to upload your work.',
    },
    {
      id: 4,
      question: 'Where can I view my grades?',
      answer: 'Your grades are available in the Grades section of your dashboard. You can filter by course or semester to find specific grades.',
    },
    {
      id: 5,
      question: 'How do I contact my instructor?',
      answer: 'You can contact your instructor through the Messages section or by using the contact information provided in the course details.',
    },
  ];

  const helpCategories = [
    { title: 'Getting Started', icon: Book, items: 12, color: 'text-blue-600 bg-blue-50 dark:bg-blue-900/20' },
    { title: 'Video Tutorials', icon: Video, items: 8, color: 'text-purple-600 bg-purple-50 dark:bg-purple-900/20' },
    { title: 'Documentation', icon: FileText, items: 15, color: 'text-green-600 bg-green-50 dark:bg-green-900/20' },
    { title: 'Community', icon: Users, items: 24, color: 'text-orange-600 bg-orange-50 dark:bg-orange-900/20' },
  ];

  const contactMethods = [
    { title: 'Live Chat', icon: MessageCircle, description: 'Chat with our support team', available: '24/7' },
    { title: 'Email Support', icon: Mail, description: 'support@lms.edu', available: 'Response within 24h' },
    { title: 'Phone Support', icon: Phone, description: '+1 (555) 123-4567', available: 'Mon-Fri 9-5' },
  ];

  return (
    <div className="space-y-6">
      <PageHeader 
        title="Help Center" 
        subtitle="Find answers to your questions and get support"
      />

      {/* Search */}
      <div className="relative max-w-2xl">
        <Search size={20} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          type="text"
          placeholder="Search for help articles, FAQs, and more..."
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
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">{category.items} articles</p>
              <ChevronRight size={16} className="text-slate-400 mt-4" />
            </button>
          );
        })}
      </div>

      {/* FAQs */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-6">
        <div className="flex items-center gap-3 mb-6">
          <HelpCircle size={24} className="text-indigo-600" />
          <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Frequently Asked Questions</h3>
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
        <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-6">Contact Support</h3>
        
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
