import { readFile } from "node:fs/promises";
import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";
import { readDb, updateDb } from "../lib/store";
import { can } from "../lib/permissions";
import { createDeadline, createFields, updateDeadline, updateFields, unresolvedDependencies, type CreateInput, type UpdateInput } from "../lib/services/deadlines";
import { recurrenceRule } from "../lib/deadline";
import type { Database, Deadline, User } from "../types";

const [command,...argv]=process.argv.slice(2);
const flags=new Map<string,string|boolean>();const positional:string[]=[];
for(let i=0;i<argv.length;i++){const x=argv[i];if(x.startsWith("--")){const [name,inline]=x.slice(2).split("=",2);flags.set(name,inline??(argv[i+1]&&!argv[i+1].startsWith("--")?argv[++i]:true))}else positional.push(x)}
const has=(key:string)=>flags.has(key);const value=(key:string)=>{const v=flags.get(key);return typeof v==="string"?v:undefined};
const required=(key:string)=>{const v=value(key);if(!v)throw new Error(`Manca --${key}`);return v};
const norm=(s:string)=>s.trim().replace(/\s+/g," ").toLocaleLowerCase("it");
function user(db:Database,name:string){const matches=db.users.filter(u=>u.active&&(u.id===name||norm(u.name)===norm(name)));if(!matches.length)throw new Error(`Utente inesistente: ${name}`);if(matches.length>1)throw new Error(`Utente ambiguo: ${name}`);return matches[0]}
function actor(db:Database){if(process.env.DATABASE_URL&&!value("actor"))throw new Error("In PostgreSQL --actor è obbligatorio");const u=user(db,value("actor")||"Domenico");if(!can(u,"events.manage"))throw new Error(`Permesso negato: ${u.name}`);return u}
const split=(s:string)=>s.split(",").map(x=>x.trim()).filter(Boolean);
function recurrence(input:Record<string,unknown>){if(input.recurrence&&typeof input.recurrence==="object"){const r=input.recurrence as Record<string,unknown>;input.recurrence=recurrenceRule(Number(r.every),String(r.unit).toUpperCase() as "DAY"|"WEEK"|"MONTH"|"YEAR");input.recurrenceAnchor=r.anchor||"DUE_DATE"}else if(input.recurrence&&typeof input.recurrence==="string")input.recurrence=input.recurrence.toUpperCase();}
function applyDueBy(p:Record<string,unknown>){
  if(p.dueBy===undefined)return;
  const v=String(p.dueBy).trim();

  if(/^\d{2}\/\d{4}$/.test(v)){
    const [m,y]=v.split("/").map(Number);
    if(m<1||m>12)throw new Error("Entro il: mese non valido");
    const last=new Date(Date.UTC(y,m,0)).toISOString().slice(0,10);
    p.datePrecision="MONTH";
    p.dueDate=last;
    p.endDate=last;
    p.startDate=undefined;
  }else if(/^\d{4}$/.test(v)){
    p.datePrecision="YEAR";
    p.dueDate=`${v}-12-31`;
    p.endDate=`${v}-12-31`;
    p.startDate=undefined;
  }else{
    throw new Error('Usa --entro-il MM/YYYY oppure YYYY');
  }

  delete p.dueBy;
}

function normalize(db:Database,raw:Record<string,unknown>){const p={...raw};if(p.assignee!==undefined){p.assigneeId=user(db,String(p.assignee)).id;delete p.assignee}if(p.actor!==undefined)delete p.actor;
  if(p.dateRange&&typeof p.dateRange==="object"){const r=p.dateRange as Record<string,unknown>;p.startDate=r.start;p.endDate=r.end;p.dueDate=r.end;delete p.dateRange}
  applyDueBy(p);
  if(p.endDate&&!p.dueDate)p.dueDate=p.endDate;
  if(p.dependsOn!==undefined){p.dependsOnIds=p.dependsOn;delete p.dependsOn}
  if(p.notify!==undefined){p.notifyIds=p.notify===true?[p.assigneeId]:p.notify===false?[]:(Array.isArray(p.notify)?p.notify:split(String(p.notify))).map(x=>user(db,String(x)).id);delete p.notify}
  if(p.reminders!==undefined&&typeof p.reminders==="string")p.reminders=split(p.reminders).map(Number);
  if(p.workingDayAdjustment==="NEXT")p.workingDayAdjustment="NEXT_WORKDAY";if(p.workingDayAdjustment==="PREVIOUS")p.workingDayAdjustment="PREVIOUS_WORKDAY";
  recurrence(p);return p;
}
function fromFlags(db:Database){const fields:Record<string,string>={titolo:"title",descrizione:"description",data:"dueDate","data-da":"startDate","data-a":"endDate","entro-il":"dueBy",ora:"dueTime",responsabile:"assignee",priorita:"priority",categoria:"category",note:"notes",preavvisi:"reminders",ricorrenza:"recurrence","ricorrenza-da":"recurrenceAnchor","waiting-for":"waitingFor","dipende-da":"dependsOn","giorno-lavorativo":"workingDayAdjustment"};const p:Record<string,unknown>={};for(const [flag,field] of Object.entries(fields))if(value(flag)!==undefined)p[field]=value(flag);applyDueBy(p);if(p.startDate&&p.endDate&&!p.dueDate)p.dueDate=p.endDate;if(p.dependsOn)p.dependsOn=split(String(p.dependsOn));if(has("notify"))p.notify=value("notify")||true;if(has("require-read"))p.requireRead=true;
  if(value("ogni")||value("unita"))p.recurrence=recurrenceRule(Number(required("ogni")),required("unita").toUpperCase() as "DAY"|"WEEK"|"MONTH"|"YEAR");
  return normalize(db,p)}
