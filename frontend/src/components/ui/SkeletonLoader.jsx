export default function SkeletonLoader({ className = '', variant = 'default' }) {
  const variants = {
    default: 'h-4 w-full',
    circle: 'rounded-full',
    text: 'h-4 w-3/4',
    avatar: 'h-10 w-10 rounded-full',
    card: 'h-32 w-full',
    button: 'h-10 w-24',
  };

  const baseClasses = 'animate-pulse bg-slate-200 rounded';
  const variantClasses = variants[variant] || variants.default;

  return (
    <div className={`${baseClasses} ${variantClasses} ${className}`} />
  );
}

export function SkeletonText({ lines = 3, className = '' }) {
  return (
    <div className={`space-y-2 ${className}`}>
      {Array.from({ length: lines }).map((_, i) => (
        <SkeletonLoader 
          key={i} 
          variant={i === lines - 1 ? 'text' : 'default'} 
          className={i === lines - 1 ? 'w-1/2' : ''}
        />
      ))}
    </div>
  );
}

export function SkeletonCard({ className = '' }) {
  return (
    <div className={`rounded-xl border border-slate-200 bg-white p-4 ${className}`}>
      <div className="flex items-start gap-4">
        <SkeletonLoader variant="avatar" />
        <div className="flex-1 space-y-2">
          <SkeletonLoader variant="text" />
          <SkeletonLoader />
          <SkeletonLoader className="w-2/3" />
        </div>
      </div>
    </div>
  );
}
