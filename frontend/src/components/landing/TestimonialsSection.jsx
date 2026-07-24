import SectionHeading from './SectionHeading';
import FadeContent from '../reactbits/FadeContent';

const testimonials = [
  {
    quote: 'LMS нь манай багш нарт тэнхим бүрийг хянах боломжийг олгосон бөгөөд оюутнуудад гар утасны хувилбар нь маш их таалагдаж байгаа.',
    name: 'Алисиа Барнес',
    title: 'Оюутны амжилтын албаны захирал',
  },
  {
    quote: 'Энэ нь яг л тусгайлан бэлдсэн боловсролын платформ шиг санагддаг ч шилдэг SaaS бүтээгдэхүүний хурд, чанарыг шингээсэн.',
    name: 'Маркус Ли',
    title: 'Үйл ажиллагаа хариуцсан дэд ерөнхийлөгч',
  },
  {
    quote: 'Хэрэглэгчийг бүртгэхээс эхлээд тайлагнах хүртэлх интерфэйс нь сургуулийн дүр бүрт тохирсон, ойлгомжтой, хурдан байдаг.',
    name: 'Прияа Шах',
    title: 'Сургуулийн захирал',
  },
];

export default function TestimonialsSection() {
  return (
    <section className="bg-slate-50 py-24">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <SectionHeading
          eyebrow="Хэрэглэгчдийн сэтгэгдэл"
          title="Сургуулийн удирдлагууд тодорхой байдал, хурд болон орчин үеийн программ хангамжийг нэвтрүүлэхийн тулд LMS-д итгэдэг."
        />

        <div className="mt-12 grid gap-6 md:grid-cols-3">
          {testimonials.map((testimonial, index) => (
            <FadeContent
              key={testimonial.name}
              delay={index * 0.12}
              distance={35}
              blur={true}
              duration={0.6}
            >
              <div className="h-full rounded-[2rem] border border-slate-200 bg-white p-8 shadow-soft transition-transform hover:-translate-y-1 hover:border-indigo-100">
                <p className="text-slate-700 leading-8">“{testimonial.quote}”</p>
                <div className="mt-6">
                  <p className="font-semibold text-slate-950">{testimonial.name}</p>
                  <p className="text-sm text-slate-500">{testimonial.title}</p>
                </div>
              </div>
            </FadeContent>
          ))}
        </div>
      </div>
    </section>
  );
}
