import test from "node:test";
import assert from "node:assert/strict";
import { createSeed } from "../lib/seed";
import { createDeadline,updateDeadline,unresolvedDependencies } from "../lib/services/deadlines";
import { adjustWorkday,nextOccurrence } from "../lib/deadline";
import { applyAutoArchive } from "../lib/store";
import type { Database } from "../types";

const fresh=()=>{const db=createSeed();db.deadlines=[];return db};
const add=(db:Database,title:string,dueDate="2026-09-20",extra:Record<string,unknown>={})=>createDeadline(db,{title,dueDate,assigneeId:"u1",...extra},db.users[0],"CLI");
test("ricorrenze N unità, legacy e date speciali",()=>{
  assert.equal(nextOccurrence("2024-02-29","YEARS:2"),"2026-02-28");
  assert.equal(nextOccurrence("2024-02-29","YEARS:3"),"2027-02-28");
  assert.equal(nextOccurrence("2026-08-31","MONTHS:6"),"2027-02-28");
  assert.equal(nextOccurrence("2026-01-31","MONTHLY"),"2026-02-28");
  assert.equal(nextOccurrence("2024-02-29","YEARLY"),"2025-02-28");
});
test("data prevista e completamento condividono la logica",()=>{
  const db=fresh(),due=add(db,"Prevista","2024-02-29",{recurrence:"YEARS:2"}),completion=add(db,"Completamento","2024-02-29",{recurrence:"YEARS:2",recurrenceAnchor:"COMPLETION_DATE"});
  updateDeadline(db,due.id,{action:"complete"},db.users[0],"CLI");updateDeadline(db,completion.id,{action:"complete"},db.users[0],"CLI");
  assert.equal(db.deadlines.find(d=>d.title==="Prevista"&&d.status==="TODO")?.dueDate,"2026-02-28");
  assert.notEqual(db.deadlines.find(d=>d.title==="Completamento"&&d.status==="TODO")?.dueDate,"2026-02-28");
  assert.equal(db.deadlines.filter(d=>d.title==="Prevista").length,2);
  updateDeadline(db,due.id,{action:"complete"},db.users[0],"CLI");assert.equal(db.deadlines.filter(d=>d.title==="Prevista").length,2);
});
test("dipendenze: valide, auto-relazione, ciclo e conferma",()=>{
  const db=fresh(),a=add(db,"Documento"),b=add(db,"Pratica","2026-09-21",{dependsOnIds:[a.id]});
  assert.equal(unresolvedDependencies(db,b).length,1);
  assert.throws(()=>updateDeadline(db,a.id,{dependsOnIds:[a.id]},db.users[0]),/SELF_DEPENDENCY/);
  assert.throws(()=>updateDeadline(db,a.id,{dependsOnIds:[b.id]},db.users[0]),/CYCLIC_DEPENDENCY/);
  assert.throws(()=>updateDeadline(db,b.id,{action:"complete"},db.users[0]),/DEPENDENCIES_INCOMPLETE/);
  updateDeadline(db,b.id,{action:"complete",confirmDependencies:true},db.users[0],"CLI");assert.equal(b.status,"COMPLETED");assert.equal(b.audits[0].detail,"CLI");
});
test("waiting, periodi e archivio senza cancellazione",()=>{
  const db=fresh();const d=add(db,"Periodo","2026-09-30",{startDate:"2026-09-15",endDate:"2026-09-30",waitingFor:"Studio Inglese",status:"WAITING"});
  assert.equal(d.waitingFor,"Studio Inglese");assert.equal(d.endDate,d.dueDate);
  assert.throws(()=>add(db,"Errato","2026-09-01",{startDate:"2026-09-15",endDate:"2026-09-01"}),/INVALID_DATE_RANGE/);
  d.status="COMPLETED";d.completedAt="2026-09-01T12:00:00.000Z";applyAutoArchive(db,new Date("2026-09-20T12:00:00Z"));assert.equal(d.archivedAt,undefined);
  applyAutoArchive(db,new Date("2026-10-02T12:00:00Z"));assert.ok(d.archivedAt);updateDeadline(db,d.id,{action:"unarchive"},db.users[0]);assert.equal(d.archivedAt,undefined);applyAutoArchive(db,new Date("2026-11-01T12:00:00Z"));assert.equal(d.archivedAt,undefined);assert.equal(db.deadlines.length,1);
});
test("giorni lavorativi e festività italiane",()=>{
  const f=(s:string,r:"NONE"|"PREVIOUS_WORKDAY"|"NEXT_WORKDAY")=>adjustWorkday(new Date(`${s}T12:00:00`),r).toISOString().slice(0,10);
  assert.equal(f("2026-09-19","PREVIOUS_WORKDAY"),"2026-09-18");assert.equal(f("2026-09-19","NEXT_WORKDAY"),"2026-09-21");
  assert.equal(f("2026-09-20","PREVIOUS_WORKDAY"),"2026-09-18");assert.equal(f("2026-09-20","NEXT_WORKDAY"),"2026-09-21");
  assert.equal(f("2026-12-25","NEXT_WORKDAY"),"2026-12-28");assert.equal(f("2026-09-19","NONE"),"2026-09-19");
});
