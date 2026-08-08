import { EVENTS } from '@lms/shared';
import { enqueueAcademicEvent } from './event-outbox.service';
import { expireDueAttempts } from './quiz.service';

import { prisma } from '../lib/prisma';

export async function publishDueAssignments(limit = 50) {
  const due = await prisma.assignment.findMany({
    where: { status: 'DRAFT', publishAt: { lte: new Date() }, deletedAt: null },
    take: limit,
  });
  for (const assignment of due) {
    await prisma.$transaction(async (tx) => {
      const row = await tx.assignment.update({
        where: { id: assignment.id },
        data: { status: 'PUBLISHED', publishedAt: new Date(), publishAt: null },
      });
      await enqueueAcademicEvent(tx, EVENTS.ASSIGNMENT_PUBLISHED, row.organizationId, {
        assignmentId: row.id,
        moduleId: row.moduleId,
        title: row.title,
      });
    });
  }
  return due.length;
}

let timer: NodeJS.Timeout | undefined;
export const startAssignmentScheduler = () => {
  timer = setInterval(
    () => Promise.all([publishDueAssignments(),expireDueAttempts()]).catch((e) => console.error('[Academic scheduler]', e)),
    30_000,
  );
  timer.unref();
  void Promise.all([publishDueAssignments(),expireDueAttempts()]);
};
