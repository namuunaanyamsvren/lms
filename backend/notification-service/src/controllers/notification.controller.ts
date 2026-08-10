import { Request, Response } from 'express';
import { DeliveryStatus, NotificationType, Prisma, StudentAccessRequestStatus } from '@prisma/client-notification';
import {
  AppError,
  EVENTS,
  EVENT_EXCHANGE,
  getPagination,
  paginatedData,
  publishEvent,
} from '@lms/shared';
import { invalidateUnread, notificationEventSchema, notificationPrisma, unreadCount } from '../services/notification.service';
import { deliverNotification } from '../services/notification.service';
import { recordAuditLog, recordCentralAuditLog } from '../services/audit.service';
import { approveStudentMembership } from '../services/auth-membership.service';
import { createApprovedGuardianLink } from '../services/academic-guardian.service';

const accessRoleLabels: Record<string, string> = {
  STUDENT: 'Сурагч',
  PARENT: 'Эцэг эх / асран хамгаалагч',
  INSTRUCTOR: 'Багш',
  STAFF: 'Ажилтан',
};

export const getNotifications = async (req: Request, res: Response) => {
  const unread = req.query.unread === 'true' ? false : undefined;
  const pagination = getPagination(req, { defaultLimit: 20, maxLimit: 100 });
  const where: Prisma.NotificationWhereInput = {
      organizationId: req.organizationId!,
      userId: req.user!.userId,
      ...(unread === false ? { isRead: false } : {}),
      deliveries:{some:{channel: NotificationType.IN_APP, status: DeliveryStatus.DELIVERED}},
      OR:[{expiresAt:null},{expiresAt:{gt:new Date()}}],
    };
  const [notifications, total] = await Promise.all([
    notificationPrisma.notification.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: pagination.skip,
      take: pagination.limit,
    }),
    notificationPrisma.notification.count({ where }),
  ]);
  const withMetadata = notifications.map(n => ({
    ...n,
    metadata: n.metadataJson ? JSON.parse(n.metadataJson) : null,
  }));
  return res.json({ success: true, data: withMetadata, pagination: paginatedData(withMetadata, total, pagination) });
};

export const queueNotification = async (req: Request, res: Response) => {
  const event = notificationEventSchema.parse({
    ...req.body,
    organizationId: req.organizationId!,
  });
  await publishEvent(EVENT_EXCHANGE, EVENTS.NOTIFICATION_SEND, event);
  return res.status(202).json({ success: true, message: 'Notification queued' });
};
export const queueBulkNotifications=async(req:Request,res:Response)=>{
 const {userIds,campaignKey,...message}=req.body;
 for(let i=0;i<userIds.length;i+=100){
  const batch=userIds.slice(i,i+100);
  await Promise.all(batch.map((userId:string)=>publishEvent(EVENT_EXCHANGE,EVENTS.NOTIFICATION_SEND,{...message,organizationId:req.organizationId!,userId,idempotencyKey:`${campaignKey}:${userId}`})));
 }
 res.status(202).json({success:true,data:{queued:userIds.length,campaignKey}});
};

