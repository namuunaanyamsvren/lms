export default function AuthDivider({ text = 'ЭСВЭЛ' }) {
  return (
    <div className="flex items-center gap-4">
      <div className="h-px flex-1 bg-gray-200" />
      <span className="text-xs font-semibold tracking-wider text-gray-400">{text}</span>
      <div className="h-px flex-1 bg-gray-200" />
    </div>
  );
}
