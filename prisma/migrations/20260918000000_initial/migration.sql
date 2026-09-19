CREATE SCHEMA IF NOT EXISTS "public";
CREATE TYPE "public"."Role" AS ENUM ('ADMIN', 'MANAGER', 'VIEWER');
CREATE TYPE "public"."Priority" AS ENUM ('NORMAL', 'IMPORTANT', 'URGENT');
CREATE TYPE "public"."Status" AS ENUM ('TODO', 'IN_PROGRESS', 'WAITING', 'COMPLETED', 'CANCELLED');

CREATE TABLE "public"."User" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "passwordHash" TEXT NOT NULL,
  "role" "public"."Role" NOT NULL DEFAULT 'VIEWER',
  "color" TEXT NOT NULL DEFAULT '#176b45',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "public"."DeadLine" (
  "id" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT NOT NULL DEFAULT '',
  "dueDate" TIMESTAMP(3) NOT NULL,
  "dueTime" TEXT,
  "priority" "public"."Priority" NOT NULL DEFAULT 'NORMAL',
  "status" "public"."Status" NOT NULL DEFAULT 'TODO',
  "category" TEXT NOT NULL,
  "assigneeId" TEXT NOT NULL,
  "notifyIds" TEXT[],
  "recurrence" TEXT NOT NULL DEFAULT 'NONE',
  "reminders" INTEGER[],
  "notes" TEXT NOT NULL DEFAULT '',
  "waitingFor" TEXT NOT NULL DEFAULT '',
  "requireRead" BOOLEAN NOT NULL DEFAULT false,
  "checklist" JSONB NOT NULL DEFAULT '[]',
  "links" TEXT[],
  "takenAt" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),
  "deletedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "DeadLine_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "public"."AuditLog" (
  "id" TEXT NOT NULL,
  "deadlineId" TEXT NOT NULL,
  "actorId" TEXT,
  "action" TEXT NOT NULL,
  "detail" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "public"."PushSubscription" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "endpoint" TEXT NOT NULL,
  "p256dh" TEXT NOT NULL,
  "auth" TEXT NOT NULL,
  "enabled" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PushSubscription_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "public"."NotificationLog" (
  "id" TEXT NOT NULL,
  "userId" TEXT,
  "deadlineId" TEXT,
  "channel" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "message" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "NotificationLog_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "User_email_key" ON "public"."User"("email");
CREATE UNIQUE INDEX "PushSubscription_endpoint_key" ON "public"."PushSubscription"("endpoint");
ALTER TABLE "public"."DeadLine" ADD CONSTRAINT "DeadLine_assigneeId_fkey" FOREIGN KEY ("assigneeId") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "public"."AuditLog" ADD CONSTRAINT "AuditLog_deadlineId_fkey" FOREIGN KEY ("deadlineId") REFERENCES "public"."DeadLine"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "public"."AuditLog" ADD CONSTRAINT "AuditLog_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