export const requestStudentAccess = async (req: Request, res: Response) => {
  const organizationId = req.body.organizationId || req.organizationId!;
  const requestedRole = req.body.requestedRole || 'STUDENT';
  const guardianLinkCode = requestedRole === 'PARENT' ? req.body.guardianLinkCode || undefined : undefined;
  if (requestedRole === 'PARENT' && !guardianLinkCode) {
    throw AppError.badRequest('Эцэг эхийн хүсэлтэд хүүхдийн холбох код шаардлагатай.');
  }
  const requester = await notificationPrisma.notificationRecipient.findUnique({
    where: { organizationId_userId: { organizationId: req.organizationId!, userId: req.user!.userId } },
  });
  const requesterName = requester?.firstName || requester?.email || 'Шинэ хэрэглэгч';
  const accessRequest = await notificationPrisma.studentAccessRequest.upsert({
    where: { organizationId_requesterUserId: { organizationId, requesterUserId: req.user!.userId } },
    create: {
      organizationId,
      requesterOrganizationId: req.organizationId!,
      requesterUserId: req.user!.userId,
      requesterEmail: requester?.email || undefined,
      requesterName,
      requestedRole,
      guardianLinkCode,
      note: req.body.note || undefined,
    },
    update: {
      requesterOrganizationId: req.organizationId!,
      requesterEmail: requester?.email || undefined,
      requesterName,
      requestedRole,
      guardianLinkCode,
      note: req.body.note || undefined,
      ...(req.body.force === true ? { status: StudentAccessRequestStatus.PENDING, reviewedByUserId: null, reviewerNote: null, reviewedAt: null } : {}),
    },
  });
  if (accessRequest.status !== StudentAccessRequestStatus.PENDING) {
    return res.status(409).json({ success: false, message: 'Энэ сургуулийн хүсэлтийг аль хэдийн шийдвэрлэсэн байна.', data: accessRequest });
  }
  const managers = await notificationPrisma.notificationRecipient.findMany({
    where: { organizationId, role: { in: ['ORG_ADMIN', 'SUPER_ADMIN'] } },
    select: { userId: true, email: true },
  });
  if (managers.length === 0) {
    return res.status(409).json({ success: false, message: 'Энэ сургуульд хүсэлт хүлээн авах менежер олдсонгүй.', data: accessRequest });
  }
  const roleLabel = accessRoleLabels[requestedRole] || requestedRole;
  const guardianNote = guardianLinkCode ? `\nХүүхдийн холбох код: ${guardianLinkCode}` : '';
  const note = req.body.note ? `\n\nТайлбар: ${req.body.note}` : '';
  await Promise.all(managers.map(manager => deliverNotification({
    organizationId,
    userId: manager.userId,
    eventType: 'STUDENT_ACCESS_REQUEST',
    idempotencyKey: `student-access-request:${accessRequest.id}:${manager.userId}`,
    title: `${roleLabel} эрхийн хүсэлт`,
    body: `${requesterName} "${roleLabel}" эрхээр холбогдох хүсэлт илгээв.${guardianNote}${note}\n\nХүсэлтийн самбар: /admin/student-access-requests`,
    channels: ['IN_APP'],
    recipientEmail: manager.email || undefined,
    variables: {
      requestId: accessRequest.id,
      requesterUserId: req.user!.userId,
      requesterEmail: requester?.email || '',
      requesterName,
      requestedRole,
      guardianLinkCode: guardianLinkCode || '',
      actionUrl: '/admin/student-access-requests',
      targetType: 'studentAccessRequest',
      targetId: accessRequest.id,
      note: req.body.note || '',
    },
  })));
  return res.status(202).json({ success: true, data: { request: accessRequest, notified: managers.length } });
};

export const getStudentAccessRequests = async (req: Request, res: Response) => {
  const status = typeof req.query.status === 'string' ? req.query.status : undefined;
  const pagination = getPagination(req, { defaultLimit: 50, maxLimit: 100 });
  const where: Prisma.StudentAccessRequestWhereInput = {
    organizationId: req.organizationId!,
    ...(status && status !== 'ALL' ? { status: status as StudentAccessRequestStatus } : {}),
  };
  const [items, total] = await Promise.all([
    notificationPrisma.studentAccessRequest.findMany({
      where,
      orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
      skip: pagination.skip,
      take: pagination.limit,
    }),
    notificationPrisma.studentAccessRequest.count({ where }),
  ]);
  return res.json({ success: true, data: items, pagination: paginatedData(items, total, pagination) });
};

export const getMyStudentAccessRequests = async (req: Request, res: Response) => {
  const items = await notificationPrisma.studentAccessRequest.findMany({
    where: {
      requesterOrganizationId: req.organizationId!,
      requesterUserId: req.user!.userId,
    },
    orderBy: { createdAt: 'desc' },
  });
  return res.json({ success: true, data: items });
};

