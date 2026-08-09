import FadeContent from '../reactbits/FadeContent';

const campusImage =
  'https://images.unsplash.com/photo-1523580846011-d3a5bc25702b?q=80&w=1800&auto=format&fit=crop';

export default function ImageShowcase() {
  return (
    <section className="bg-white py-20">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <FadeContent distance={35} duration={0.7} blur={true}>
          <div className="grid overflow-hidden rounded-[2rem] border border-slate-200 bg-slate-50 shadow-soft lg:grid-cols-[1.1fr,0.9fr]">
            <div className="relative min-h-[320px]">
              <img
                src={campusImage}
                alt="Сургалтын орчинд хамтран ажиллаж буй оюутнууд"
                className="absolute inset-0 h-full w-full object-cover"
                loading="lazy"
              />
              <div className="absolute inset-0 bg-gradient-to-r from-slate-950/20 to-transparent" />
            </div>

            <div className="flex flex-col justify-center p-8 sm:p-10 lg:p-12">
              <p className="text-sm font-semibold uppercase tracking-[0.24em] text-primary">
                Орчин үеийн сургалтын орчин
              </p>
              <h2 className="mt-4 text-3xl font-semibold tracking-normal text-slate-950 sm:text-4xl">
                Оюутан, багш, удирдлага нэг платформ дээр холбогдоно.
              </h2>
              <p className="mt-5 text-base leading-8 text-slate-600">
                Сургалтын явц, даалгавар, ирц, дүн болон харилцааг нэг дор төвлөрүүлснээр өдөр тутмын ажил илүү ойлгомжтой, хурдан болдог.
              </p>
            </div>
          </div>
        </FadeContent>
      </div>
    </section>
  );
}
