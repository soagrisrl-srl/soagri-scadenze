import { promises as fs } from "fs";
import path from "path";
import type { Database, User } from "@/types";
import { createSeed } from "./seed";
import { CATEGORIES } from "./constants";

const file = process.env.LOCAL_DB_PATH || path.join(process.cwd(), "data", "local-db.json");
let queue = Promise.resolve();

function upgradeLegacyUsers(db: Database): boolean {
  let changed = false;
  const original = db.users.find(u => u.email === "flavio@soagri.local");
  if (original?.name === "Flavio") { original.name = "Flavio D"; changed = true; }
  for (const user of db.users) {
    if (user.active === undefined) { user.active = true; changed = true; }
    if (user.canManageEvents === undefined) {
      user.canManageEvents = ["domenico@soagri.local", "giuseppe@soagri.local", "flavio@soagri.local", "flavio.g@soagri.local"].includes(user.email)
        || user.role === "ADMIN" || user.role === "MANAGER";
      changed = true;
      if (user.email === "giuseppe@soagri.local" && user.role === "VIEWER") user.role = "MANAGER";
    }
  }
  if (!db.users.some(u => u.email === "flavio.g@soagri.local")) {
    const flavioG = createSeed().users.find(u => u.id === "u4")!;
    db.users.push(db.users.some(u => u.id === flavioG.id) ? {...flavioG, id: crypto.randomUUID()} : flavioG);
    changed = true;
  }
  return changed;
}

async function readLocal(readOnly=false): Promise<Database> {
  try {
    const db = JSON.parse(await fs.readFile(/* turbopackIgnore: true */ file, "utf8")) as Database;
    if (upgradeLegacyUsers(db) && !readOnly) await fs.writeFile(file, JSON.stringify(db, null, 2));
    return db;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    const db = createSeed();
    if(!readOnly){await fs.mkdir(path.dirname(file), {recursive: true});await fs.writeFile(file, JSON.stringify(db, null, 2))}
    return db;
  }
}

async function readPostgres(readOnly=false): Promise<Database> {
  const {prisma} = await import("./prisma");
  let users = await prisma.user.findMany();
  if (!users.length && !readOnly) {
    for (const user of createSeed().users) {
      await prisma.user.create({data: {...user, passwordHash: "bootstrap-via-env"}});
    }
    users = await prisma.user.findMany();
  }
  const deadlines = await prisma.deadLine.findMany({include: {auditLogs: {include: {actor: true}, orderBy: {createdAt: "desc"}}}});
  const logs = await prisma.notificationLog.findMany({orderBy: {createdAt: "desc"}, take: 100});
  const archiveSetting = await prisma.appSetting.findUnique({where:{key:"archiveAfterDays"}});
  return {
    users: users.map(u => ({id:u.id,name:u.name,email:u.email,role:u.role,color:u.color,active:u.active,canManageEvents:u.canManageEvents,passwordHash:u.passwordHash})),
    categories: CATEGORIES,
    archiveAfterDays: archiveSetting ? Number(archiveSetting.value) : 30,
    notificationLog: logs.map(x => ({id:x.id,message:x.message,at:x.createdAt.toISOString()})),
    deadlines: deadlines.map(x => ({
      id:x.id,title:x.title,description:x.description,dueDate:x.dueDate.toISOString().slice(0,10),
      startDate:x.startDate?.toISOString().slice(0,10),endDate:x.endDate?.toISOString().slice(0,10),datePrecision:(x.datePrecision as "DAY"|"MONTH"|"YEAR")||"DAY",
      dueTime:x.dueTime||undefined,priority:x.priority,status:x.status,category:x.category,
      assigneeId:x.assigneeId,notifyIds:x.notifyIds,recurrence:x.recurrence,reminders:x.reminders,
      recurrenceAnchor:x.recurrenceAnchor as Database["deadlines"][number]["recurrenceAnchor"],workingDayAdjustment:x.workingDayAdjustment as Database["deadlines"][number]["workingDayAdjustment"],dependsOnIds:x.dependsOnIds,
      notes:x.notes,waitingFor:x.waitingFor,requireRead:x.requireRead,
      checklist:x.checklist as unknown as Database["deadlines"][number]["checklist"],links:x.links,
      takenAt:x.takenAt?.toISOString(),completedAt:x.completedAt?.toISOString(),
      deletedAt:x.deletedAt?.toISOString(),createdAt:x.createdAt.toISOString(),
      archivedAt:x.archivedAt?.toISOString(),archiveExempt:x.archiveExempt,
      updatedAt:x.updatedAt.toISOString(),
      audits:x.auditLogs.map(a => ({id:a.id,at:a.createdAt.toISOString(),actor:a.actor?.name||"Sistema",action:a.action,detail:a.detail||undefined}))
    }))
  };
}