export const reviewStudentAccessRequest = async (req: Request, res: Response) => {
  const request = await notificationPrisma.studentAccessRequest.findFirst({
    where: { id: req.params.id, organizationId: req.organizationId! },
  });
  if (!request) throw AppError.notFound('Student access request not found');
  if (request.status !== StudentAccessRequestStatus.PENDING) {
    throw AppError.badRequest('Энэ хүсэлтийг аль хэдийн шийдвэрлэсэн байна.');
  }
  const status = req.body.status as StudentAccessRequestStatus;
  if (status === StudentAccessRequestStatus.APPROVED) {
    if (request.requestedRole === 'PARENT' && !request.guardianLinkCode) {
      throw AppError.badRequest('Эцэг эхийн хүсэлтийг батлахын тулд хүүхдийн холбох код шаардлагатай.');
    }
    await approveStudentMembership({
      organizationId: request.organizationId,
      userId: request.requesterUserId,
      approvedById: req.user!.userId,
      role: request.requestedRole || 'STUDENT',
    });
    if (request.requestedRole === 'PARENT' && request.guardianLinkCode) {
      await createApprovedGuardianLink({
        organizationId: request.organizationId,
        parentUserId: request.requesterUserId,
        guardianLinkCode: request.guardianLinkCode,
        approvedById: req.user!.userId,
      });
    }
  }
  const updated = await notificationPrisma.studentAccessRequest.update({
    where: { id: request.id },
    data: {
      status,
      reviewedByUserId: req.user!.userId,
      reviewerNote: req.body.reviewerNote || null,
      reviewedAt: new Date(),
    },
  });
  const auditInput = {
    organizationId: req.organizationId!,
    userId: req.user!.userId,
    action: status === StudentAccessRequestStatus.APPROVED ? 'STUDENT_ACCESS_REQUEST_APPROVED' : 'STUDENT_ACCESS_REQUEST_REJECTED',
    entity: 'StudentAccessRequest',
    entityId: updated.id,
    details: JSON.stringify({
      requesterUserId: updated.requesterUserId,
      requesterOrganizationId: updated.requesterOrganizationId,
      requestedRole: updated.requestedRole,
      guardianLinkCode: updated.guardianLinkCode,
      status,
      reviewerNote: updated.reviewerNote,
    }),
  };
  await recordAuditLog(auditInput);
  await recordCentralAuditLog({ ...auditInput, ipAddress: req.ip });
  await deliverNotification({
    organizationId: request.requesterOrganizationId,
    userId: request.requesterUserId,
    eventType: 'STUDENT_ACCESS_REQUEST_REVIEWED',
    idempotencyKey: `student-access-request-reviewed:${updated.id}:${status}`,
    title: status === StudentAccessRequestStatus.APPROVED ? `${accessRoleLabels[updated.requestedRole] || updated.requestedRole} эрх батлагдлаа` : `${accessRoleLabels[updated.requestedRole] || updated.requestedRole} эрхийн хүсэлт татгалзлаа`,
    body: status === StudentAccessRequestStatus.APPROVED
      ? `Менежер таны "${accessRoleLabels[updated.requestedRole] || updated.requestedRole}" эрхийг баталгаажууллаа. Дахин нэвтрээд өөрийн хэсэг рүү орно уу.`
      : `Менежер таны "${accessRoleLabels[updated.requestedRole] || updated.requestedRole}" эрхийн хүсэлтийг татгалзлаа.${updated.reviewerNote ? `\n\nТайлбар: ${updated.reviewerNote}` : ''}`,
    channels: ['IN_APP'],
    recipientEmail: request.requesterEmail || undefined,
    variables: {
      requestId: updated.id,
      status,
      actionUrl: '/user',
      targetType: 'studentAccessRequest',
      targetId: updated.id,
    },
  });
  return res.json({ success: true, data: updated });
};

export const markAsRead = async (req: Request, res: Response) => {
  const notification = await notificationPrisma.notification.findFirst({
    where: {
      id: req.params.id,
      organizationId: req.organizationId!,
      userId: req.user!.userId,
    },
  });
  if (!notification) throw AppError.notFound('Notification not found');
  const updated = await notificationPrisma.notification.update({
    where: { id: notification.id },
    data: { isRead: true },
  });
  await invalidateUnread(req.organizationId!,req.user!.userId);
  return res.json({ success: true, data: updated });
};

export const markAllAsRead = async (req: Request, res: Response) => {
  const result = await notificationPrisma.notification.updateMany({
    where: { organizationId: req.organizationId!, userId: req.user!.userId, isRead: false },
    data: { isRead: true },
  });
  await invalidateUnread(req.organizationId!,req.user!.userId);
  return res.json({ success: true, data: { updated: result.count } });
};

