import LegalPage, { LegalSection } from './LegalPage';

const operator = import.meta.env.VITE_LEGAL_ENTITY_NAME || 'Танай байгууллагын нэр';
const contact = import.meta.env.VITE_PRIVACY_CONTACT_EMAIL || 'privacy@example.com';
const effectiveDate = import.meta.env.VITE_LEGAL_EFFECTIVE_DATE || '2026-07-30';

export default function PrivacyPolicy() {
  return (
    <LegalPage title="Нууцлалын бодлого" effectiveDate={effectiveDate}>
      <LegalSection title="Хариуцагч байгууллага">
        <p>
          Энэхүү LMS-ийн хувийн мэдээлэл хариуцагч нь {operator}. Нууцлалын хүсэлтээ{' '}
          <a className="text-indigo-600 underline" href={`mailto:${contact}`}>{contact}</a>{' '}
          хаягаар илгээнэ.
        </p>
      </LegalSection>
      <LegalSection title="Бидний боловсруулах мэдээлэл">
        <p>
          Бүртгэлийн нэр, имэйл, утас; байгууллага ба эрх; session/device security
          metadata; хичээлийн бүртгэл, даалгавар, шалгалт, дүн, ирц, мэдэгдлийн
          тохиргоо зэрэг LMS ажиллуулахад шаардлагатай мэдээлэл боловсруулна.
        </p>
        <p>
          Нууц үгийг plaintext хэлбэрээр хадгалахгүй. OAuth provider-ийн нууц token
          хадгалахгүй бөгөөд холбоосын provider account identifier-ийг хэрэглэнэ.
        </p>
      </LegalSection>
      <LegalSection title="Зорилго ба хуваалцах">
        <p>
          Үйлчилгээ үзүүлэх, сургалтын явц бүртгэх, account хамгаалах, хууль ёсны
          audit болон support хийх зорилгоор боловсруулна. SMTP, SMS, push, object
          storage зэрэг баталгаажсан дэд боловсруулагчид зөвхөн шаардлагатай хүрээнд
          дамжуулж болно. Мэдээллийг худалдахгүй.
        </p>
      </LegalSection>
      <LegalSection title="Хадгалалт ба таны эрх">
        <p>
          Security audit, session/token, notification болон академик бичлэг бүр
          тусдаа retention хугацаатай. Security settings-ээс өөрийн data export-ыг
          JSON хэлбэрээр татаж, account deletion/anonymization хүсэлт гүйцэтгэж болно.
          Хуулиар заавал хадгалах академик бичлэг identity-гаас салгагдан үлдэж болно.
        </p>
      </LegalSection>
      <LegalSection title="Хүүхэд, суралцагчийн мэдээлэл">
        <p>
          Насанд хүрээгүй хэрэглэгчийн насны босго, guardian consent, эрх цуцлах
          горимыг байгууллага өөрийн харьяалах хууль ба бодлогод нийцүүлэн
          тохируулна. Баталгаажаагүй guardian-д суралцагчийн мэдээлэл харуулахгүй.
        </p>
      </LegalSection>
      <LegalSection title="Cookie ба local storage" id="cookies">
        <p>
          HttpOnly refresh session cookie, CSRF хамгаалалтын cookie болон UI
          preference local storage нь зайлшгүй ажиллагаанд хэрэглэгдэнэ. Analytics
          эсвэл advertising cookie нэмбэл урьдчилан мэдэгдэж, шаардлагатай consent
          сонголтыг тусад нь авна.
        </p>
      </LegalSection>
      <LegalSection title="Аюулгүй байдал ба incident">
        <p>
          TLS, tenant isolation, least privilege, audit, rate limit, secure upload,
          dependency/secret scanning зэрэг хамгаалалт хэрэглэнэ. Мэдээллийн incident
          гарвал нөлөө, хууль болон байгууллагын журмын дагуу холбогдох талуудад
          мэдэгдэнэ.
        </p>
      </LegalSection>
    </LegalPage>
  );
}
