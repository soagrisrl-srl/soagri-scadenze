import { z } from "zod";
import type { Database, Deadline, User } from "@/types";
import { nextOccurrence, parseRecurrence } from "../deadline";
import { CATEGORIES } from "../constants";

const date=z.iso.date();
const checklist=z.array(z.object({id:z.string(),text:z.string(),done:z.boolean()}));
export const deadlineFields=z.object({
  title:z.string().trim().min(2),description:z.string(),dueDate:date,startDate:date.optional(),endDate:date.optional(),dueTime:z.string().optional(),
  priority:z.enum(["NORMAL","IMPORTANT","URGENT"]),status:z.enum(["TODO","IN_PROGRESS","WAITING","COMPLETED","CANCELLED"]).optional(),
  category:z.string().trim().min(1),assigneeId:z.string(),notifyIds:z.array(z.string()),recurrence:z.string(),
  recurrenceAnchor:z.enum(["DUE_DATE","COMPLETION_DATE"]).optional(),workingDayAdjustment:z.enum(["NONE","PREVIOUS_WORKDAY","NEXT_WORKDAY"]).optional(),
  dependsOnIds:z.array(z.string()).optional(),reminders:z.array(z.number().int().min(0)),notes:z.string(),waitingFor:z.string(),
  requireRead:z.boolean(),checklist,links:z.array(z.string())
}).strict();
export const createFields=deadlineFields.extend({description:z.string().default(""),priority:z.enum(["NORMAL","IMPORTANT","URGENT"]).default("NORMAL"),category:z.string().trim().min(1).default(CATEGORIES[0]),notifyIds:z.array(z.string()).default([]),recurrence:z.string().default("NONE"),reminders:z.array(z.number().int().min(0)).default([1]),notes:z.string().default(""),waitingFor:z.string().default(""),requireRead:z.boolean().default(false),checklist:checklist.default([]),links:z.array(z.string()).default([])});
export const updateFields=deadlineFields.partial().extend({startDate:date.nullable().optional(),endDate:date.nullable().optional(),action:z.enum(["take","complete","delete","restore","postpone","reopen","archive","unarchive"]).optional(),confirmDependencies:z.boolean().optional()}).strict();
export type CreateInput=z.input<typeof createFields>;
export type UpdateInput=z.input<typeof updateFields>;

function validateDates(d:Pick<Deadline,"dueDate"|"startDate"|"endDate">){if(Boolean(d.startDate)!==Boolean(d.endDate)||d.startDate&&d.endDate&&d.startDate>d.endDate||d.endDate&&d.dueDate!==d.endDate)throw new Error("INVALID_DATE_RANGE")}
function validateDependencies(db:Database,id:string,ids:string[]){if(ids.includes(id))throw new Error("SELF_DEPENDENCY");if(ids.some(x=>!db.deadlines.some(d=>d.id===x&&!d.deletedAt)))throw new Error("INVALID_DEPENDENCY");const visit=(node:string,seen:Set<string>):boolean=>{if(node===id)return true;if(seen.has(node))return false;seen.add(node);return (db.deadlines.find(d=>d.id===node)?.dependsOnIds||[]).some(x=>visit(x,seen))};if(ids.some(x=>visit(x,new Set())))throw new Error("CYCLIC_DEPENDENCY")}
function validate(db:Database,d:Deadline){if(!db.users.some(u=>u.id===d.assigneeId&&u.active))throw new Error("INVALID_ASSIGNEE");if(d.recurrence!=="NONE"&&!parseRecurrence(d.recurrence))throw new Error("INVALID_RECURRENCE");validateDates(d);validateDependencies(db,d.id,d.dependsOnIds||[])}
export function unresolvedDependencies(db:Database,d:Deadline){return (d.dependsOnIds||[]).map(id=>db.deadlines.find(x=>x.id===id)).filter((x):x is Deadline=>Boolean(x&&x.status!=="COMPLETED"))}
export function createDeadline(db:Database,input:CreateInput,actor:User,source="WEB"){const p=createFields.parse(input);const now=new Date().toISOString();const d:Deadline={...p,id:crypto.randomUUID(),status:p.status||"TODO",completedAt:p.status==="COMPLETED"?now:undefined,createdAt:now,updatedAt:now,audits:[{id:crypto.randomUUID(),at:now,actor:actor.name,action:"Creazione",detail:source}]};validate(db,d);db.deadlines.push(d);return d}
export function updateDeadline(db:Database,id:string,input:UpdateInput,actor:User,source="WEB"){
  const p=updateFields.parse(input);const d=db.deadlines.find(x=>x.id===id);if(!d)throw new Error("NOT_FOUND");
  const now=new Date().toISOString();const {action,confirmDependencies,...rest}=p;const effectiveAction=action||(p.status==="COMPLETED"&&d.status!=="COMPLETED"?"complete":undefined);
  const next={...d,...rest,startDate:rest.startDate===null?undefined:rest.startDate??d.startDate,endDate:rest.endDate===null?undefined:rest.endDate??d.endDate};validate(db,next);
  if(effectiveAction==="complete"&&unresolvedDependencies(db,next).length&&!confirmDependencies)throw new Error("DEPENDENCIES_INCOMPLETE");
  let audit="Modifica";
  if(action==="take"){next.status="IN_PROGRESS";next.assigneeId=actor.id;next.takenAt=now;audit="Presa in carico"}
  if(effectiveAction==="complete"){next.status="COMPLETED";next.completedAt=now;audit="Completamento";
    if(d.status!=="COMPLETED"){
      const completionDate=new Intl.DateTimeFormat("en-CA",{timeZone:"Europe/Rome",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date(now));
      const anchor=next.recurrenceAnchor==="COMPLETION_DATE"?completionDate:d.dueDate;
      const nextDue=nextOccurrence(anchor,next.recurrence,next.workingDayAdjustment);
      if(nextDue){const shift=new Date(`${nextDue}T12:00:00Z`).getTime()-new Date(`${d.dueDate}T12:00:00Z`).getTime();const shiftDate=(value:string)=>new Date(new Date(`${value}T12:00:00Z`).getTime()+shift).toISOString().slice(0,10);
        db.deadlines.push({...next,id:crypto.randomUUID(),dueDate:nextDue,startDate:next.startDate?shiftDate(next.startDate):undefined,endDate:next.endDate?nextDue:undefined,status:"TODO",completedAt:undefined,takenAt:undefined,archivedAt:undefined,archiveExempt:false,createdAt:now,updatedAt:now,audits:[{id:crypto.randomUUID(),at:now,actor:actor.name,action:"Ricorrenza generata",detail:source}]});
      }
    }
  }
  if(action==="delete"){next.deletedAt=now;audit="Spostamento nel cestino"}
  if(action==="restore"){next.deletedAt=undefined;audit="Ripristino"}
  if(action==="reopen"){next.status="TODO";next.completedAt=undefined;next.archivedAt=undefined;audit="Riapertura"}
  if(action==="postpone")audit="Rimandata";
  if(action==="archive"){next.archivedAt=now;next.archiveExempt=false;audit="Archiviazione"}
  if(action==="unarchive"){next.archivedAt=undefined;next.archiveExempt=true;audit="Ripristino archivio"}
  Object.assign(d,next,{updatedAt:now});d.audits.unshift({id:crypto.randomUUID(),at:now,actor:actor.name,action:audit,detail:source});return d;
}
