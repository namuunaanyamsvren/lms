export default function Avatar({ src, alt = 'Avatar', initials, size = 'md', className = '' }) {
  const sizes = {
    sm: 'h-8 w-8 text-sm',
    md: 'h-10 w-10 text-base',
    lg: 'h-14 w-14 text-lg',
  };

  return (
    <div
      className={`inline-flex items-center justify-center overflow-hidden rounded-full bg-slate-100 text-slate-700 ${sizes[size]} ${className}`}
      aria-label={alt}
    >
      {src ? (
        <img src={src} alt={alt} className="h-full w-full object-cover" />
      ) : (
        <span>{initials?.slice(0, 2).toUpperCase() || 'US'}</span>
      )}
    </div>
  );
}
