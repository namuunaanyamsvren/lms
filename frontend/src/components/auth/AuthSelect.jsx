export default function AuthSelect({ id, label, icon: Icon, children, className = '', ...props }) {
  return (
    <div className={className}>
      <label htmlFor={id} className="block text-sm font-medium text-gray-700 mb-2">
        {label}
      </label>
      <div className="relative">
        {Icon && (
          <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5">
            <Icon className="h-5 w-5 text-gray-400" />
          </div>
        )}
        <select
          id={id}
          className={`block w-full appearance-none rounded-xl border-0 bg-gray-100 py-3.5 text-gray-900 transition focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 ${Icon ? 'pl-11 pr-10' : 'px-4'}`}
          {...props}
        >
          {children}
        </select>
      </div>
    </div>
  );
}
