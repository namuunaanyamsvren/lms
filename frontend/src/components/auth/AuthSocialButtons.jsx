function GoogleIcon() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <path d="M21.805 10.023h-9.78v3.956h5.6c-.244 1.337-1.06 2.469-2.264 3.2v2.657h3.656c2.141-1.974 3.38-4.897 3.38-8.713 0-.588-.05-1.158-.298-1.996z" fill="#4285F4" />
      <path d="M12.025 22c2.97 0 5.48-.98 7.28-2.66l-3.66-2.83c-1.01.68-2.3 1.09-3.62 1.09-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 22 12.025 22z" fill="#34A853" />
      <path d="M5.86 14.08c-.28-.84-.44-1.75-.44-2.68 0-.93.16-1.84.44-2.68V6.03H2.18A9.984 9.984 0 0 0 1 12c0 1.86.43 3.63 1.18 5.17l3.68-3.09z" fill="#FBBC05" />
      <path d="M12.025 4.5c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 1.91 14.97 0.88 12.025 0.88 7.7 0.88 3.99 3.35 2.18 6.95l3.66 2.84C8.97 6.43 11.41 4.5 12.025 4.5z" fill="#EA4335" />
    </svg>
  );
}

function MicrosoftIcon() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 24 24" aria-hidden="true">
      <path fill="#F25022" d="M1 1h10v10H1z" />
      <path fill="#7FBA00" d="M13 1h10v10H13z" />
      <path fill="#00A4EF" d="M1 13h10v10H1z" />
      <path fill="#FFB900" d="M13 13h10v10H13z" />
    </svg>
  );
}

export default function AuthSocialButtons() {
  return (
    <div className="grid grid-cols-2 gap-3">
      <button
        type="button"
        className="flex items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white py-2.5 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
      >
        <GoogleIcon />
        Google
      </button>
      <button
        type="button"
        className="flex items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white py-2.5 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
      >
        <MicrosoftIcon />
        Microsoft
      </button>
    </div>
  );
}
