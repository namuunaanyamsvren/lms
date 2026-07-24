export default function AuthInput({ id, label, icon: Icon, className = '', ...props }) {
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
        <input
          id={id}
          className={`block w-full rounded-xl border-0 bg-gray-100 py-3.5 text-gray-900 placeholder:text-gray-400 transition focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 ${Icon ? 'pl-11 pr-4' : 'px-4'}`}
          {...props}
        />
      </div>
    </div>
  );
}
