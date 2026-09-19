ALTER TABLE "User" ADD COLUMN "active" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "User" ADD COLUMN "canManageEvents" BOOLEAN NOT NULL DEFAULT false;

UPDATE "User" SET "canManageEvents" = true WHERE "email" IN (
  'domenico@soagri.local', 'giuseppe@soagri.local', 'flavio@soagri.local', 'flavio.g@soagri.local'
);
UPDATE "User" SET "role" = 'MANAGER' WHERE "email" = 'giuseppe@soagri.local' AND "role" = 'VIEWER';
UPDATE "User" SET "name" = 'Flavio D' WHERE "email" = 'flavio@soagri.local' AND "name" = 'Flavio';

INSERT INTO "User" ("id", "name", "email", "passwordHash", "role", "color", "active", "canManageEvents", "createdAt", "updatedAt")
SELECT md5(random()::text || clock_timestamp()::text), 'Flavio G', 'flavio.g@soagri.local',
       'bootstrap-via-env', 'MANAGER', '#7189a7', true, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
WHERE EXISTS (SELECT 1 FROM "User" WHERE "email" = 'flavio@soagri.local')
  AND NOT EXISTS (SELECT 1 FROM "User" WHERE "email" = 'flavio.g@soagri.local');
