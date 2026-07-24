import { GraduationCap } from 'lucide-react';
import { Outlet } from 'react-router-dom';

const BRAND_IMAGE =
  'https://images.unsplash.com/photo-1523240795612-9a054b0db644?q=80&w=1600&auto=format&fit=crop';

export default function AuthLayout({ children }) {
  return (
    <div className="flex min-h-screen bg-white">
      {/* Form panel */}
      <div className="flex w-full items-center justify-center p-6 sm:p-10 lg:w-1/2 lg:p-12">
        <div className="w-full max-w-md">{children ?? <Outlet />}</div>
      </div>

      {/* Branding panel */}
      <div className="relative hidden overflow-hidden lg:flex lg:w-1/2">
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{ backgroundImage: `url('${BRAND_IMAGE}')` }}
        />
        <div className="absolute inset-0 bg-indigo-900/70" />

        <div className="relative z-10 flex w-full items-center justify-center p-12">
          <div className="w-full max-w-md rounded-3xl border border-white/20 bg-white/10 p-8 shadow-2xl backdrop-blur-xl">
            <div className="mb-6 flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/20">
                <GraduationCap className="h-6 w-6 text-white" />
              </div>
              <span className="text-xl font-bold text-white">
                EduPulse <span className="font-normal text-indigo-200">LMS</span>
              </span>
            </div>

            <h2 className="mb-4 text-3xl font-bold leading-tight text-white">
              Мэдлэгийн ирээдүй энд эхэлнэ
            </h2>

            <p className="mb-8 text-sm leading-relaxed text-indigo-100">
              Технологийн шинэ эриний боловсролын платформ. Оюутнууд, багш нар болон
              байгууллагууд нэг дор холбогдож, хамтдаа хөгжинө.
            </p>

            <div className="mb-8 flex items-center gap-3">
              <div className="flex -space-x-2">
                {['A', 'B', 'C'].map((initial) => (
                  <div
                    key={initial}
                    className="flex h-9 w-9 items-center justify-center rounded-full border-2 border-indigo-800 bg-indigo-500 text-xs font-semibold text-white"
                  >
                    {initial}
                  </div>
                ))}
              </div>
              <p className="text-sm text-indigo-100">
                <span className="font-semibold text-white">10,000+</span> оюутнууд нэгдсэн
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-xl border border-white/10 bg-white/10 px-4 py-3">
                <p className="text-xs text-indigo-200">Олон улсын стандарт</p>
                <p className="mt-1 text-sm font-semibold text-white">ISO 27001</p>
              </div>
              <div className="rounded-xl border border-white/10 bg-white/10 px-4 py-3">
                <p className="text-xs text-indigo-200">Шуурхай хариу</p>
                <p className="mt-1 text-sm font-semibold text-white">24/7 дэмжлэг</p>
              </div>
            </div>
          </div>
        </div>

        <div className="absolute -bottom-32 -right-32 h-96 w-96 rounded-full bg-indigo-400 opacity-20 blur-3xl" />
      </div>
    </div>
  );
}
