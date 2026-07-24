import { ArrowRight } from 'lucide-react';

export default function AuthSubmitButton({ loading, loadingText, children }) {
  return (
    <button
      type="submit"
      disabled={loading}
      className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 py-3.5 text-sm font-semibold text-white transition hover:bg-indigo-700 active:scale-[0.995] disabled:opacity-70"
    >
      {loading ? loadingText : children}
      {!loading && <ArrowRight className="h-4 w-4" />}
    </button>
  );
}
