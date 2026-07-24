export default function LoadingSpinner({ size = 'md', className = '' }) {
  const sizes = {
    sm: 'h-6 w-6 border-2',
    md: 'h-8 w-8 border-2.5',
    lg: 'h-10 w-10 border-3',
  };

  return (
    <div className={`inline-flex items-center justify-center ${className}`}>
      <span className={`inline-block animate-spin rounded-full border-slate-200 border-t-slate-900 ${sizes[size]}`} />
    </div>
  );
}
