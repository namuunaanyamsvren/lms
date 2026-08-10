import { prisma } from '../lib/prisma';
const escapeHtml = (value: unknown) => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
export const renderTemplateString = (template: string, variables: Record<string, unknown>, html = false) =>
  template.replace(/\{\{([a-zA-Z0-9_]+)\}\}/g, (_all, key) => html ? escapeHtml(variables[key]) : String(variables[key] ?? ''));
const defaults: Record<string,{subject:string;text:string;html:string}> = {
  WELCOME:{subject:'{{organizationName}}-д тавтай морил',text:'Сайн байна уу, {{firstName}}. Таны бүртгэл амжилттай үүслээ.',html:'<h1>Тавтай морил, {{firstName}}</h1><p>Таны бүртгэл амжилттай үүслээ.</p>'},
  EMAIL_VERIFICATION:{subject:'Имэйл хаягаа баталгаажуулна уу',text:'Баталгаажуулах холбоос: {{actionUrl}}',html:'<h1>Имэйл баталгаажуулах</h1><p><a href="{{actionUrl}}">Имэйлээ баталгаажуулах</a></p>'},
  PASSWORD_RESET:{subject:'Нууц үгээ сэргээх',text:'Нууц үг сэргээх холбоос: {{actionUrl}}',html:'<h1>Нууц үг сэргээх</h1><p><a href="{{actionUrl}}">Нууц үгээ сэргээх</a></p>'},
  USER_INVITED:{subject:'Та системд урьгдлаа',text:'Нууц үгээ тохируулж бүртгэлээ идэвхжүүлнэ үү: {{actionUrl}}',html:'<h1>Тавтай морил</h1><p>Танд бүртгэл үүсгэгдлээ. Нууц үгээ тохируулж идэвхжүүлнэ үү:</p><p><a href="{{actionUrl}}">Нууц үг тохируулах</a></p>'},
  GUARDIAN_INVITE:{subject:'EduPulse LMS эцэг эхийн урилга',text:'{{studentName}} сурагчийн эцэг эхийн эрх холбох код: {{guardianLinkCode}}. Сурагчийн ID: {{studentId}}. Бүртгүүлэх: {{registerUrl}} Нэвтрэх: {{loginUrl}}',html:'<h1>EduPulse LMS эцэг эхийн урилга</h1><p>{{studentName}} сурагчийн эцэг эхийн эрхээр холбогдох код:</p><h2>{{guardianLinkCode}}</h2><p>Сурагчийн ID: {{studentId}}</p><p><a href="{{registerUrl}}">Бүртгүүлэх</a> эсвэл <a href="{{loginUrl}}">Нэвтрэх</a></p><p>Нэвтэрсний дараа “Би эцэг эх / асран хамгаалагч” сонгоод дээрх кодыг оруулна уу.</p>'},
  BILLING_INVOICE_ISSUED:{subject:'Шинэ нэхэмжлэх',text:'Танд {{amount}} {{currency}} нэхэмжлэх үүслээ: {{actionUrl}}',html:'<h1>Шинэ нэхэмжлэх</h1><p>Танд {{amount}} {{currency}} нэхэмжлэх үүслээ.</p><p><a href="{{actionUrl}}">Төлбөр харах</a></p>'},
  BILLING_PAYMENT_REMINDER:{subject:'Төлбөрийн сануулга',text:'Таны {{amount}} {{currency}} төлбөр хүлээгдэж байна: {{actionUrl}}',html:'<h1>Төлбөрийн сануулга</h1><p>Таны {{amount}} {{currency}} төлбөр хүлээгдэж байна.</p><p><a href="{{actionUrl}}">Төлөх</a></p>'},
  BILLING_PAYMENT_SUCCEEDED:{subject:'Төлбөр амжилттай',text:'Таны төлбөр амжилттай бүртгэгдлээ: {{actionUrl}}',html:'<h1>Төлбөр амжилттай</h1><p>Таны төлбөр амжилттай бүртгэгдлээ.</p><p><a href="{{actionUrl}}">Түүх харах</a></p>'},
  BILLING_PAYMENT_FAILED:{subject:'Төлбөр амжилтгүй',text:'Төлбөр амжилтгүй боллоо: {{actionUrl}}',html:'<h1>Төлбөр амжилтгүй</h1><p>Төлбөр амжилтгүй боллоо.</p><p><a href="{{actionUrl}}">Дахин оролдох</a></p>'},
  BILLING_PAYMENT_REFUNDED:{subject:'Төлбөр буцаагдлаа',text:'Төлбөр буцаагдлаа: {{actionUrl}}',html:'<h1>Төлбөр буцаагдлаа</h1><p>Төлбөр буцаагдлаа.</p><p><a href="{{actionUrl}}">Түүх харах</a></p>'},
  GENERAL:{subject:'{{title}}',text:'{{body}}',html:'<p>{{body}}</p>'},
};
export async function renderTemplate(organizationId:string,eventType:string,locale:string,variables:Record<string,unknown>){
 const [custom,branding]=await Promise.all([
  prisma.notificationTemplate.findUnique({where:{organizationId_eventType_locale:{organizationId,eventType,locale}}}),
  prisma.notificationBranding.findUnique({where:{organizationId}}),
 ]);
 const base=custom?{subject:custom.subjectTemplate,text:custom.textTemplate,html:custom.htmlTemplate}:(defaults[eventType]||defaults.GENERAL);
 const values={organizationName:branding?.organizationName||'LMS',...variables};
 const content=renderTemplateString(base.html,values,true);
 const html=`<!doctype html><html><body style="margin:0;background:#f8fafc;font-family:Arial,sans-serif"><div style="max-width:640px;margin:auto;padding:32px"><div style="border-top:4px solid ${branding?.primaryColor||'#4F46E5'};background:white;padding:28px;border-radius:8px">${branding?.logoUrl?`<img src="${escapeHtml(branding.logoUrl)}" alt="${escapeHtml(values.organizationName)}" style="max-height:48px">`:''}${content}<hr><small>${escapeHtml(branding?.supportEmail||'')}</small></div></div></body></html>`;
 return {subject:renderTemplateString(base.subject,values),text:renderTemplateString(base.text,values),html};
}
