import SectionHeading from './SectionHeading';
import FadeContent from '../reactbits/FadeContent';

const universities = ['Stanford', 'Harvard', 'Oxford', 'MIT', 'Yale', 'Cambridge'];

export default function UniversitySection() {
  return (
    <section id="universities" className="bg-white py-24">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <SectionHeading
          eyebrow="Шилдэг сургуулиудын сонголт"
          title="100 гаруй их сургуулиуд сургуулийн үйл ажиллагаа болон оюутны амжилтыг дэмжихэд LMS-ийг сонгодог."
          description="Элсэлтийн албанаас эхлээд оюутныг дэмжих үйлчилгээ хүртэл манай платформ нь танай сургуулийн бүх тэнхимд тохируулан ажиллах боломжтой."
        />

        <div className="mt-12 grid gap-4 sm:grid-cols-3 lg:grid-cols-6 items-center">
          {universities.map((name, index) => (
            <FadeContent
              key={name}
              delay={index * 0.08}
              distance={25}
              blur={true}
              duration={0.5}
            >
              <div
                className="flex h-16 items-center justify-center rounded-3xl border border-slate-200 bg-slate-50 text-sm font-semibold text-slate-700 transition-all hover:border-indigo-300 hover:bg-indigo-50/50 hover:text-indigo-700"
              >
                {name}
              </div>
            </FadeContent>
          ))}
        </div>
      </div>
    </section>
  );
}
