import { Outlet } from "react-router-dom";

export default function AuthLayout({ children }) {
  return (
    <div className="min-h-screen flex bg-white">
      {/* Left Side */}
      <main className="w-full lg:w-1/2 flex items-center justify-center p-6 lg:p-12">
        <div className="w-full max-w-md">
          {/* Prefer explicit children for programmatic rendering, fall back to Outlet for router usage */}
          {children ?? <Outlet />}
        </div>
      </main>

      {/* Right Side */}
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden border-l border-slate-200 bg-white">
        <div className="relative z-10 flex flex-col justify-center px-12 lg:px-16">
          <h1 className="mb-8 text-4xl font-extrabold tracking-normal text-slate-950">
            EduPulse LMS
          </h1>

          <h2 className="mb-6 text-5xl font-black tracking-normal leading-[1.15] text-slate-950">
            Суралц.
            <br />
            Хөгж.
            <br />
            Амжилтад хүр.
          </h2>

          <p className="max-w-lg text-lg font-normal leading-8 text-slate-600">
            Их дээд сургууль, коллеж, сургуулиудад зориулсан орчин үеийн сургалтын удирдлагын систем. Хичээл, даалгавар, дүн болон харилцааг нэг платформоос удирдах боломж.
          </p>
        </div>
      </div>
    </div>
  );
}
