import { Link } from 'react-router-dom';
import CountUp from '../reactbits/CountUp';
import FadeContent from '../reactbits/FadeContent';
import BlurText from '../reactbits/BlurText';

export default function HeroSection() {
  return (
    <section className="relative overflow-hidden bg-white py-24">
      <div className="absolute left-1/2 top-0 h-[680px] w-[680px] -translate-x-1/2 rounded-full bg-indigo-100/70 blur-3xl" />
      <div className="absolute right-0 top-24 h-80 w-80 rounded-full bg-sky-100/80 blur-3xl" />
      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid gap-16 lg:grid-cols-[1.05fr,0.95fr] items-center">
          <div className="max-w-2xl">
            <FadeContent distance={20} duration={0.5} delay={0.1}>
              <span className="inline-flex items-center rounded-full bg-indigo-50 px-4 py-2 text-sm font-semibold uppercase tracking-[0.33em] text-indigo-700">
                Дээд зэрэглэлийн LMS систем
              </span>
            </FadeContent>

            <FadeContent distance={30} duration={0.7} delay={0.25} blur={true}>
              <h1 className="mt-8 text-5xl font-semibold tracking-tight text-slate-950 sm:text-6xl">
                <BlurText
                  text="Сургалт, дүн шинжилгээ, хамтын ажиллагааны орчин үеийн нэгдсэн систем."
                  animateBy="words"
                  delay={70}
                  className="inline-block"
                  as="span"
                />
              </h1>
            </FadeContent>

            <FadeContent distance={25} duration={0.6} delay={0.4}>
              <p className="mt-6 max-w-xl text-xl leading-9 text-slate-600">
                Их сургууль, боловсролын байгууллагуудад зориулан бүтээсэн Apple-аас сэдэвлэсэн минимал SaaS загвартай, оюутны цогц туршлагыг эхлүүлээрэй.
              </p>
            </FadeContent>

            <FadeContent distance={20} duration={0.6} delay={0.55}>
              <div className="mt-10 flex flex-col gap-4 sm:flex-row sm:items-center">
                <Link
                  to="/register"
                  className="inline-flex items-center justify-center rounded-full bg-indigo-600 px-7 py-3.5 text-sm font-semibold text-white shadow-lg shadow-indigo-500/20 transition hover:bg-indigo-700 hover:scale-105 focus-visible:outline-indigo-600 active:scale-95"
                >
                  Эхлэх
                </Link>
                <Link
                  to="/login"
                  className="inline-flex items-center justify-center rounded-full border border-slate-200 bg-white px-7 py-3.5 text-sm font-semibold text-slate-800 transition hover:border-indigo-300 hover:scale-105 active:scale-95"
                >
                  Нэвтрэх
                </Link>
              </div>
            </FadeContent>

            <div className="mt-12 grid gap-4 sm:grid-cols-3">
              <FadeContent distance={30} delay={0.65} blur={true}>
                <div className="rounded-[1.75rem] bg-indigo-50 p-5 text-slate-900 border border-indigo-100 shadow-soft transition-transform hover:-translate-y-1">
                  <p className="text-sm uppercase tracking-[0.24em] text-slate-500">Хэрэглэж буй сургууль</p>
                  <p className="mt-3 text-3xl font-semibold text-primary">
                    <CountUp from={0} to={120} suffix="+" duration={2} className="text-primary" />
                  </p>
                </div>
              </FadeContent>
              <FadeContent distance={30} delay={0.75} blur={true}>
                <div className="rounded-[1.75rem] bg-indigo-50 p-5 text-slate-900 border border-indigo-100 shadow-soft transition-transform hover:-translate-y-1">
                  <p className="text-sm uppercase tracking-[0.24em] text-slate-500">Оюутны итгэлцэл</p>
                  <p className="mt-3 text-3xl font-semibold text-primary">
                    <CountUp from={0} to={18} suffix="K+" duration={2} className="text-primary" />
                  </p>
                </div>
              </FadeContent>
              <FadeContent distance={30} delay={0.85} blur={true}>
                <div className="rounded-[1.75rem] bg-indigo-50 p-5 text-slate-900 border border-indigo-100 shadow-soft transition-transform hover:-translate-y-1">
                  <p className="text-sm uppercase tracking-[0.24em] text-slate-500">Шуурхай мэдээлэл</p>
                  <p className="mt-3 text-3xl font-semibold text-primary">24/7</p>
                </div>
              </FadeContent>
            </div>
          </div>

          <FadeContent distance={40} duration={0.8} delay={0.3} blur={true} className="relative perspective-1000">
            <div className="rounded-[2.5rem] border border-slate-200 bg-gradient-to-br from-white via-slate-50 to-indigo-50/30 p-6 shadow-soft tilt-3d preserve-3d">
              <div className="mb-6 flex items-center justify-between rounded-3xl bg-indigo-50 px-5 py-4 text-slate-900 border border-indigo-100 translate-z-10">
                <div>
                  <p className="text-sm uppercase tracking-[0.2em] text-slate-500">Хянах самбар</p>
                  <h2 className="mt-2 text-xl font-semibold text-slate-950">Сургуулийн гүйцэтгэл</h2>
                </div>
                <div className="rounded-2xl bg-indigo-600 px-3 py-2 text-sm font-semibold text-white animate-pulse">Шууд</div>
              </div>

              <div className="space-y-4 rounded-[2rem] bg-white p-6 text-slate-900 border border-indigo-100 shadow-2xl shadow-slate-900/10 translate-z-20 preserve-3d">
                <div className="flex items-center justify-between text-sm translate-z-10 text-slate-700">
                  <span className="text-primary">Идэвх оролцоо</span>
                  <span className="font-semibold text-primary">
                    <CountUp from={0} to={92} suffix="%" duration={2.5} className="text-primary" />
                  </span>
                </div>
                <div className="h-3 overflow-hidden rounded-full bg-indigo-100 translate-z-10">
                  <div className="h-3 w-4/5 rounded-full bg-indigo-500 transition-all duration-1000" />
                </div>
                <div className="grid gap-3 sm:grid-cols-2 translate-z-10">
                  <div className="rounded-3xl bg-indigo-50 p-4 border border-indigo-100">
                    <p className="text-sm text-slate-600">Идэвхтэй ангиуд</p>
                    <p className="mt-3 text-2xl font-semibold text-primary">
                      <CountUp from={0} to={248} duration={2} className="text-primary" />
                    </p>
                  </div>
                  <div className="rounded-3xl bg-indigo-50 p-4 border border-indigo-100">
                    <p className="text-sm text-slate-600">Хүлээгдэж буй даалгавар</p>
                    <p className="mt-3 text-2xl font-semibold text-primary">
                      <CountUp from={0} to={56} duration={2} className="text-primary" />
                    </p>
                  </div>
                </div>
              </div>

              <div className="mt-6 rounded-[2rem] border border-slate-200 bg-white p-5 translate-z-10 preserve-3d">
                <div className="relative h-64 overflow-hidden rounded-[1.75rem] bg-white p-6 text-slate-900 border border-indigo-100 shadow-slate-900/10 preserve-3d">
                  {/* Decorative glowing circles behind */}
                  <div className="absolute -left-10 -top-10 h-32 w-32 rounded-full bg-indigo-500/20 blur-2xl animate-pulse" />
                  <div className="absolute -right-10 -bottom-10 h-32 w-32 rounded-full bg-cyan-500/20 blur-2xl animate-pulse" />

                  <div className="flex items-center justify-between text-sm text-slate-600 translate-z-10">
                    <span className="text-slate-700">Үр дүнгийн шинжилгээ</span>
                    <span className="rounded-full bg-indigo-100 px-3 py-1 text-xs font-semibold text-indigo-700">
                      AI Зөвлөмж
                    </span>
                  </div>

                  {/* Floating 3D Cards */}
                  <div className="relative mt-8 h-32 flex items-center justify-center">
                    {/* Behind Card */}
                    <div className="absolute left-2 w-44 rounded-2xl border border-indigo-100 bg-indigo-50 p-4 backdrop-blur-md shadow-2xl animate-float pointer-events-none">
                      <p className="text-[11px] text-slate-600">Идэвхтэй сурагчид</p>
                      <p className="mt-1 text-lg font-bold text-slate-950">
                        <CountUp from={0} to={1840} separator="," duration={2.5} className="text-primary" />
                      </p>
                      <div className="mt-2 h-1 w-full rounded-full bg-indigo-100">
                        <div className="h-1 w-3/4 rounded-full bg-indigo-500" />
                      </div>
                    </div>

                    {/* Front Card */}
                    <div className="absolute right-2 w-44 rounded-2xl border border-sky-100 bg-sky-50 p-4 backdrop-blur-lg shadow-2xl animate-float-delayed pointer-events-none">
                      <p className="text-[11px] text-slate-600">Амжилтын хувь</p>
                      <p className="mt-1 text-xl font-extrabold text-slate-950">
                        +<CountUp from={0} to={14.2} decimals={1} suffix="%" duration={2.5} className="text-primary" />
                      </p>
                      <p className="text-[10px] text-emerald-400">▲ Маш сайн</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </FadeContent>
        </div>
      </div>
    </section>
  );
}
