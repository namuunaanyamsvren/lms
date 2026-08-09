-- AlterTable
ALTER TABLE "Attendance" ADD COLUMN     "note" TEXT,
ADD COLUMN     "scheduleId" TEXT,
ALTER COLUMN "date" SET DATA TYPE DATE;

-- CreateTable
CREATE TABLE "AttendanceHistory" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "attendanceId" TEXT NOT NULL,
    "changedByUserId" TEXT NOT NULL,
    "previousStatus" "AttendanceStatus",
    "newStatus" "AttendanceStatus" NOT NULL,
    "reason" TEXT,
    "changedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AttendanceHistory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AttendanceHistory_organizationId_idx" ON "AttendanceHistory"("organizationId");

-- CreateIndex
CREATE INDEX "AttendanceHistory_attendanceId_idx" ON "AttendanceHistory"("attendanceId");

-- CreateIndex
CREATE INDEX "Attendance_scheduleId_idx" ON "Attendance"("scheduleId");

-- CreateIndex
CREATE UNIQUE INDEX "Attendance_organizationId_cohortId_studentId_date_key" ON "Attendance"("organizationId", "cohortId", "studentId", "date");

-- AddForeignKey
ALTER TABLE "Attendance" ADD CONSTRAINT "Attendance_scheduleId_fkey" FOREIGN KEY ("scheduleId") REFERENCES "Schedule"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttendanceHistory" ADD CONSTRAINT "AttendanceHistory_attendanceId_fkey" FOREIGN KEY ("attendanceId") REFERENCES "Attendance"("id") ON DELETE CASCADE ON UPDATE CASCADE;
