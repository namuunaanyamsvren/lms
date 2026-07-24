import { useState } from 'react';
import SectionHeading from './SectionHeading';
import FadeContent from '../reactbits/FadeContent';

const faqs = [
  {
    question: 'Бид тэнхим бүрт зориулж ажлын урсгалыг өөрчилж болох уу?',
    answer: 'Тийм — LMS нь дүрд суурилсан тохиргоо болон өөрчлөх боломжтой хянах самбарыг дэмждэг тул баг бүр өөрт хэрэгтэй мэдээллээ харах боломжтой.',
  },
  {
    question: 'Нэгдсэн нэвтрэх (SSO) болон аюулгүй хандалтын хяналт байгаа юу?',
    answer: 'Мэдээж хэрэг. Бид сургуулийн аюулгүй байдлын багуудад зориулсан SSO интеграци, дүрийн зөвшөөрөл болон аудитын хэрэгслийг дэмждэг.',
  },
  {
    question: 'Бид ажилтан болон оюутнуудыг хэр хурдан нэгтгэх боломжтой вэ?',
    answer: 'Зааварчилгаа болон бэлэн загваруудын тусламжтайгаар ихэнх сургуулиуд хэдэн сар биш, хэдхэн долоо хоногийн дотор системээ ашиглаж эхэлдэг.',
  },
];

export default function FAQSection() {
  const [activeIndex, setActiveIndex] = useState(0);

  return (
    <section id="faq" className="bg-white py-24">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <SectionHeading
          eyebrow="Түгээмэл асуулт хариулт"
          title="Сургуулиуд болон хэрэглэгчдээс хамгийн их ирдэг асуултуудын хариулт."
        />

        <div className="mt-12 space-y-4">
          {faqs.map((faq, index) => {
            const open = activeIndex === index;
            return (
              <FadeContent
                key={faq.question}
                delay={index * 0.1}
                distance={30}
                blur={true}
                duration={0.5}
              >
                <button
                  type="button"
                  onClick={() => setActiveIndex(open ? -1 : index)}
                  className="w-full rounded-[2rem] border border-slate-200 bg-slate-50 p-6 text-left shadow-soft transition-all hover:border-indigo-200 hover:bg-slate-100/60"
                >
                  <div className="flex items-center justify-between gap-4">
                    <span className="text-base font-semibold text-slate-950">{faq.question}</span>
                    <span className="text-2xl text-indigo-600 font-bold">{open ? '−' : '+'}</span>
                  </div>
                  {open && <p className="mt-4 text-sm leading-7 text-slate-600">{faq.answer}</p>}
                </button>
              </FadeContent>
            );
          })}
        </div>
      </div>
    </section>
  );
}
