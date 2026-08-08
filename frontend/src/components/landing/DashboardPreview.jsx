import SectionHeading from './SectionHeading';
import CountUp from '../reactbits/CountUp';
import FadeContent from '../reactbits/FadeContent';

export default function DashboardPreview() {
  return (
    <section id="dashboard" className="py-24">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid gap-16 lg:grid-cols-[0.95fr,1.05fr] items-center">
          <div>
            <SectionHeading
              eyebrow="Хянах самбар урьдчилан харах"
              title="Оюутны суралцах явцыг орчин үеийн, хэрэглэхэд хялбар интерфэйсээс харах."
              description="Ирц, дүнгээс эхлээд сургуулийн зар мэдэгдэл хүртэлх бүх зүйлийг нэг дороос хянах боломжтой бөгөөд ингэснээр шийдвэр гаргалтыг хурдасгаж, сурлагын явцыг сайжруулна."
            />
            <div className="mt-8 grid gap-4 sm:grid-cols-2">
              <FadeContent distance={30} delay={0.1} blur={true}>
                <div className="rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-soft transition-transform hover:-translate-y-1">
                  <p className="text-sm uppercase tracking-[0.24em] text-indigo-600">Ирц</p>
                  <p className="mt-4 text-3xl font-semibold text-slate-950">
                    <CountUp from={0} to={98} suffix="%" duration={2} />
                  </p>
                  <p className="mt-2 text-sm text-slate-500">Дундаж цаг баримтлалт</p>
                </div>
              </FadeContent>

              <FadeContent distance={30} delay={0.2} blur={true}>
                <div className="rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-soft transition-transform hover:-translate-y-1">
                  <p className="text-sm uppercase tracking-[0.24em] text-indigo-600">Идэвх оролцоо</p>
                  <p className="mt-4 text-3xl font-semibold text-slate-950">
                    <CountUp from={0} to={4.8} decimals={1} suffix="/5" duration={2} />
                  </p>
                  <p className="mt-2 text-sm text-slate-500">Оюутны сэтгэл ханамж</p>
                </div>
              </FadeContent>
            </div>
          </div>

          <FadeContent distance={40} duration={0.8} delay={0.3} blur={true} className="relative">
            <div className="absolute inset-x-0 top-0 h-full rounded-[2rem] bg-gradient-to-br from-indigo-100/80 via-white to-slate-50 blur-3xl" />
            <div className="relative overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-soft">
              <div className="border-b border-indigo-100 bg-indigo-50 px-6 py-4 text-slate-900">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm uppercase tracking-[0.28em] text-slate-500">Ангийн гүйцэтгэл</p>
                    <h3 className="mt-3 text-2xl font-semibold text-slate-950">Семестрийн тойм</h3>
                  </div>
                  <div className="rounded-2xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white">Шууд</div>
                </div>
              </div>
              <div className="px-6 py-8">
                <div className="grid gap-4">
                  <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
                    <div className="flex items-center justify-between text-sm text-slate-600">
                      <span>Математик</span>
                      <span className="font-semibold text-slate-900">A+</span>
                    </div>
                  </div>
                  <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
                    <div className="flex items-center justify-between text-sm text-slate-600">
                      <span>Байгалийн ухаан</span>
                      <span className="font-semibold text-slate-900">A</span>
                    </div>
                  </div>
                  <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
                    <div className="flex items-center justify-between text-sm text-slate-600">
                      <span>Ирц</span>
                      <span className="font-semibold text-slate-900">
                        <CountUp from={0} to={98} suffix="%" duration={2} />
                      </span>
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