export const deleteNotification = async (req: Request, res: Response) => {
  const result = await notificationPrisma.notification.deleteMany({
    where: {
      id: req.params.id,
      organizationId: req.organizationId!,
      userId: req.user!.userId,
    },
  });
  if (!result.count) throw AppError.notFound('Notification not found');
  await invalidateUnread(req.organizationId!,req.user!.userId);
  return res.status(204).send();
};

export const clearNotifications = async (req: Request, res: Response) => {
  await notificationPrisma.notification.deleteMany({
    where: { organizationId: req.organizationId!, userId: req.user!.userId },
  });
  await invalidateUnread(req.organizationId!,req.user!.userId);
  return res.status(204).send();
};

export const getUnreadCount=async(req:Request,res:Response)=>res.json({success:true,data:{count:await unreadCount(req.organizationId!,req.user!.userId)}});
export const getPreferences=async(req:Request,res:Response)=>{
 const data=await notificationPrisma.notificationPreference.upsert({where:{organizationId_userId:{organizationId:req.organizationId!,userId:req.user!.userId}},create:{organizationId:req.organizationId!,userId:req.user!.userId},update:{},include:{eventPreferences:true}});
 res.json({success:true,data});
};
export const updatePreferences=async(req:Request,res:Response)=>{
 const {events=[],...data}=req.body;const pref=await notificationPrisma.notificationPreference.upsert({where:{organizationId_userId:{organizationId:req.organizationId!,userId:req.user!.userId}},create:{organizationId:req.organizationId!,userId:req.user!.userId,...data},update:data});
 await notificationPrisma.$transaction(events.map((e:any)=>notificationPrisma.notificationEventPreference.upsert({where:{organizationId_preferenceId_eventType:{organizationId:req.organizationId!,preferenceId:pref.id,eventType:e.eventType}},create:{organizationId:req.organizationId!,preferenceId:pref.id,...e},update:e})));
 res.json({success:true,data:await notificationPrisma.notificationPreference.findUnique({where:{id:pref.id},include:{eventPreferences:true}})});
};
export const subscribePush=async(req:Request,res:Response)=>res.status(201).json({success:true,data:await notificationPrisma.pushSubscription.upsert({where:{organizationId_userId_endpoint:{organizationId:req.organizationId!,userId:req.user!.userId,endpoint:req.body.endpoint}},create:{organizationId:req.organizationId!,userId:req.user!.userId,...req.body},update:{p256dh:req.body.p256dh,auth:req.body.auth,userAgent:req.headers['user-agent']}})});
export const unsubscribePush=async(req:Request,res:Response)=>{await notificationPrisma.pushSubscription.deleteMany({where:{organizationId:req.organizationId!,userId:req.user!.userId,endpoint:req.body.endpoint}});res.status(204).send();};
export const upsertTemplate=async(req:Request,res:Response)=>res.json({success:true,data:await notificationPrisma.notificationTemplate.upsert({where:{organizationId_eventType_locale:{organizationId:req.organizationId!,eventType:req.params.eventType,locale:req.body.locale}},create:{organizationId:req.organizationId!,eventType:req.params.eventType,...req.body},update:req.body})});
export const updateBranding=async(req:Request,res:Response)=>res.json({success:true,data:await notificationPrisma.notificationBranding.upsert({where:{organizationId:req.organizationId!},create:{organizationId:req.organizationId!,...req.body},update:req.body})});
export const getAuditLogs = async (req: Request, res: Response) => {
  const data = await notificationPrisma.auditLog.findMany({
    where: { organizationId: req.organizationId! },
    orderBy: { createdAt: 'desc' },
    take: 200,
  });
  return res.json({ success: true, data });
};

export const providerWebhook=async(req:Request,res:Response)=>{
 const {providerEventId,providerMessageId,type}=req.body;const event=await notificationPrisma.providerEvent.upsert({where:{provider_providerEventId:{provider:req.params.provider,providerEventId}},create:{provider:req.params.provider,providerEventId,providerMessageId,type,payloadJson:JSON.stringify(req.body)},update:{}});
 const status=type==='bounce'?'BOUNCED':type==='complaint'?'COMPLAINED':type==='delivery'?'DELIVERED':undefined;
 if(status&&providerMessageId)await notificationPrisma.notificationDelivery.updateMany({where:{providerMessageId,provider:req.params.provider},data:{status,deliveredAt:status==='DELIVERED'?new Date():undefined}});
 res.status(202).json({success:true,data:{id:event.id}});
};
