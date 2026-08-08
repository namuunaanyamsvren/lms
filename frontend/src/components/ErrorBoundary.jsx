import { Component } from 'react';
import { AlertTriangle } from 'lucide-react';

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error('[ErrorBoundary]', error, info);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-slate-50 p-6 text-center">
        <AlertTriangle size={40} className="text-rose-500" />
        <h1 className="text-lg font-bold text-slate-900">Гэнэтийн алдаа гарлаа</h1>
        <p className="max-w-md text-sm text-slate-500">
          Апп-д ямар нэг зүйл буруу ажиллалаа. Хуудсыг дахин ачаалж үзнэ үү.
        </p>
        <button
          onClick={() => window.location.reload()}
          className="rounded-2xl bg-indigo-600 px-5 py-2 text-sm font-semibold text-white hover:bg-indigo-700 shadow-md transition"
        >
          Дахин ачаалах
        </button>
      </div>
    );
  }
}
