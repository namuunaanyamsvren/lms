import SectionHeading from './SectionHeading';
import CountUp from '../reactbits/CountUp';
import FadeContent from '../reactbits/FadeContent';

const stats = [
  { numericValue: 120, suffix: '+', label: 'Их дээд сургуулиуд' },
  { numericValue: 18, suffix: 'K', label: 'Өдөр тутмын идэвхтэй суралцагч' },
  { numericValue: 96, suffix: '%', label: 'Сургуульдаа үлдэх хувь' },
  { numericValue: 30, suffix: '%', label: 'Ажлын бүтээмжийн өсөлт' },
];

export default function StatisticsSection() {
  return (
    <section className="bg-white py-24">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <SectionHeading
          eyebrow="Тоон үзүүлэлтүүд"
          title="Боловсролын байгууллагыг урагш хөтлөх орчин үеийн SaaS туршлага."
          description="Доорх үзүүлэлтүүд нь сургуулийн удирдлагууд яагаад боловсролын багийг илүү тодорхой, хурдан ажиллуулахад LMS-д итгэдэгийг харуулж байна."
        />

        <div className="mt-12 grid gap-6 sm:grid-cols-2 xl:grid-cols-4">
          {stats.map((stat, index) => (
            <FadeContent
              key={stat.label}
              delay={index * 0.1}
              distance={35}
              blur={true}
              duration={0.6}
            >
              <div className="group rounded-[2rem] border border-slate-200 bg-slate-50 p-8 text-center shadow-soft transition-all duration-300 hover:-translate-y-1 hover:border-indigo-200 hover:bg-white hover:shadow-xl">
                <p className="text-4xl sm:text-5xl font-extrabold text-slate-950 tracking-tight">
                  <CountUp
                    from={0}
                    to={stat.numericValue}
                    suffix={stat.suffix}
                    duration={2}
                  />
                </p>
                <p className="mt-3 text-sm font-medium text-slate-600 group-hover:text-slate-800">{stat.label}</p>
              </div>
            </FadeContent>
          ))}
        </div>
      </div>
    </section>
  );
}
