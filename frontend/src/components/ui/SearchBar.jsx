import { Search } from 'lucide-react';

export default function SearchBar({ value, onChange, placeholder = 'Search', className = '' }) {
  return (
    <div className={`relative rounded-3xl border border-slate-200 bg-white px-4 py-2 shadow-sm ${className}`}>
      <Search size={18} className="text-slate-400" />
      <input
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        className="w-full border-none bg-transparent pl-10 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none"
      />
    </div>
  );
}
