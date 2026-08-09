import LegalPage, { LegalSection } from './LegalPage';

const operator = import.meta.env.VITE_LEGAL_ENTITY_NAME || 'Танай байгууллагын нэр';
const support = import.meta.env.VITE_SUPPORT_EMAIL || 'support@example.com';
const effectiveDate = import.meta.env.VITE_LEGAL_EFFECTIVE_DATE || '2026-07-30';

export default function Terms() {
  return (
    <LegalPage title="Үйлчилгээний нөхцөл" effectiveDate={effectiveDate}>
      <LegalSection title="Үйлчилгээ">
        <p>
          {operator} нь байгууллага, багш, суралцагч, эцэг эхэд зориулсан сургалтын
          удирдлагын системийг эрхийн түвшин, байгууллагын бодлогын дагуу олгоно.
        </p>
      </LegalSection>
      <LegalSection title="Account ба зөвшөөрөгдсөн хэрэглээ">
        <p>
          Хэрэглэгч account credential-ээ хамгаалж, зөвхөн өөрт олгосон эрхээр
          ашиглана. Бусдын account, tenant эсвэл объектод зөвшөөрөлгүй нэвтрэх,
          malware байршуулах, шалгалтын шударга байдлыг зөрчих, notification-ийг
          abuse хийхийг хориглоно.
        </p>
      </LegalSection>
      <LegalSection title="Сургалтын агуулга">
        <p>
          Байгууллага болон эрх бүхий багш нь байршуулсан агуулгын зөвшөөрөл,
          үнэн зөв байдал, retention-ийн хариуцлагыг хүлээнэ. Агуулга upload хийхдээ
          гуравдагч этгээдийн эрх, нууцлал, холбогдох хуулийг мөрдөнө.
        </p>
      </LegalSection>
      <LegalSection title="Түр зогсоох ба устгах">
        <p>
          Security abuse, хууль зөрчил эсвэл байгууллагын эрх дууссан тохиолдолд
          access-ийг түр зогсоож болно. Account deletion нь хувийн identity-г
          anonymize хийх боловч хууль ёсоор хадгалах ёстой академик/audit бичлэгт
          өөр retention үйлчилж болно.
        </p>
      </LegalSection>
      <LegalSection title="Холбоо барих">
        <p>
          Нөхцөлтэй холбоотой асуудлыг{' '}
          <a className="text-indigo-600 underline" href={`mailto:${support}`}>{support}</a>{' '}
          хаягаар илгээнэ. Production нэвтрүүлэлтийн өмнө байгууллага энэхүү
          загварыг өөрийн харьяалах хуульд нийцүүлэн хуульчаар хянуулна.
        </p>
      </LegalSection>
    </LegalPage>
  );
}
