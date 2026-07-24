import { Link } from 'react-router-dom';
import FadeContent from '../reactbits/FadeContent';

export default function CTASection() {
  return (
    <section className="bg-[#4f46e5] py-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <FadeContent distance={40} duration={0.7} blur={true}>
          <div className="rounded-[2rem] border border-indigo-400/30 bg-[#4f46e5] p-10 text-center shadow-2xl sm:p-14">
            <p className="text-sm font-semibold uppercase tracking-[0.32em] text-indigo-100">Сургуульдаа нэгдсэн систем нэвтрүүлэхэд бэлэн үү?</p>
            <h2 className="mt-5 text-4xl sm:text-5xl font-semibold text-white">Системийг үнэгүй туршиж, сургуулийнхаа бүтээмжийг нэмэгдүүлээрэй.</h2>
            <p className="mx-auto mt-6 max-w-2xl text-base leading-8 text-indigo-100">
              Оюутны дэмжлэг, багийн ажлын урсгал болон аналитикийг нэг дороос удирдахын тулд LMS-ийг ашигладаг их дээд сургуулиудын нэг болоорой.
            </p>
            <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
              <Link
                to="/register"
                className="inline-flex items-center justify-center rounded-full bg-white px-6 py-3 text-sm font-semibold text-indigo-600 transition hover:bg-slate-100 hover:scale-105 active:scale-95 shadow-md"
              >
                Үнэгүй турших
              </Link>
              <Link
                to="/login"
                className="inline-flex items-center justify-center rounded-full border border-white/80 px-6 py-3 text-sm font-semibold text-white transition hover:bg-white/10 hover:scale-105 active:scale-95"
              >
                Самбар руу нэвтрэх
              </Link>
            </div>
          </div>
        </FadeContent>
      </div>
    </section>
  );
}
