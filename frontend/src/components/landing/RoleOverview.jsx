import SectionHeading from './SectionHeading';
import FadeContent from '../reactbits/FadeContent';
import {
  GraduationCap,
  BookOpen,
  BriefcaseBusiness,
} from "lucide-react";

const roles = [
  {
    icons: <GraduationCap />,
    title: 'Оюутнууд',
    description: 'Даалгавраа хянах, үе тэнгийнхэнтэйгээ хамтрах, төгсөх замаа алдалгүй хянах.',
  },
  {
    icons: <BookOpen />,
    title: 'Багш нар',
    description: 'Хичээлээ сонирхолтой заах, сурлагын явцыг хянах, нэгдсэн системээр оюутныг дэмжих.',
  },
  {
    icons: <BriefcaseBusiness />,
    title: 'Удирдлагууд',
    description: 'Сургуулийн нөөц, элсэлт болон аналитикийг өөр өөр програм руу шилжихгүйгээр удирдах.',
  },
];

export default function RoleOverview() {
  return (
    <section id="roles" className="bg-slate-50 py-24">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <SectionHeading
          eyebrow="Дүрд суурилсан хэрэглээ"
          title="Сургуулийн орчинд суралцах үйл ажиллагааг дэмжигч хүн бүрт зориулагдсан."
          description="Удирдлагаас авахуулаад ангийн багш хүртэл LMS нь ажлын урсгал бүрт тохирсон хянах самбар, мэдэгдлээр хангана."
        />

        <div className="mt-12 grid gap-6 xl:grid-cols-3">
          {roles.map((role, index) => (
            <FadeContent
              key={role.title}
              delay={index * 0.15}
              distance={35}
              blur={true}
              duration={0.6}
            >
              <div className="h-full rounded-[2rem] border border-slate-200 bg-white p-8 shadow-soft transition-transform hover:-translate-y-1 hover:border-indigo-100">
                <div className="flex h-14 w-14 items-center justify-center rounded-3xl bg-indigo-50 text-indigo-600 text-2xl">
                  {role.icons}
                </div>
                <h3 className="mt-6 text-xl font-semibold text-slate-950">{role.title}</h3>
                <p className="mt-4 text-sm leading-7 text-slate-600">{role.description}</p>
              </div>
            </FadeContent>
          ))}
        </div>
      </div>
    </section>
  );
}
