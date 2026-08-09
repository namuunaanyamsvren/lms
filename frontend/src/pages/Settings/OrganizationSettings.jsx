import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import PageHeader from '../../components/ui/PageHeader';
import Card from '../../components/ui/Card';
import { useToast } from '../../context/ToastContext';
import {
  fetchCurrentOrganization,
  updateCurrentOrganization,
  updateOrganizationSettings,
  requestDomainVerification,verifyOrganizationDomain,
} from '../../services/api';

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const HEX_COLOR_PATTERN = /^#[0-9a-fA-F]{6}$/;
const DOMAIN_PATTERN = /^(?!-)[a-z0-9-]+(\.[a-z0-9-]+)*\.[a-z]{2,}$/i;

export default function OrganizationSettings() {
  const { showToast } = useToast();
  const { register, handleSubmit, reset, formState: { errors, isSubmitting, isDirty } } = useForm({
    defaultValues: {
      name: '', slug: '', domain: '', logoUrl: '',faviconUrl:'',emailFromName:'',academicYear:'',semester:'',timezone:'Asia/Ulaanbaatar',locale:'mn-MN',invitationCode:'',allowedEmailDomains:'',gradingScale:'{"A":90,"B":80,"C":70,"D":60}',absenceThreshold:3,lateAfterMinutes:10,riskGradeThreshold:60,riskAttendanceThreshold:80,passwordPolicy:'{"minimumLength":12}',
      primaryColor: '#4F46E5', allowRegister: true, maxUsers: 100,requireEmailVerification:false,requirePhoneVerification:false,
    },
  });

  useEffect(() => {
    fetchCurrentOrganization()
      .then((organization) => {
        let attendanceRule;
        try {
          attendanceRule = organization.settings?.attendanceRuleJson ? JSON.parse(organization.settings.attendanceRuleJson) : {};
        } catch {
          attendanceRule = {};
        }
        reset({
          name: organization.name || '',
          slug: organization.slug || '',
          domain: organization.domain || '',
          logoUrl: organization.logoUrl || '',
          faviconUrl:organization.faviconUrl||'',emailFromName:organization.settings?.emailFromName||'',academicYear:organization.settings?.academicYear||'',semester:organization.settings?.semester||'',timezone:organization.settings?.timezone||'Asia/Ulaanbaatar',locale:organization.settings?.locale||'mn-MN',invitationCode:'',allowedEmailDomains:(organization.settings?.allowedEmailDomains||[]).join(', '),gradingScale:organization.settings?.gradingScaleJson||'{"A":90,"B":80,"C":70,"D":60}',absenceThreshold:attendanceRule.absenceThreshold||3,lateAfterMinutes:attendanceRule.lateAfterMinutes??10,riskGradeThreshold:attendanceRule.riskGradeThreshold??60,riskAttendanceThreshold:attendanceRule.riskAttendanceThreshold??80,passwordPolicy:organization.settings?.passwordPolicyJson||'{"minimumLength":12}',
          primaryColor: organization.settings?.primaryColor || '#4F46E5',
          allowRegister: organization.settings?.allowRegister ?? true,
          maxUsers: organization.settings?.maxUsers || 100,
          requireEmailVerification:organization.settings?.requireEmailVerification??false,requirePhoneVerification:organization.settings?.requirePhoneVerification??false,
        });
      })
      .catch(() => showToast('Байгууллагын тохиргоог ачаалж чадсангүй.', 'error'));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onSubmit = handleSubmit(async (values) => {
    try {
      await updateCurrentOrganization({
        name: values.name,
        slug: values.slug,
        ...(values.domain ? { domain: values.domain } : {}),
        ...(values.logoUrl ? { logoUrl: values.logoUrl } : {}),
        ...(values.faviconUrl?{faviconUrl:values.faviconUrl}:{}),
      });
      await updateOrganizationSettings({
        primaryColor: values.primaryColor,
        allowRegister: values.allowRegister,
        maxUsers: Number(values.maxUsers),
        emailFromName:values.emailFromName||null,academicYear:values.academicYear||null,semester:values.semester||null,timezone:values.timezone,locale:values.locale,requireEmailVerification:values.requireEmailVerification,requirePhoneVerification:values.requirePhoneVerification,allowedEmailDomains:values.allowedEmailDomains.split(',').map(x=>x.trim().toLowerCase()).filter(Boolean),gradingScale:JSON.parse(values.gradingScale),attendanceRule:{absenceThreshold:Number(values.absenceThreshold),lateAfterMinutes:Number(values.lateAfterMinutes),riskGradeThreshold:Number(values.riskGradeThreshold),riskAttendanceThreshold:Number(values.riskAttendanceThreshold)},passwordPolicy:JSON.parse(values.passwordPolicy),...(values.invitationCode?{invitationCode:values.invitationCode}:{}),
      });
      document.documentElement.style.setProperty('--organization-primary-color', values.primaryColor);
      showToast('Байгууллагын тохиргоог хадгаллаа.', 'success');
      reset(values);
    } catch (error) {
      showToast(error?.response?.data?.message || error.message || 'Хадгалахад алдаа гарлаа', 'error');
    }
  });

  return (
    <div className="space-y-6">
      <PageHeader title="Байгууллагын тохиргоо" subtitle="Байгууллагын харагдац болон бүртгэлийн бодлогыг удирдах." />
      <Card>
        <form onSubmit={onSubmit} className="grid gap-5 md:grid-cols-2 text-sm">
          <label className="space-y-2 font-medium text-slate-700">
            <span>Байгууллагын нэр *</span>
            <input
              {...register('name', { required: 'Нэр заавал шаардлагатай', minLength: { value: 2, message: 'Хамгийн багадаа 2 тэмдэгт' }, maxLength: 200 })}
              className="w-full rounded-lg border border-slate-200 px-3 py-2"
            />
            {errors.name && <p className="text-xs text-rose-600">{errors.name.message}</p>}
          </label>
          <label className="space-y-2 font-medium text-slate-700">
            <span>Байгууллагын богино нэр (slug) *</span>
            <input
              {...register('slug', {
                required: 'Slug заавал шаардлагатай',
                pattern: { value: SLUG_PATTERN, message: 'Зөвхөн жижиг үсэг, тоо, зураас (ж: my-school)' },
                maxLength: 100,
              })}
              className="w-full rounded-lg border border-slate-200 px-3 py-2"
            />
            {errors.slug && <p className="text-xs text-rose-600">{errors.slug.message}</p>}
          </label>
          <label className="space-y-2 font-medium text-slate-700">
            <span>Домэйн хаяг</span>
            <input
              {...register('domain', { pattern: { value: DOMAIN_PATTERN, message: 'Зөв домэйн хаяг оруулна уу (ж: school.mn)' }, maxLength: 253 })}
              className="w-full rounded-lg border border-slate-200 px-3 py-2"
            />
            {errors.domain && <p className="text-xs text-rose-600">{errors.domain.message}</p>}
          </label>
          <label className="space-y-2 font-medium text-slate-700">
            <span>Логоны холбоос</span>
            <input
              type="url"
              {...register('logoUrl', { pattern: { value: /^https?:\/\//, message: 'Бүрэн URL оруулна уу (https://...)' }, maxLength: 2000 })}
              className="w-full rounded-lg border border-slate-200 px-3 py-2"
            />
            {errors.logoUrl && <p className="text-xs text-rose-600">{errors.logoUrl.message}</p>}
          </label>
          <label className="space-y-2 font-medium text-slate-700">
            <span>Үндсэн өнгө *</span>
            <div className="flex gap-3">
              <input type="color" {...register('primaryColor', { pattern: { value: HEX_COLOR_PATTERN, message: 'Hex өнгө байх ёстой (#RRGGBB)' } })} className="h-10 w-14" />
              <input {...register('primaryColor', { required: true, pattern: HEX_COLOR_PATTERN })} className="flex-1 rounded-lg border border-slate-200 px-3 py-2" />
            </div>
            {errors.primaryColor && <p className="text-xs text-rose-600">Hex өнгө байх ёстой (#RRGGBB)</p>}
          </label>
          {[['faviconUrl','Favicon URL'],['emailFromName','Email илгээгчийн нэр'],['academicYear','Хичээлийн жил'],['semester','Улирал'],['timezone','Timezone'],['locale','Locale'],['allowedEmailDomains','Бүртгүүлэх email domain-ууд'],['invitationCode','Шинэ invitation code (сонголттой)']].map(([name,label])=><label key={name} className="space-y-2 font-medium text-slate-700"><span>{label}</span><input {...register(name)} className="w-full rounded-lg border border-slate-200 px-3 py-2"/></label>)}
          {[['gradingScale','Grading scale JSON'],['passwordPolicy','Password policy JSON']].map(([name,label])=><label key={name} className="space-y-2 font-medium text-slate-700"><span>{label}</span><textarea {...register(name)} className="w-full rounded-lg border border-slate-200 px-3 py-2 font-mono"/></label>)}
          <label className="space-y-2 font-medium text-slate-700">
            <span>Тасалсан удаагийн босго (энэ хэмжээнд хүрвэл менежерт анхааруулга явна)</span>
            <input
              type="number"
              {...register('absenceThreshold', { required: true, min: { value: 1, message: 'Хамгийн багадаа 1' }, max: { value: 365, message: 'Хамгийн ихдээ 365' } })}
              className="w-full rounded-lg border border-slate-200 px-3 py-2"
            />
            {errors.absenceThreshold && <p className="text-xs text-rose-600">{errors.absenceThreshold.message}</p>}
          </label>
          <label className="space-y-2 font-medium text-slate-700">
            <span>Хоцролт гэж тооцох минут</span>
            <input
              type="number"
              {...register('lateAfterMinutes', { required: true, min: { value: 0, message: 'Хамгийн багадаа 0' }, max: { value: 180, message: 'Хамгийн ихдээ 180' } })}
              className="w-full rounded-lg border border-slate-200 px-3 py-2"
            />
            {errors.lateAfterMinutes && <p className="text-xs text-rose-600">{errors.lateAfterMinutes.message}</p>}
          </label>
          <label className="space-y-2 font-medium text-slate-700">
            <span>Эрсдэлтэй гэж үзэх дүнгийн босго (%)</span>
            <input
              type="number"
              {...register('riskGradeThreshold', { required: true, min: { value: 0, message: '0-100 хооронд' }, max: { value: 100, message: '0-100 хооронд' } })}
              className="w-full rounded-lg border border-slate-200 px-3 py-2"
            />
            {errors.riskGradeThreshold && <p className="text-xs text-rose-600">{errors.riskGradeThreshold.message}</p>}
          </label>
          <label className="space-y-2 font-medium text-slate-700">
            <span>Эрсдэлтэй гэж үзэх ирцийн босго (%)</span>
            <input
              type="number"
              {...register('riskAttendanceThreshold', { required: true, min: { value: 0, message: '0-100 хооронд' }, max: { value: 100, message: '0-100 хооронд' } })}
              className="w-full rounded-lg border border-slate-200 px-3 py-2"
            />
            {errors.riskAttendanceThreshold && <p className="text-xs text-rose-600">{errors.riskAttendanceThreshold.message}</p>}
          </label>
          <label className="space-y-2 font-medium text-slate-700">
            <span>Хэрэглэгчийн дээд тоо *</span>
            <input
              type="number"
              {...register('maxUsers', { required: true, min: { value: 1, message: 'Хамгийн багадаа 1' }, max: { value: 100000, message: 'Хамгийн ихдээ 100000' } })}
              className="w-full rounded-lg border border-slate-200 px-3 py-2"
            />
            {errors.maxUsers && <p className="text-xs text-rose-600">{errors.maxUsers.message}</p>}
          </label>
          <label className="flex items-center gap-3 font-medium text-slate-700">
            <input type="checkbox" {...register('allowRegister')} />
            Хэрэглэгч өөрөө бүртгүүлэхийг зөвшөөрөх
          </label>
          <label className="flex items-center gap-3"><input type="checkbox" {...register('requireEmailVerification')}/>Email verification шаардах</label><label className="flex items-center gap-3"><input type="checkbox" {...register('requirePhoneVerification')}/>Phone verification шаардах</label>
          <div className="md:col-span-2 flex gap-2"><button type="button" className="btn" onClick={async()=>{const r=await requestDomainVerification(document.querySelector('input[name=domain]').value);showToast(`TXT ${r.data?.recordName||''}: ${r.data?.recordValue||''}`,'success')}}>Domain verification эхлүүлэх</button><button type="button" className="btn" onClick={async()=>{await verifyOrganizationDomain();showToast('Domain баталгаажлаа','success')}}>TXT шалгах</button></div>
          <div className="md:col-span-2 flex items-center gap-4">
            <button disabled={isSubmitting || !isDirty} className="rounded-lg bg-indigo-600 px-5 py-2 text-sm font-semibold text-white disabled:opacity-50">
              {isSubmitting ? 'Хадгалж байна…' : 'Тохиргоо хадгалах'}
            </button>
          </div>
        </form>
      </Card>
    </div>
  );
}
