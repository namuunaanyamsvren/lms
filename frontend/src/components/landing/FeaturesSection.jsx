import FeatureCard from './FeatureCard';
import SectionHeading from './SectionHeading';
import FadeContent from '../reactbits/FadeContent';
import {
  BarChart3,
  BrainCircuit,
  ShieldCheck,
  UsersRound,
} from "lucide-react";

const features = [
  {
    icon: <BarChart3  className="w-7 h-7"/>,
    title: 'Бодит хугацааны аналитик',
    description: 'Удирдлага болон багш нарт зориулсан хянах самбараар дамжуулан үйл ажиллагаа бүрийг шинжлэх боломж.',
  },
  {
    icon: <BrainCircuit  className="w-7 h-7"/>,
    title: 'Хувийн сургалтын төлөвлөгөө',
    description: 'Оюутан бүрийн явцыг автоматаар хянаж, академик зөвлөмжүүдийг санал болгох.',
  },
  {
    icon: <ShieldCheck  className="w-7 h-7"/>,
    title: 'Аюулгүй өгөгдлийн хяналт',
    description: 'Нэгдсэн удирдлагын системээр дамжуулан хандах эрх болон аюулгүй байдлыг хангах.',
  },
  {
    icon: <UsersRound  className="w-7 h-7"/>,
    title: 'Олон талт хамтын ажиллагаа',
    description: 'Хамтарсан даалгавар, нээлттэй харилцаа холбоогоор ажилтан, багш, эцэг эхийг холбох.',
  },
];

export default function FeaturesSection() {
  return (
    <section id="features" className="bg-slate-50 py-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <SectionHeading
          eyebrow="Орчин үеийн сургуулиудад зориулав"
          title="Сурч боловсрох, зааж сургах, системтэйгээр хөгжихөд хэрэгтэй бүх зүйл."
          description="Сурган хүмүүжүүлэгчид болон сургуулийн удирдлагуудад зориулж бүтээсэн LMS нь ажлын урсгал, аналитик болон оюутны дэмжлэгийг нэг дор нэгтгэсэн платформ юм."
        />

        <div className="mt-12 grid gap-6 sm:grid-cols-2 xl:grid-cols-4">
          {features.map((feature, index) => (
            <FadeContent
              key={feature.title}
              delay={index * 0.12}
              distance={40}
              blur={true}
              duration={0.6}
            >
              <FeatureCard {...feature} />
            </FadeContent>
          ))}
        </div>
      </div>
    </section>
  );
}
