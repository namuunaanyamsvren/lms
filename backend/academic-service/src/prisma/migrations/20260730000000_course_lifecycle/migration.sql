CREATE TYPE "CourseStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');
CREATE TYPE "CourseCompletionRule" AS ENUM ('ALL_LESSONS', 'PERCENTAGE');
CREATE TYPE "CourseInstructorRole" AS ENUM ('OWNER', 'CO_TEACHER');
CREATE TYPE "LessonContentType" AS ENUM ('RICH_TEXT', 'VIDEO', 'EXTERNAL_LINK');

ALTER TABLE "Course"
  ADD COLUMN "code" TEXT,
  ADD COLUMN "credits" DOUBLE PRECISION NOT NULL DEFAULT 0,
  ADD COLUMN "level" TEXT,
  ADD COLUMN "capacity" INTEGER,
  ADD COLUMN "departmentId" TEXT,
  ADD COLUMN "programId" TEXT,
  ADD COLUMN "prerequisiteText" TEXT,
  ADD COLUMN "coverImageUrl" TEXT,
  ADD COLUMN "status" "CourseStatus" NOT NULL DEFAULT 'DRAFT',
  ADD COLUMN "completionRule" "CourseCompletionRule" NOT NULL DEFAULT 'ALL_LESSONS',
  ADD COLUMN "completionPercentage" INTEGER NOT NULL DEFAULT 100,
  ADD COLUMN "publishedAt" TIMESTAMP(3),
  ADD COLUMN "archivedAt" TIMESTAMP(3);
UPDATE "Course" SET "code" = 'COURSE-' || UPPER(SUBSTRING(REPLACE("id", '-', ''), 1, 8)),
  "status" = CASE WHEN "isPublished" THEN 'PUBLISHED'::"CourseStatus" ELSE 'DRAFT'::"CourseStatus" END;
ALTER TABLE "Course" ALTER COLUMN "code" SET NOT NULL;
ALTER TABLE "Course" DROP COLUMN "isPublished";

ALTER TABLE "Lesson"
  ADD COLUMN "contentType" "LessonContentType" NOT NULL DEFAULT 'RICH_TEXT',
  ADD COLUMN "externalUrl" TEXT,
  ADD COLUMN "releaseAt" TIMESTAMP(3);

CREATE TABLE "CourseInstructor" (
  "id" TEXT NOT NULL, "organizationId" TEXT NOT NULL, "courseId" TEXT NOT NULL,
  "userId" TEXT NOT NULL, "role" "CourseInstructorRole" NOT NULL DEFAULT 'CO_TEACHER',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CourseInstructor_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "CoursePrerequisite" (
  "id" TEXT NOT NULL, "organizationId" TEXT NOT NULL, "courseId" TEXT NOT NULL,
  "prerequisiteCourseId" TEXT NOT NULL, CONSTRAINT "CoursePrerequisite_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "LessonAttachment" (
  "id" TEXT NOT NULL, "organizationId" TEXT NOT NULL, "lessonId" TEXT NOT NULL,
  "name" TEXT NOT NULL, "fileUrl" TEXT NOT NULL, "mimeType" TEXT, "size" INTEGER,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "LessonAttachment_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "LessonProgress" (
  "id" TEXT NOT NULL, "organizationId" TEXT NOT NULL, "lessonId" TEXT NOT NULL,
  "userId" TEXT NOT NULL, "completedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "LessonProgress_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Course_organizationId_code_key" ON "Course"("organizationId", "code");
CREATE INDEX "Course_organizationId_status_idx" ON "Course"("organizationId", "status");
CREATE INDEX "Course_organizationId_departmentId_idx" ON "Course"("organizationId", "departmentId");
CREATE INDEX "Course_organizationId_programId_idx" ON "Course"("organizationId", "programId");
CREATE INDEX "Course_instructorId_idx" ON "Course"("instructorId");
CREATE UNIQUE INDEX "CourseInstructor_organizationId_courseId_userId_key" ON "CourseInstructor"("organizationId", "courseId", "userId");
CREATE INDEX "CourseInstructor_organizationId_userId_idx" ON "CourseInstructor"("organizationId", "userId");
CREATE UNIQUE INDEX "CoursePrerequisite_organizationId_courseId_prerequisiteCourseId_key" ON "CoursePrerequisite"("organizationId", "courseId", "prerequisiteCourseId");
CREATE INDEX "LessonAttachment_organizationId_lessonId_idx" ON "LessonAttachment"("organizationId", "lessonId");
CREATE UNIQUE INDEX "LessonProgress_organizationId_lessonId_userId_key" ON "LessonProgress"("organizationId", "lessonId", "userId");
CREATE INDEX "LessonProgress_organizationId_userId_idx" ON "LessonProgress"("organizationId", "userId");
ALTER TABLE "CourseInstructor" ADD CONSTRAINT "CourseInstructor_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CourseInstructor" ADD CONSTRAINT "CourseInstructor_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CoursePrerequisite" ADD CONSTRAINT "CoursePrerequisite_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CoursePrerequisite" ADD CONSTRAINT "CoursePrerequisite_prerequisiteCourseId_fkey" FOREIGN KEY ("prerequisiteCourseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LessonAttachment" ADD CONSTRAINT "LessonAttachment_lessonId_fkey" FOREIGN KEY ("lessonId") REFERENCES "Lesson"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LessonProgress" ADD CONSTRAINT "LessonProgress_lessonId_fkey" FOREIGN KEY ("lessonId") REFERENCES "Lesson"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LessonProgress" ADD CONSTRAINT "LessonProgress_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
