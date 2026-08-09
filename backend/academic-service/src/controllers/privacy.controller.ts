import { Request, Response } from 'express';

import { prisma } from '../lib/prisma';

export const exportUserAcademicData = async (req: Request, res: Response) => {
  const { organizationId, userId } = req.params;
  const user = await prisma.user.findFirst({
    where: { id: userId, organizationId },
    select: {
      id: true,
      organizationId: true,
      username: true,
      email: true,
      phone: true,
      firstName: true,
      lastName: true,
      role: true,
      isActive: true,
      createdAt: true,
      updatedAt: true,
      enrollments: {
        where: { organizationId },
        select: {
          id: true,
          enrolledAt: true,
          createdAt: true,
          cohort: {
            select: {
              id: true,
              name: true,
              startDate: true,
              endDate: true,
              course: { select: { id: true, code: true, title: true } },
            },
          },
        },
      },
      submissions: {
        where: { organizationId },
        select: {
          id: true,
          content: true,
          fileUrl: true,
          submittedAt: true,
          assignment: { select: { id: true, title: true, dueDate: true } },
        },
      },
      quizAttempts: {
        where: { organizationId },
        select: {
          id: true,
          score: true,
          passed: true,
          status: true,
          attemptNumber: true,
          startedAt: true,
          submittedAt: true,
          gradedAt: true,
          quiz: { select: { id: true, title: true } },
          answers: {
            where: { organizationId },
            select: {
              id: true,
              answerJson: true,
              score: true,
              feedback: true,
              savedAt: true,
              question: { select: { id: true, text: true, type: true } },
            },
          },
        },
      },
      attendances: {
        where: { organizationId },
        select: {
          id: true,
          date: true,
          status: true,
          cohort: { select: { id: true, name: true } },
        },
      },
      grades: {
        where: { organizationId },
        select: { id: true, score: true, feedback: true, gradedAt: true, submissionId: true },
      },
      certificates: {
        where: { organizationId },
        select: {
          id: true,
          verificationCode: true,
          courseTitle: true,
          revokedAt: true,
          issuedAt: true,
          course: { select: { id: true, code: true, title: true } },
        },
      },
      lessonProgress: {
        where: { organizationId },
        select: {
          id: true,
          completedAt: true,
          lesson: { select: { id: true, title: true } },
        },
      },
      documentRequests: {
        where: { organizationId },
        select: { id: true, title: true, status: true, requestedAt: true },
      },
      scholarshipRequests: {
        where: { organizationId },
        select: { id: true, program: true, status: true, requestedAt: true },
      },
      guardianAsParent: {
        where: { organizationId },
        select: { id: true, studentUserId: true, createdAt: true },
      },
      guardianAsStudent: {
        where: { organizationId },
        select: { id: true, parentUserId: true, createdAt: true },
      },
    },
  });
  return res.json({
    success: true,
    data: {
      schemaVersion: '1.0',
      exportedAt: new Date(),
      user,
    },
  });
};
