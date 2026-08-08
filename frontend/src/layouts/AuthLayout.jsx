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
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden bg-slate-950 text-white">
        {/* Background Image */}
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{
            backgroundImage:
              "url('https://images.unsplash.com/photo-1523240795612-9a054b0db644?q=80&w=1600&auto=format&fit=crop')",
          }}
        />

        {/* Overlay */}
        <div className="absolute inset-0 bg-slate-950/65" />
        <div className="absolute -right-32 bottom-[-8rem] h-96 w-96 rounded-full bg-secondary/45 blur-3xl" />
        <div className="absolute left-[-10rem] top-[-8rem] h-80 w-80 rounded-full bg-primary/35 blur-3xl" />

        {/* Content */}
        <div className="relative z-10 flex flex-col justify-center px-12 lg:px-16">
          <h1 className="mb-8 text-4xl font-extrabold tracking-normal text-white">
            EduPulse LMS
          </h1>

          <h2 className="mb-6 text-5xl font-black tracking-normal leading-[1.15] text-white drop-shadow-sm">
            Суралц.
            <br />
            Хөгж.
            <br />
            Амжилтад хүр.
          </h2>

          <p className="max-w-lg text-lg font-normal leading-8 text-white">
            Их дээд сургууль, коллеж, сургуулиудад зориулсан орчин үеийн сургалтын удирдлагын систем. Хичээл, даалгавар, дүн болон харилцааг нэг платформоос удирдах боломж.
          </p>
        </div>
      </div>
    </div>
  );
}
