import LegalPage, { LegalSection } from './LegalPage';

export default function MinorPrivacy() {
  return (
    <LegalPage title="Насанд хүрээгүй суралцагчийн бодлого" effectiveDate="2026-07-30">
      <LegalSection title="Байгууллагын тохиргоо">
        <p>
          Насны босго болон consent-ийн хууль нь улс, боловсролын байгууллагаар
          ялгаатай. Organization owner нь харьяалах хууль, насны босго, lawful
          basis болон guardian verification журмаа production ашиглалтаас өмнө
          батална.
        </p>
      </LegalSection>
      <LegalSection title="Guardian verification ба access">
        <p>
          Guardian холбоосыг байгууллагын эрх бүхий ажилтан баталгаажуулна.
          Баталгаажсан холбоосгүй parent account нь суралцагчийн хичээл, дүн, ирц,
          шалгалт зэрэг мэдээлэлд нэвтрэх эрхгүй. Access ба өөрчлөлтийг audit-д
          бүртгэнэ.
        </p>
      </LegalSection>
      <LegalSection title="Data minimization ба consent">
        <p>
          Нас тогтоох зорилгоор шаардлагагүй төрсөн огноо цуглуулахгүй. Consent
          шаардлагатай optional боловсруулалтыг consent баталгаажих хүртэл
          идэвхжүүлэхгүй. Guardian consent-ээ цуцлах, мэдээлэл засах/татах хүсэлт
          гаргах боломжтой байна.
        </p>
      </LegalSection>
      <LegalSection title="Хориглох хэрэглээ">
        <p>
          Насанд хүрээгүй хэрэглэгчийн мэдээллээр targeted advertising, profiling,
          худалдаа хийхгүй. Production бодлого, сургалт, incident escalation болон
          retention-ийг байгууллагын data protection хариуцагч тогтмол хянана.
        </p>
      </LegalSection>
    </LegalPage>
  );
}