function issues(error:unknown){if(error&&typeof error==="object"&&"issues" in error)return (error as {issues:{path:(string|number)[];message:string}[]}).issues.map(i=>`${i.path.join(".")}: ${i.message}`).join("; ");return (error as Error).message}
function importErrors(index:number,raw:Record<string,unknown>,error:unknown){const title=String(raw?.title||"(senza titolo)");if(error&&typeof error==="object"&&"issues" in error)return (error as {issues:{path:(string|number)[];message:string}[]}).issues.map(i=>{const field=i.path.join(".")||"item";const fieldValue=i.path.reduce<unknown>((value,key)=>value&&typeof value==="object"?(value as Record<string,unknown>)[String(key)]:undefined,raw);return `${index} | ${title} | ${field} | ${JSON.stringify(fieldValue)??"mancante"} | ${i.message}`});const message=(error as Error).message;const field=message.startsWith("Utente")?"assignee":"item";return [`${index} | ${title} | ${field} | ${JSON.stringify(raw?.[field])??"mancante"} | ${message}`]}
function possibleDuplicate(db:Database,p:{title:string;dueDate:string;assigneeId:string},batch:Deadline[]=[]){return [...db.deadlines,...batch].find(d=>norm(d.title)===norm(p.title)&&d.dueDate===p.dueDate&&d.assigneeId===p.assigneeId&&!d.deletedAt)}
async function confirm(message:string,force=false){if(has("yes")&&!force)return true;const rl=createInterface({input:stdin,output:stdout});try{return norm(await rl.question(`${message} Scrivi CONFERMO: `))==="confermo"}finally{rl.close()}}
async function writeGuard(count:number,massive=false){if(!process.env.DATABASE_URL)return;if(!has("prod"))throw new Error("Database PostgreSQL rilevato: aggiungi --prod per autorizzare la scrittura");if(!await confirm(`PRODUZIONE: ${count} scadenze ${massive?"da importare":"da modificare"}.`,massive))throw new Error("Operazione annullata")}
function print(d:Deadline,db:Database){console.log([d.id,d.startDate?`${d.startDate}–${d.endDate}`:d.dueDate,d.title,db.users.find(u=>u.id===d.assigneeId)?.name||d.assigneeId,d.priority,d.status,d.recurrence,d.waitingFor?`Attesa: ${d.waitingFor}`:"",d.dependsOnIds?.length?`Dipende da: ${d.dependsOnIds.join(",")}`:"",d.archivedAt?"ARCHIVIATA":""].filter(Boolean).join(" | "))}