export async function readDb(options:{readOnly?:boolean}={}): Promise<Database> {
  const db=process.env.DATABASE_URL ? await readPostgres(options.readOnly) : await readLocal(options.readOnly);
  applyAutoArchive(db);
  return db;
}

export function applyAutoArchive(db:Database,now=new Date()){
  const days=db.archiveAfterDays===undefined?30:db.archiveAfterDays;
  if(days<0)return;
  for(const d of db.deadlines)if(d.status==="COMPLETED"&&d.completedAt&&!d.archivedAt&&!d.archiveExempt&&now.getTime()-new Date(d.completedAt).getTime()>=days*86400000)d.archivedAt=now.toISOString();
}

async function persistPostgres(db: Database) {
  const {prisma} = await import("./prisma");
  await prisma.$transaction(async tx => {
    await tx.appSetting.upsert({where:{key:"archiveAfterDays"},update:{value:String(db.archiveAfterDays??30)},create:{key:"archiveAfterDays",value:String(db.archiveAfterDays??30)}});
    for (const u of db.users) {
      await tx.user.upsert({
        where: {id:u.id},
        update: {name:u.name,email:u.email,role:u.role,color:u.color,active:u.active,canManageEvents:u.canManageEvents,passwordHash:u.passwordHash||"bootstrap-via-env"},
        create: {...u,passwordHash:u.passwordHash||"bootstrap-via-env"}
      });
    }
    for (const d of db.deadlines) {
      const fields = {
        title:d.title,description:d.description,dueDate:new Date(`${d.dueDate}T12:00:00Z`),
        startDate:d.startDate?new Date(`${d.startDate}T12:00:00Z`):null,endDate:d.endDate?new Date(`${d.endDate}T12:00:00Z`):null,datePrecision:d.datePrecision||"DAY",
        dueTime:d.dueTime,priority:d.priority,status:d.status,category:d.category,
        assigneeId:d.assigneeId,notifyIds:d.notifyIds,recurrence:d.recurrence,reminders:d.reminders,
        recurrenceAnchor:d.recurrenceAnchor||"DUE_DATE",workingDayAdjustment:d.workingDayAdjustment||"NONE",dependsOnIds:d.dependsOnIds||[],
        notes:d.notes,waitingFor:d.waitingFor,requireRead:d.requireRead,checklist:d.checklist,
        links:d.links,takenAt:d.takenAt?new Date(d.takenAt):null,
        completedAt:d.completedAt?new Date(d.completedAt):null,
        deletedAt:d.deletedAt?new Date(d.deletedAt):null,archivedAt:d.archivedAt?new Date(d.archivedAt):null,archiveExempt:d.archiveExempt||false
      };
      await tx.deadLine.upsert({where:{id:d.id},update:fields,create:{id:d.id,...fields}});
      for (const a of d.audits) {
        await tx.auditLog.upsert({
          where:{id:a.id},update:{action:a.action,detail:a.detail},
          create:{id:a.id,deadlineId:d.id,actorId:db.users.find(u=>u.name===a.actor)?.id,action:a.action,detail:a.detail,createdAt:new Date(a.at)}
        });
      }
    }
  }, { maxWait: 10000, timeout: 120000 });
}

export async function updateDb<T>(fn: (db: Database) => T | Promise<T>): Promise<T> {
  let result!: T;
  const operation = queue.then(async () => {
    const db = await readDb();
    result = await fn(db);
    if (process.env.DATABASE_URL) await persistPostgres(db);
    else await fs.writeFile(file, JSON.stringify(db, null, 2));
  });
  queue = operation.catch(() => undefined);
  await operation;
  return result;
}

export function publicUser(user: User): Omit<User,"passwordHash"> {
  const {passwordHash: _, ...safe} = user;
  void _;
  return safe;
}
