import { Request, Response } from 'express';
import { AppError, serviceAuthorizationHeaders } from '@lms/shared';
import { onboardOrganization, organizationPrisma } from '../services/onboarding.service';
import { createHash, randomBytes } from 'node:crypto';
import { resolveTxt } from 'node:dns/promises';

const normalizeHost=(value:string)=>value.trim().toLowerCase().replace(/^https?:\/\//,'').split('/')[0].split(':')[0].replace(/\.$/,'');
const demoTenant = {
  id: 'org_main',
  name: 'Монгол Эрдэм Их Сургууль',
  slug: 'mongol-erdem',
  domain: 'lms.mn',
  logoUrl: null,
  faviconUrl: null,
  primaryColor: '#8651ae',
  locale: 'mn-MN',
  allowRegister: true,
};

export const resolveTenant = async (req: Request, res: Response) => {
  const key=normalizeHost(String(req.query.host||req.query.slug||''));
  if(!key)throw AppError.badRequest('host or slug is required');
  const baseDomain=normalizeHost(process.env.TENANT_BASE_DOMAIN||'localhost');
  const subdomain=key.endsWith(`.${baseDomain}`)?key.slice(0,-(baseDomain.length+1)):key;
  const organization=await organizationPrisma.organization.findFirst({where:{deletedAt:null,status:'ACTIVE',OR:[{slug:subdomain},{domain:key,domainVerifiedAt:{not:null}}]},include:{settings:true}});
  if (!organization && subdomain === demoTenant.slug && process.env.ENABLE_DEMO_TENANT_FALLBACK === 'true') {
    return res.json({ success: true, data: demoTenant });
  }
  if(!organization)throw AppError.notFound('Organization not found');
  return res.json({success:true,data:{id:organization.id,name:organization.name,slug:organization.slug,domain:organization.domain,logoUrl:organization.logoUrl,faviconUrl:organization.faviconUrl,primaryColor:organization.settings?.primaryColor,locale:organization.settings?.locale,allowRegister:organization.settings?.allowRegister}});
};

export const platformDashboard=async(_req:Request,res:Response)=>{const [total,active,suspended,archived,recent]=await Promise.all([organizationPrisma.organization.count(),organizationPrisma.organization.count({where:{status:'ACTIVE',deletedAt:null}}),organizationPrisma.organization.count({where:{status:'SUSPENDED'}}),organizationPrisma.organization.count({where:{status:'ARCHIVED'}}),organizationPrisma.organization.findMany({take:5,orderBy:{createdAt:'desc'},select:{id:true,name:true,slug:true,status:true,createdAt:true}})]);return res.json({success:true,data:{total,active,suspended,archived,recent}});};
export const platformList=async(req:Request,res:Response)=>{const page=Math.max(1,Number(req.query.page)||1),limit=Math.min(100,Math.max(1,Number(req.query.limit)||20));const search=String(req.query.search||'').trim(),status=req.query.status as any;const where:any={...(status?{status}:{}),...(search?{OR:[{name:{contains:search,mode:'insensitive'}},{slug:{contains:search,mode:'insensitive'}},{domain:{contains:search,mode:'insensitive'}}]}:{})};const [items,total]=await Promise.all([organizationPrisma.organization.findMany({where,include:{settings:true},orderBy:{createdAt:'desc'},skip:(page-1)*limit,take:limit}),organizationPrisma.organization.count({where})]);return res.json({success:true,data:{items,total,page,limit}});};
export const publicList=async(req:Request,res:Response)=>{const search=String(req.query.search||'').trim();const where:any={status:'ACTIVE',deletedAt:null,...(search?{OR:[{name:{contains:search,mode:'insensitive'}},{slug:{contains:search,mode:'insensitive'}},{domain:{contains:search,mode:'insensitive'}}]}:{})};const items=await organizationPrisma.organization.findMany({where,select:{id:true,name:true,slug:true,domain:true,logoUrl:true},orderBy:{name:'asc'},take:50});return res.json({success:true,data:items});};
export const platformLifecycle=async(req:Request,res:Response)=>{const status=req.body.status as 'ACTIVE'|'SUSPENDED'|'ARCHIVED';const row=await organizationPrisma.organization.findUnique({where:{id:req.params.id}});if(!row)throw AppError.notFound('Organization not found');const updated=await organizationPrisma.organization.update({where:{id:row.id},data:{status,deletedAt:status==='ARCHIVED'?new Date():null}});return res.json({success:true,data:updated});};

export const requestDomainVerification=async(req:Request,res:Response)=>{const domain=normalizeHost(req.body.domain);const conflict=await organizationPrisma.organization.findFirst({where:{domain,NOT:{id:req.organizationId!}}});if(conflict)throw AppError.conflict('Domain is already in use');const token=`lms-domain-verification=${randomBytes(24).toString('hex')}`;await organizationPrisma.organization.update({where:{id:req.organizationId!},data:{domain,domainVerifiedAt:null,domainVerificationToken:token}});return res.json({success:true,data:{domain,recordType:'TXT',recordName:`_lms.${domain}`,recordValue:token}});};
export const verifyDomain=async(req:Request,res:Response)=>{const org=await organizationPrisma.organization.findUnique({where:{id:req.organizationId!}});if(!org?.domain||!org.domainVerificationToken)throw AppError.badRequest('Domain verification has not been requested');const records=(await resolveTxt(`_lms.${org.domain}`).catch(()=>[])).map(parts=>parts.join(''));if(!records.includes(org.domainVerificationToken))throw AppError.badRequest('Verification TXT record was not found');const updated=await organizationPrisma.organization.update({where:{id:org.id},data:{domainVerifiedAt:new Date(),domainVerificationToken:null}});return res.json({success:true,data:{domain:updated.domain,verifiedAt:updated.domainVerifiedAt}});};

export const onboard = async (req: Request, res: Response) => {
  const organization = await onboardOrganization(req.body);
  return res.status(201).json({
    success: true,
    message: 'Organization onboarding completed',
    data: organization,
  });
};

export const getCurrentOrganization = async (req: Request, res: Response) => {
  const organization = await organizationPrisma.organization.findFirst({
    where: { id: req.organizationId!, deletedAt: null },
    include: { settings: true },
  });
  if (!organization) throw AppError.notFound('Organization not found');
  return res.json({ success: true, data: organization });
};

export const updateCurrentOrganization = async (req: Request, res: Response) => {
  const existing = await organizationPrisma.organization.findFirst({
    where: { id: req.organizationId!, deletedAt: null },
  });
  if (!existing) throw AppError.notFound('Organization not found');
  const data={...req.body,...(req.body.domain!==undefined&&normalizeHost(req.body.domain)!==existing.domain?{domain:normalizeHost(req.body.domain),domainVerifiedAt:null,domainVerificationToken:null}:{})};
  const organization = await organizationPrisma.organization.update({
    where: { id: existing.id },
    data,
    include: { settings: true },
  });
  return res.json({ success: true, data: organization });
};

export const updateSettings = async (req: Request, res: Response) => {
  const { gradingScale,attendanceRule,passwordPolicy,invitationCode,...plain }=req.body;
  const data={...plain,...(gradingScale!==undefined?{gradingScaleJson:JSON.stringify(gradingScale)}:{}),...(attendanceRule!==undefined?{attendanceRuleJson:JSON.stringify(attendanceRule)}:{}),...(passwordPolicy!==undefined?{passwordPolicyJson:JSON.stringify(passwordPolicy)}:{}),...(invitationCode!==undefined?{invitationCodeHash:invitationCode?createHash('sha256').update(invitationCode).digest('hex'):null}:{})};
  const settings = await organizationPrisma.orgSettings.upsert({
    where: { organizationId: req.organizationId! },
    create: { organizationId: req.organizationId!, ...data },
    update: data,
  });
  return res.json({ success: true, data: settings });
};

export const deleteCurrentOrganization = async (req: Request, res: Response) => {
  const targets = [
    `${process.env.AUTH_SERVICE_URL || 'http://localhost:8001'}/internal/organizations/${req.organizationId!}`,
    `${process.env.ACADEMIC_SERVICE_URL || 'http://localhost:8003'}/internal/organizations/${req.organizationId!}`,
    `${process.env.NOTIFICATION_SERVICE_URL || 'http://localhost:8005'}/internal/organizations/${req.organizationId!}`,
  ];
  if (process.env.FEATURE_BILLING_ENABLED === 'true') targets.push(`${process.env.BILLING_SERVICE_URL || 'http://localhost:8004'}/internal/organizations/${req.organizationId!}`);
  const responses = await Promise.all(targets.map(url => fetch(url, {
    method: 'DELETE',
    headers: serviceAuthorizationHeaders('organization-service'),
  })));
  if (responses.some(response => !response.ok)) {
    throw AppError.internal('Organization deprovisioning failed');
  }
  const result = await organizationPrisma.organization.updateMany({
    where: { id: req.organizationId!, deletedAt: null },
    data: { status: 'CANCELLED', deletedAt: new Date() },
  });
  if (!result.count) throw AppError.notFound('Organization not found');
  return res.status(204).send();
};

export const getRegistrationPolicy = async (req: Request, res: Response) => {
  const organization = await organizationPrisma.organization.findFirst({
    where: { id: req.params.id, deletedAt: null },
    include: { settings: true },
  });
  if (!organization) throw AppError.notFound('Organization not found');
  return res.json({
    success: true,
    data: {
      active: organization.status === 'ACTIVE',
      allowRegister: organization.settings?.allowRegister ?? true,
      maxUsers: organization.settings?.maxUsers ?? 100,
      requireEmailVerification: organization.settings?.requireEmailVerification ?? false,
      requirePhoneVerification: organization.settings?.requirePhoneVerification ?? false,
      invitationCodeHash: organization.settings?.invitationCodeHash ?? null,
      allowedEmailDomains: organization.settings?.allowedEmailDomains ?? [],
      passwordPolicy: organization.settings?.passwordPolicyJson ? JSON.parse(organization.settings.passwordPolicyJson) : null,
    },
  });
};

export const getGradingPolicy = async (req: Request, res: Response) => {
  const organization = await organizationPrisma.organization.findFirst({
    where: { id: req.params.id, deletedAt: null },
    include: { settings: true },
  });
  if (!organization) throw AppError.notFound('Organization not found');
  let gradingScale: Record<string, number> = {};
  try {
    gradingScale = organization.settings?.gradingScaleJson ? JSON.parse(organization.settings.gradingScaleJson) : {};
  } catch {
    gradingScale = {};
  }
  return res.json({ success: true, data: { gradingScale } });
};

const DEFAULT_ABSENCE_THRESHOLD = 3;
const DEFAULT_LATE_AFTER_MINUTES = 10;
const DEFAULT_RISK_GRADE_THRESHOLD = 60;
const DEFAULT_RISK_ATTENDANCE_THRESHOLD = 80;

// Pure so it's unit-testable without a DB: turns the free-form attendanceRuleJson
// blob into the typed policy academic-service actually needs, falling back to
// today's hardcoded defaults when unset or malformed so existing behavior doesn't change.
export const parseAttendanceRule = (raw: string | null | undefined): {
  absenceThreshold: number;
  lateAfterMinutes: number;
  riskGradeThreshold: number;
  riskAttendanceThreshold: number;
} => {
  let parsed: {
    absenceThreshold?: unknown;
    lateAfterMinutes?: unknown;
    riskGradeThreshold?: unknown;
    riskAttendanceThreshold?: unknown;
  } = {};
  if (raw) {
    try {
      parsed = JSON.parse(raw);
    } catch {
      parsed = {};
    }
  }
  const absenceThreshold = Number.isInteger(parsed.absenceThreshold) && (parsed.absenceThreshold as number) > 0
    ? (parsed.absenceThreshold as number)
    : DEFAULT_ABSENCE_THRESHOLD;
  const lateAfterMinutes = Number.isInteger(parsed.lateAfterMinutes) && (parsed.lateAfterMinutes as number) >= 0
    ? (parsed.lateAfterMinutes as number)
    : DEFAULT_LATE_AFTER_MINUTES;
  const riskGradeThreshold = Number.isFinite(parsed.riskGradeThreshold) && (parsed.riskGradeThreshold as number) >= 0 && (parsed.riskGradeThreshold as number) <= 100
    ? Number(parsed.riskGradeThreshold)
    : DEFAULT_RISK_GRADE_THRESHOLD;
  const riskAttendanceThreshold = Number.isFinite(parsed.riskAttendanceThreshold) && (parsed.riskAttendanceThreshold as number) >= 0 && (parsed.riskAttendanceThreshold as number) <= 100
    ? Number(parsed.riskAttendanceThreshold)
    : DEFAULT_RISK_ATTENDANCE_THRESHOLD;
  return { absenceThreshold, lateAfterMinutes, riskGradeThreshold, riskAttendanceThreshold };
};

export const getAttendancePolicy = async (req: Request, res: Response) => {
  const organization = await organizationPrisma.organization.findFirst({
    where: { id: req.params.id, deletedAt: null },
    include: { settings: true },
  });
  if (!organization) throw AppError.notFound('Organization not found');
  return res.json({ success: true, data: parseAttendanceRule(organization.settings?.attendanceRuleJson) });
};
