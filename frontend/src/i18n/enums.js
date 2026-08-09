export const roleLabels = {
  USER: 'Энгийн хэрэглэгч',
  ORG_ADMIN: 'Менежер',
  PRINCIPAL: 'Захирал',
  STAFF: 'Ажилтан',
  INSTRUCTOR: 'Багш',
  STUDENT: 'Сурагч',
  PARENT: 'Эцэг эх',
  FINANCE: 'Санхүү',
};

export const userStatusLabels = {
  INVITED: 'Урьсан',
  ACTIVE: 'Идэвхтэй',
  SUSPENDED: 'Түр хаасан',
  DEACTIVATED: 'Идэвхгүй',
};

export const workflowStatusLabels = {
  DRAFT: 'Ноорог',
  SCHEDULED: 'Товлогдсон',
  PUBLISHED: 'Нийтэлсэн',
  ARCHIVED: 'Архивласан',
  PENDING: 'Хүлээгдэж буй',
  IN_REVIEW: 'Хянагдаж буй',
  APPROVED: 'Батлагдсан',
  REJECTED: 'Татгалзсан',
  CANCELLED: 'Цуцлагдсан',
  COMPLETED: 'Дууссан',
  FAILED: 'Амжилтгүй',
};

export const dayOfWeekLabels = {
  MONDAY: 'Даваа',
  TUESDAY: 'Мягмар',
  WEDNESDAY: 'Лхагва',
  THURSDAY: 'Пүрэв',
  FRIDAY: 'Баасан',
  SATURDAY: 'Бямба',
  SUNDAY: 'Ням',
};

export const paymentStatusLabels = {
  PENDING: 'Хүлээгдэж буй',
  COMPLETED: 'Төлөгдсөн',
  FAILED: 'Амжилтгүй',
  REFUNDED: 'Буцаасан',
  OVERDUE: 'Хугацаа хэтэрсэн',
};

export const notificationTypeLabels = {
  IN_APP: 'Апп дотор',
  EMAIL: 'И-мэйл',
  SMS: 'Мессеж',
  PUSH: 'Push',
};

export const displayEnum = (labels, value) => labels[value] || value || '';
