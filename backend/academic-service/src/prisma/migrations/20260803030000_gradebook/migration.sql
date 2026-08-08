-- CreateEnum
CREATE TYPE "GradeStatus" AS ENUM ('DRAFT', 'PUBLISHED');

-- CreateEnum
CREATE TYPE "GradeSource" AS ENUM ('ASSIGNMENT', 'MANUAL');

-- CreateEnum
CREATE TYPE "GradeAppealStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- AlterTable
ALTER TABLE "Assignment" ADD COLUMN     "categoryId" TEXT;

-- AlterTable
ALTER TABLE "Cohort" ADD COLUMN     "termId" TEXT;

-- AlterTable
-- courseId starts nullable so existing rows can be backfilled below, then is
-- tightened to NOT NULL once every row has a value.
ALTER TABLE "Grade" ADD COLUMN     "categoryId" TEXT,
ADD COLUMN     "courseId" TEXT,
ADD COLUMN     "source" "GradeSource" NOT NULL DEFAULT 'ASSIGNMENT',
ADD COLUMN     "status" "GradeStatus" NOT NULL DEFAULT 'PUBLISHED';

-- AlterTable
ALTER TABLE "Quiz" ADD COLUMN     "categoryId" TEXT;

-- CreateTable
CREATE TABLE "GradeCategory" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "weightPercent" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GradeCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GradeHistory" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "gradeId" TEXT NOT NULL,
    "changedByUserId" TEXT NOT NULL,
    "previousScore" DOUBLE PRECISION,
    "newScore" DOUBLE PRECISION NOT NULL,
    "reason" TEXT,
    "changedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GradeHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GradeAppeal" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "gradeId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "status" "GradeAppealStatus" NOT NULL DEFAULT 'PENDING',
    "resolutionNote" TEXT,
    "resolvedByUserId" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GradeAppeal_pkey" PRIMARY KEY ("id")
);

-- Backfill Grade.courseId from the existing submission -> assignment ->
-- module -> course chain (every pre-existing Grade row has a submissionId).
UPDATE "Grade" g
SET "courseId" = m."courseId"
FROM "Submission" s
JOIN "Assignment" a ON a."id" = s."assignmentId"
JOIN "Module" m ON m."id" = a."moduleId"
WHERE g."submissionId" = s."id" AND g."courseId" IS NULL;

-- AlterTable
ALTER TABLE "Grade" ALTER COLUMN "courseId" SET NOT NULL;

-- CreateIndex
CREATE INDEX "GradeCategory_organizationId_idx" ON "GradeCategory"("organizationId");

-- CreateIndex
CREATE INDEX "GradeCategory_courseId_idx" ON "GradeCategory"("courseId");

-- CreateIndex
CREATE INDEX "GradeHistory_organizationId_idx" ON "GradeHistory"("organizationId");

-- CreateIndex
CREATE INDEX "GradeHistory_gradeId_idx" ON "GradeHistory"("gradeId");

-- CreateIndex
CREATE INDEX "GradeAppeal_organizationId_idx" ON "GradeAppeal"("organizationId");

-- CreateIndex
CREATE INDEX "GradeAppeal_gradeId_idx" ON "GradeAppeal"("gradeId");

-- CreateIndex
CREATE INDEX "GradeAppeal_studentId_idx" ON "GradeAppeal"("studentId");

-- CreateIndex
CREATE INDEX "GradeAppeal_organizationId_status_idx" ON "GradeAppeal"("organizationId", "status");

-- CreateIndex
CREATE INDEX "Assignment_categoryId_idx" ON "Assignment"("categoryId");

-- CreateIndex
CREATE INDEX "Cohort_termId_idx" ON "Cohort"("termId");

-- CreateIndex
CREATE INDEX "Grade_courseId_idx" ON "Grade"("courseId");

-- CreateIndex
CREATE INDEX "Grade_categoryId_idx" ON "Grade"("categoryId");

-- CreateIndex
CREATE INDEX "Grade_organizationId_status_idx" ON "Grade"("organizationId", "status");

-- CreateIndex
CREATE INDEX "Quiz_categoryId_idx" ON "Quiz"("categoryId");

-- AddForeignKey
ALTER TABLE "Cohort" ADD CONSTRAINT "Cohort_termId_fkey" FOREIGN KEY ("termId") REFERENCES "AcademicTerm"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Assignment" ADD CONSTRAINT "Assignment_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "GradeCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Quiz" ADD CONSTRAINT "Quiz_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "GradeCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Grade" ADD CONSTRAINT "Grade_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Grade" ADD CONSTRAINT "Grade_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "GradeCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GradeCategory" ADD CONSTRAINT "GradeCategory_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GradeHistory" ADD CONSTRAINT "GradeHistory_gradeId_fkey" FOREIGN KEY ("gradeId") REFERENCES "Grade"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GradeAppeal" ADD CONSTRAINT "GradeAppeal_gradeId_fkey" FOREIGN KEY ("gradeId") REFERENCES "Grade"("id") ON DELETE CASCADE ON UPDATE CASCADE;
