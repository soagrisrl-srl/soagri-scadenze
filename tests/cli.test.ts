import test from "node:test";
import assert from "node:assert/strict";
import { existsSync,mkdtempSync,readFileSync,writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
import { createSeed } from "../lib/seed";

test("CLI: utenti, dry-run, import, duplicati, modifica e completamento",()=>{
  const dir=mkdtempSync(join(tmpdir(),"soagri-cli-")),file=join(dir,"db.json"),importFile=join(dir,"import.json");writeFileSync(file,JSON.stringify(createSeed()));
  const {DATABASE_URL:_,...env}=process.env;void _;
  const run=(args:string[])=>execFileSync(process.execPath,["--import","tsx","scripts/scadenze.ts",...args],{cwd:process.cwd(),env:{...env,LOCAL_DB_PATH:file},encoding:"utf8"});
  for(const name of ["Domenico","Giuseppe","Flavio D","Flavio G"]){run(["add","--titolo",`Test ${name}`,"--data","2026-10-20","--responsabile",`  ${name.toLowerCase()}  `,"--actor","Domenico"]);const db=JSON.parse(readFileSync(file,"utf8"));assert.equal(db.deadlines.at(-1).assigneeId,db.users.find((u:{name:string})=>u.name===name).id)}
  assert.throws(()=>run(["add","--titolo","Test sconosciuto","--data","2026-10-20","--responsabile","Sconosciuto"]));
  const db0=JSON.parse(readFileSync(file,"utf8"));db0.users.push({...db0.users[0],id:"dup",email:"dup@local"});writeFileSync(file,JSON.stringify(db0));assert.throws(()=>run(["add","--titolo","Test ambiguo","--data","2026-10-20","--responsabile","Domenico"]));db0.users.pop();writeFileSync(file,JSON.stringify(db0));
  writeFileSync(importFile,JSON.stringify([{title:"Importata",dueDate:"2026-11-01",assignee:"Giuseppe"}]));const before=readFileSync(file,"utf8");assert.match(run(["import",importFile,"--dry-run"]),/Nessuna modifica effettuata/);assert.equal(readFileSync(file,"utf8"),before);
  const emptyPath=join(dir,"never-created.json");execFileSync(process.execPath,["--import","tsx","scripts/scadenze.ts","import",importFile,"--dry-run"],{cwd:process.cwd(),env:{...env,LOCAL_DB_PATH:emptyPath},encoding:"utf8"});assert.equal(existsSync(emptyPath),false);
  run(["import",importFile]);let db=JSON.parse(readFileSync(file,"utf8"));const id=db.deadlines.at(-1).id;assert.equal(db.deadlines.at(-1).audits[0].detail,"CLI");
  assert.match(run(["import",importFile,"--dry-run"]),/1 possibili duplicati/);
  writeFileSync(importFile,JSON.stringify([{title:"Errata",dueDate:"2026-11-01",assignee:"Nessuno"}]));const afterImport=readFileSync(file,"utf8");assert.throws(()=>run(["import",importFile]));assert.equal(readFileSync(file,"utf8"),afterImport);
  run(["update","--id",id,"--data","2026-11-10"]);run(["complete","--id",id]);db=JSON.parse(readFileSync(file,"utf8"));assert.equal(db.deadlines.find((d:{id:string})=>d.id===id).dueDate,"2026-11-10");assert.equal(db.deadlines.find((d:{id:string})=>d.id===id).status,"COMPLETED");
  run(["archive","--id",id]);assert.match(run(["list","--archiviate"]),/Importata/);run(["unarchive","--id",id]);assert.doesNotMatch(run(["list","--archiviate"]),/Importata/);
  run(["add","--titolo","Aspettando cliente","--data","2026-12-01","--responsabile","Giuseppe","--waiting-for","Cliente"]);assert.match(run(["list","--waiting"]),/Aspettando cliente/);
});