async function main(){if(!["add","import","list","update","complete","archive","unarchive"].includes(command))throw new Error("Comandi: add, import, list, update, complete, archive, unarchive");const db=await readDb({readOnly:true});if(process.env.DATABASE_URL&&!db.users.length)throw new Error("Nessun utente nel database PostgreSQL: inizializzazione richiesta prima della CLI");
  if(command==="list"){let list=db.deadlines.filter(d=>!d.deletedAt);if(value("responsabile"))list=list.filter(d=>d.assigneeId===user(db,required("responsabile")).id);if(value("da"))list=list.filter(d=>d.dueDate>=required("da"));if(value("a"))list=list.filter(d=>d.dueDate<=required("a"));if(value("stato"))list=list.filter(d=>d.status===value("stato"));if(value("categoria"))list=list.filter(d=>norm(d.category)===norm(required("categoria")));if(value("priorita"))list=list.filter(d=>d.priority===value("priorita"));if(has("waiting"))list=list.filter(d=>Boolean(d.waitingFor)||d.status==="WAITING");if(has("archiviate"))list=list.filter(d=>Boolean(d.archivedAt));else if(has("non-archiviate"))list=list.filter(d=>!d.archivedAt);list.sort((a,b)=>a.dueDate.localeCompare(b.dueDate)).forEach(d=>print(d,db));console.log(`${list.length} scadenze`);return}
  const who=actor(db);
  if(command==="import"){
    const path=positional[0];if(!path)throw new Error("Indica un file JSON");const parsed=JSON.parse(await readFile(path,"utf8"));const rows=Array.isArray(parsed)?parsed:parsed.deadlines;if(!Array.isArray(rows))throw new Error("Il JSON deve contenere un array o {deadlines:[...]}");const errors:string[]=[];const drafts:ReturnType<typeof createFields.parse>[]=[];const simulated:Deadline[]=[];const duplicates:string[]=[];
    for(let i=0;i<rows.length;i++){const raw=rows[i];try{if(!raw||typeof raw!=="object"||Array.isArray(raw))throw new Error("Voce non valida");const p=createFields.parse(normalize(db,raw));const copy:Database={...db,deadlines:[...db.deadlines,...simulated]};const d=createDeadline(copy,p,who,"CLI");const duplicate=possibleDuplicate(db,p,simulated);if(duplicate)duplicates.push(`${i+1}: ${p.title} (${duplicate.id})`);drafts.push(p);simulated.push(d)}catch(e){errors.push(...importErrors(i+1,raw,e))}}
    console.log(`${rows.length} totali; ${drafts.length} valide; ${errors.length} errori; ${duplicates.length} possibili duplicati`);for(const e of errors)console.error(e);for(const d of duplicates)console.warn(`POSSIBILE DUPLICATO ${d}`);
    const counts=new Map<string,number>();for(const p of drafts){const name=db.users.find(u=>u.id===p.assigneeId)?.name||p.assigneeId;counts.set(name,(counts.get(name)||0)+1)}console.log("Responsabili:",Object.fromEntries(counts));console.log("Priorità:",Object.fromEntries(["NORMAL","IMPORTANT","URGENT"].map(x=>[x,drafts.filter(p=>p.priority===x).length])));console.log(`Ricorrenti: ${drafts.filter(p=>p.recurrence!=="NONE").length}; non ricorrenti: ${drafts.filter(p=>p.recurrence==="NONE").length}; dipendenze: ${drafts.filter(p=>p.dependsOnIds?.length).length}; in attesa: ${drafts.filter(p=>p.waitingFor).length}; intervalli: ${drafts.filter(p=>p.startDate).length}`);
    if(errors.length)throw new Error("Import annullato: correggi tutti gli errori");if(has("dry-run")){console.log("Nessuna modifica effettuata.");return}if(duplicates.length&&!await confirm("Possibili duplicati presenti."))throw new Error("Import annullato");await writeGuard(drafts.length,true);await updateDb(current=>{for(const p of drafts)createDeadline(current,p,current.users.find(u=>u.id===who.id)!,"CLI")});console.log(`${drafts.length} scadenze importate`);return;
  }
  if(command==="add"){const p=createFields.parse(fromFlags(db));const copy:Database={...db,deadlines:[...db.deadlines]};createDeadline(copy,p,who,"CLI");const dupe=possibleDuplicate(db,p);if(dupe&&!await confirm(`POSSIBILE DUPLICATO: ${dupe.id}.`))throw new Error("Creazione annullata");await writeGuard(1);const d=await updateDb(current=>createDeadline(current,p,current.users.find(u=>u.id===who.id)!,"CLI"));print(d,db);return}
  const id=required("id");const input:UpdateInput=command==="update"?fromFlags(db):{action:command};if(command==="update"&&has("data")&&!has("data-da")&&!has("data-a")){input.startDate=null;input.endDate=null}if(command==="update"&&Object.keys(input).length===0)throw new Error("Indica almeno un campo da modificare");if(command==="complete"&&unresolvedDependencies(db,db.deadlines.find(d=>d.id===id)??(()=>{throw new Error("NOT_FOUND")})()).length){if(!await confirm("ATTENZIONE: dipendenze non completate."))throw new Error("Operazione annullata");input.confirmDependencies=true}updateFields.parse(input);const copy:Database={...db,deadlines:structuredClone(db.deadlines)};updateDeadline(copy,id,input,who,"CLI");await writeGuard(1);const d=await updateDb(current=>updateDeadline(current,id,input,current.users.find(u=>u.id===who.id)!,"CLI"));print(d,db);
}
main().catch(e=>{let message=issues(e);if((e as Error)?.constructor?.name.startsWith("Prisma")) {
  const pe = e as Error & { code?: string; meta?: unknown };
  message = `Errore PostgreSQL${pe.code ? ` [${pe.code}]` : ""}: ${pe.message}${pe.meta ? ` | ${JSON.stringify(pe.meta)}` : ""}`;
}if(process.env.DATABASE_URL){message=message.replaceAll(process.env.DATABASE_URL,"[DATABASE_URL]").replace(/postgres(?:ql)?:\/\/\S+/g,"[DATABASE_URL]");try{const password=new URL(process.env.DATABASE_URL).password;if(password.length>=3)message=message.replaceAll(password,"[PASSWORD]")}catch{}}console.error(`Errore: ${message}`);process.exitCode=1});
