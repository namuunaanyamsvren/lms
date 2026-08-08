-- DropForeignKey
ALTER TABLE "_legacy_Invoice_20260730" DROP CONSTRAINT "Invoice_organizationId_fkey";

-- DropForeignKey
ALTER TABLE "_legacy_Notification_20260730" DROP CONSTRAINT "Notification_userId_fkey";

-- DropForeignKey
ALTER TABLE "_legacy_Payment_20260730" DROP CONSTRAINT "Payment_invoiceId_fkey";

-- DropForeignKey
ALTER TABLE "_legacy_Payment_20260730" DROP CONSTRAINT "Payment_organizationId_fkey";

-- DropIndex
DROP INDEX "Course_organizationId_idx";

-- DropIndex
DROP INDEX "User_organizationId_idx";

-- AlterTable
ALTER TABLE "Guardian" ALTER COLUMN "status" SET DEFAULT 'INVITED';

-- AlterTable
-- tags is populated by Prisma Client on every write, not the database.
ALTER TABLE "Question" ALTER COLUMN "tags" DROP DEFAULT;

-- DropTable
-- Completes the two-phase removal started in
-- 20260730100000_soft_delete_and_authoritative_services, which renamed
-- these tables to a _legacy_*_20260730 prefix and stopped writing to them
-- once billing-service/notification-service became authoritative.
DROP TABLE "_legacy_Invoice_20260730";

-- DropTable
DROP TABLE "_legacy_Notification_20260730";

-- DropTable
DROP TABLE "_legacy_Payment_20260730";

-- DropEnum
DROP TYPE "NotificationType";

-- DropEnum
DROP TYPE "PaymentStatus";

-- CreateIndex
CREATE INDEX "AcademicTerm_organizationId_academicYearId_idx" ON "AcademicTerm"("organizationId", "academicYearId");

-- CreateIndex
CREATE INDEX "AcademicYear_organizationId_status_idx" ON "AcademicYear"("organizationId", "status");

-- CreateIndex
CREATE INDEX "Program_organizationId_departmentId_idx" ON "Program"("organizationId", "departmentId");

-- RenameIndex
-- Reconciles index names Postgres silently truncated at the 63-byte
-- identifier limit with the names schema.prisma (and Prisma's own
-- truncation) expects.
ALTER INDEX "AssignmentAttachment_organizationId_assignmentId_fileAssetId_ke" RENAME TO "AssignmentAttachment_organizationId_assignmentId_fileAssetI_key";

-- RenameIndex
ALTER INDEX "CoursePrerequisite_organizationId_courseId_prerequisiteCourseId" RENAME TO "CoursePrerequisite_organizationId_courseId_prerequisiteCour_key";

-- RenameIndex
ALTER INDEX "SubmissionAttachment_organizationId_submissionId_fileAssetId_ke" RENAME TO "SubmissionAttachment_organizationId_submissionId_fileAssetI_key";
