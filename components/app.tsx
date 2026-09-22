"use client";import { useCallback,useEffect,useMemo,useState } from "react";import { Archive,Bell,BellOff,BellRing,CalendarDays,Clock3,ChevronDown,ChevronRight,LayoutList,Leaf,Menu,Monitor,Plus,Search,Send,Settings,Trash2,X } from "lucide-react";import { addDays,differenceInCalendarDays,format,parseISO,startOfWeek } from "date-fns";import { it } from "date-fns/locale";import type { Database,Deadline } from "@/types";import type { Session } from "@/lib/auth";import { DeadlineCard } from "./deadline-card";import { DeadlineForm } from "./deadline-form";import { CalendarView } from "./calendar-view";import { TvView } from "./tv-view";import { UserAdmin } from "./user-admin";import { can } from "@/lib/permissions";import { categoryStyle } from "@/lib/constants";
type View="today"|"calendar"|"deadlines"|"tv"|"notifications"|"settings"|"trash"|"waiting"|"archive";
const nav=[{id:"today",label:"Oggi",icon:Leaf},{id:"calendar",label:"Calendario",icon:CalendarDays},{id:"deadlines",label:"Scadenze",icon:LayoutList},{id:"waiting",label:"In attesa",icon:Clock3},{id:"archive",label:"Archivio",icon:Archive},{id:"tv",label:"TV",icon:Monitor},{id:"notifications",label:"Notifiche",icon:Bell},{id:"settings",label:"Impostazioni",icon:Settings}] as const;
export function App({session}:{session:Session}){const [db,setDb]=useState<Database|null>(null),[view,setView]=useState<View>("today"),[form,setForm]=useState(false),[edit,setEdit]=useState<Deadline|null>(null),[search,setSearch]=useState(""),[mobile,setMobile]=useState(false),[toast,setToast]=useState("");const load=useCallback(async()=>{const r=await fetch("/api/deadlines");if(r.ok)setDb(await r.json())},[]);useEffect(()=>{load()},[load]);async function act(id:string,body:object){const r=await fetch(`/api/deadlines/${id}`,{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify(body)});if(r.status===409&&confirm("Le scadenze da cui dipende non sono completate. Vuoi completarla comunque?"))return act(id,{...body,confirmDependencies:true});if(!r.ok)throw new Error((await r.json()).error||"Modifica non riuscita");setToast("Modifica salvata");await load();setTimeout(()=>setToast(""),2200)}async function save(d:object){if(edit)await act(edit.id,d);else{const r=await fetch("/api/deadlines",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(d)});if(!r.ok)throw new Error((await r.json()).error||"Creazione non riuscita");setToast("Scadenza creata");await load()}setEdit(null)}if(!db)return <div className="loading"><Leaf/><span>Caricamento scadenze…</span></div>;const operational=db.deadlines.filter(d=>!d.deletedAt&&!d.archivedAt);const active=operational.filter(d=>!["COMPLETED","CANCELLED"].includes(d.status));const canEdit=can(db.users.find(u=>u.id===session.id),"events.manage");const visible=active.filter(d=>[d.title,d.description,d.category,d.notes,d.waitingFor,db.users.find(u=>u.id===d.assigneeId)?.name].join(" ").toLowerCase().includes(search.toLowerCase()));function openEdit(d:Deadline){setEdit(d);setForm(true)}function title(){return nav.find(n=>n.id===view)?.label||"Scadenze"}return <div className={`app-shell ${view==="tv"?"tv-shell":""}`}>{view!=="tv"&&<aside className={mobile?"open":""}><div className="sidebar-brand"><span className="brand-mark"><Leaf/></span><div><b>SO.AGRI</b><small>Scadenze</small></div><button className="mobile-close" onClick={()=>setMobile(false)}><X/></button></div><nav>{nav.map(n=><button key={n.id} className={view===n.id?"active":""} onClick={()=>{setView(n.id);setMobile(false)}}><n.icon/>{n.label}{n.id==="waiting"&&<span className="nav-count">{active.filter(x=>x.waitingFor||x.status==="WAITING").length}</span>}{n.id==="notifications"&&<span className="nav-count">{active.filter(x=>differenceInCalendarDays(parseISO(x.dueDate),new Date())<=3).length}</span>}</button>)}</nav><div className="sidebar-bottom"><button onClick={()=>setView("trash")}><Trash2/>Cestino</button><div className="user"><span>{session.name[0]}</span><div><b>{session.name}</b><small>{session.role==="ADMIN"?"Amministratore":session.role==="MANAGER"?"Gestore":"Visualizzatore"}</small></div></div><button className="logout" onClick={async()=>{await fetch("/api/auth/logout",{method:"POST"});location.reload()}}>Esci</button></div></aside>}{view!=="tv"&&mobile&&<div className="drawer-scrim" onClick={()=>setMobile(false)}/>}<main className={view==="tv"?"tv-main":"workspace"}>{view!=="tv"&&<header className="topbar"><button className="menu-btn" onClick={()=>setMobile(true)}><Menu/></button><div><span className="crumb">SO.AGRI <ChevronRight/> {title()}</span><h1>{view==="today"?`Buongiorno, ${session.name}`:title()}</h1></div><div className="top-actions"><div className="search"><Search/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Cerca scadenze…"/></div><button className="icon-btn bell" onClick={()=>setView("notifications")}><Bell/></button>{canEdit&&<button className="primary" onClick={()=>{setEdit(null);setForm(true)}}><Plus/>Nuova scadenza</button>}</div></header>}{view==="today"&&<Today items={visible} db={db} canEdit={canEdit} act={act} edit={openEdit} onSeeAll={()=>setView("deadlines")}/>} {view==="calendar"&&<CalendarView items={visible} users={db.users} canEdit={canEdit} onAction={act} onEdit={openEdit}/>} {view==="deadlines"&&<AllDeadlines items={operational.filter(d=>[d.title,d.description,d.category,d.notes,d.waitingFor].join(" ").toLowerCase().includes(search.toLowerCase()))} db={db} canEdit={canEdit} act={act} edit={openEdit}/>} {view==="tv"&&<TvView items={active} users={db.users} onExit={()=>setView("today")}/>} {view==="notifications"&&<Notifications items={active} db={db} session={session}/>} {view==="waiting"&&<AllDeadlines items={visible.filter(x=>x.waitingFor||x.status==="WAITING")} db={db} canEdit={canEdit} act={act} edit={openEdit}/>} {view==="archive"&&<ArchiveView items={db.deadlines.filter(x=>x.archivedAt&&!x.deletedAt)} db={db} act={act} canEdit={canEdit}/>} {view==="settings"&&<SettingsView db={db} reload={load} canEdit={session.role==="ADMIN"}/>} {view==="trash"&&<Trash items={db.deadlines.filter(d=>d.deletedAt)} db={db} act={act}/>}</main>{view!=="tv"&&<div className="mobile-nav">{nav.slice(0,4).map(n=><button key={n.id} className={view===n.id?"active":""} onClick={()=>setView(n.id)}><n.icon/><span>{n.label}</span></button>)}{canEdit&&<button className="mobile-add" onClick={()=>{setEdit(null);setForm(true)}}><Plus/></button>}</div>}<DeadlineForm open={form} onClose={()=>{setForm(false);setEdit(null)}} onSave={save} users={db.users} categories={db.categories} deadlines={db.deadlines} item={edit}/>{toast&&<div className="toast">{toast}</div>}</div>}
function Today({items,db,canEdit,act,edit,onSeeAll}:{items:Deadline[];db:Database;canEdit:boolean;act:(id:string,b:object)=>void;edit:(d:Deadline)=>void;onSeeAll:()=>void}){
const days=(d:Deadline)=>differenceInCalendarDays(parseISO(d.dueDate),new Date());
const sections=[
{title:"Richiede attenzione",sub:"Scadute, urgenti e prossime alla scadenza",items:items.filter(x=>days(x)<0||x.priority==="URGENT"||days(x)<=3)},
{title:"Oggi",sub:format(new Date(),"EEEE d MMMM",{locale:it}),items:items.filter(x=>days(x)===0&&x.priority!=="URGENT")},
{title:"Questa settimana",sub:"Le prossime cose da fare",items:items.filter(x=>days(x)>3&&days(x)<=7)},
{title:"Più avanti",sub:"Una piccola anteprima",items:items.filter(x=>days(x)>7).sort((a,b)=>a.dueDate.localeCompare(b.dueDate)).slice(0,3)}
];
return <div className="content">
<div className="day-summary"><div><span className="today-date">{format(new Date(),"EEEE d MMMM",{locale:it})}</span><p>{sections[0].items.length?`${sections[0].items.length} attività richiedono la tua attenzione.`:"Nessuna urgenza. Tutto sotto controllo."}</p></div><span className={sections[0].items.length?"pulse":"pulse calm"}/></div>
{sections.map((section,index)=>section.items.length>0&&<section className="deadline-section" key={section.title}>
<header><div><h2>{section.title}</h2><p>{section.sub}</p></div><span>{section.items.length}</span></header>
<div className="cards">{section.items.map(item=><DeadlineCard key={item.id} item={item} users={db.users} deadlines={db.deadlines} canEdit={canEdit} onAction={act} onEdit={edit}/>)}</div>
{index===3&&<button type="button" className="text-btn" onClick={onSeeAll}>Vedi tutte le scadenze <ChevronRight/></button>}
</section>)}
</div>
}

function AllDeadlines({items,db,canEdit,act,edit}:{items:Deadline[];db:Database;canEdit:boolean;act:(i:string,b:object)=>void;edit:(d:Deadline)=>void}){
const [status,setStatus]=useState("ACTIVE");
const [priority,setPriority]=useState("ALL");
const [closed,setClosed]=useState<Set<string>>(()=>new Set());

const filtered=items.filter(x=>
(priority==="ALL"||x.priority===priority)&&
(status==="ACTIVE"?!["COMPLETED","CANCELLED"].includes(x.status):x.status===status)
);

const groups=(()=>{
const map=new Map<string,Deadline[]>();
for(const item of filtered){
const category=item.category||"Altro";
if(!map.has(category))map.set(category,[]);
map.get(category)!.push(item);
}
return [...map.entries()]
.map(([category,group])=>[category,[...group].sort((a,b)=>a.dueDate.localeCompare(b.dueDate))] as [string,Deadline[]])
.sort((a,b)=>(a[1][0]?.dueDate||"9999").localeCompare(b[1][0]?.dueDate||"9999")||a[0].localeCompare(b[0],"it"));
})();

function toggle(category:string){
setClosed(current=>{
const next=new Set(current);
if(next.has(category))next.delete(category);else next.add(category);
return next;
});
}

return <div className="content">
<div className="filterbar"><div>
<label>Stato<select value={status} onChange={e=>setStatus(e.target.value)}>
<option value="ACTIVE">Aperte</option><option value="TODO">Da fare</option><option value="IN_PROGRESS">In gestione</option><option value="WAITING">In attesa</option><option value="COMPLETED">Completate</option>
</select></label>
<label>Priorità<select value={priority} onChange={e=>setPriority(e.target.value)}>
<option value="ALL">Tutte</option><option value="NORMAL">Normale</option><option value="IMPORTANT">Importante</option><option value="URGENT">Urgente</option>
</select></label>
</div><b>{filtered.length} scadenze</b></div>

{groups.length===0?<div className="empty">Nessuna scadenza con questi filtri.</div>:
<div className="deadline-groups">{groups.map(([category,group])=>{
const isClosed=closed.has(category);
return <section className="deadline-category-group" key={category}>
<button type="button" className="deadline-category-head" onClick={()=>toggle(category)} aria-expanded={!isClosed}>
<span className="deadline-category-chevron">{isClosed?<ChevronRight/>:<ChevronDown/>}</span>
<span className="deadline-category-name" style={categoryStyle(category)}>{category}</span>
<span className="deadline-category-count">{group.length}</span>
</button>
{!isClosed&&<div className="cards deadline-category-cards">{group.map(item=><DeadlineCard key={item.id} item={item} users={db.users} deadlines={db.deadlines} canEdit={canEdit} onAction={act} onEdit={edit}/>)}</div>}
</section>
})}</div>}
</div>
}

function decodeVapidKey(base64:string){
const padding="=".repeat((4-base64.length%4)%4);
const normalized=(base64+padding).replace(/-/g,"+").replace(/_/g,"/");
const raw=atob(normalized);
return Uint8Array.from([...raw].map(char=>char.charCodeAt(0)));
}

type PushTestRow={userId:string;devices:number;sent:number;failed:number;removed:number};

function Notifications({items,db,session}:{items:Deadline[];db:Database;session:Session}){
const due=items.filter(x=>differenceInCalendarDays(parseISO(x.dueDate),new Date())<=3).length;
const week=items.filter(x=>{const n=differenceInCalendarDays(parseISO(x.dueDate),new Date());return n>=0&&n<=7}).length;
const activeUsers=db.users.filter(u=>u.active);
const vapidKey=process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY||"";

const [permission,setPermission]=useState(()=>typeof Notification!=="undefined"?Notification.permission:"default");
const [deviceEnabled,setDeviceEnabled]=useState(false);
const [serverDevices,setServerDevices]=useState(0);
const [configured,setConfigured]=useState(Boolean(vapidKey));
const [busy,setBusy]=useState(false);
const [message,setMessage]=useState("");
const [testUsers,setTestUsers]=useState<string[]>(()=>activeUsers.map(u=>u.id));
const [testResult,setTestResult]=useState<PushTestRow[]>([]);

const supported=typeof window!=="undefined"&&"serviceWorker" in navigator&&"PushManager" in window&&"Notification" in window;

const refreshDeviceStatus=useCallback(async()=>{
if(supported){
const registration=await navigator.serviceWorker.ready;
const subscription=await registration.pushManager.getSubscription();
setDeviceEnabled(Boolean(subscription));
setPermission(Notification.permission);
}
const response=await fetch("/api/push/status");
if(response.ok){
const result=await response.json();
setServerDevices(result.devices||0);
setConfigured(Boolean(result.configured));
}
},[supported]);

useEffect(()=>{void refreshDeviceStatus()},[refreshDeviceStatus]);

async function enablePush(){
if(!supported){setMessage("Questo browser o dispositivo non supporta Web Push.");return}
if(!vapidKey){setMessage("Chiave VAPID pubblica non configurata.");return}
setBusy(true);setMessage("");
try{
const result=await Notification.requestPermission();
setPermission(result);
if(result!=="granted"){setMessage("Permesso notifiche non concesso.");return}
const registration=await navigator.serviceWorker.ready;
let subscription=await registration.pushManager.getSubscription();
if(!subscription){
subscription=await registration.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:decodeVapidKey(vapidKey)});
}
const response=await fetch("/api/push/subscription",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(subscription.toJSON())});
const payload=await response.json();
if(!response.ok)throw new Error(payload.error||"Registrazione non riuscita");
setMessage("Notifiche attive su questo dispositivo.");
await refreshDeviceStatus();
}catch(error){setMessage((error as Error).message||"Impossibile attivare le notifiche.")}finally{setBusy(false)}
}

async function disablePush(){
if(!supported)return;
setBusy(true);setMessage("");
try{
const registration=await navigator.serviceWorker.ready;
const subscription=await registration.pushManager.getSubscription();
if(subscription){
const endpoint=subscription.endpoint;
await fetch("/api/push/subscription",{method:"DELETE",headers:{"Content-Type":"application/json"},body:JSON.stringify({endpoint})});
await subscription.unsubscribe();
}
setMessage("Notifiche disattivate su questo dispositivo.");
await refreshDeviceStatus();
}catch(error){setMessage((error as Error).message||"Disattivazione non riuscita.")}finally{setBusy(false)}
}

function toggleTestUser(id:string){
setTestUsers(current=>current.includes(id)?current.filter(x=>x!==id):[...current,id]);
}

async function sendTest(){
if(!testUsers.length){setMessage("Seleziona almeno un utente.");return}
setBusy(true);setMessage("");setTestResult([]);
try{
const response=await fetch("/api/push/test",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({userIds:testUsers})});
const payload=await response.json();
if(!response.ok)throw new Error(payload.error||"Test non riuscito");
setTestResult(payload.results||[]);
setMessage(`Test completato: ${payload.sent||0} notifiche inviate.`);
await refreshDeviceStatus();
}catch(error){setMessage((error as Error).message||"Test notifiche non riuscito.")}finally{setBusy(false)}
}

return <div className="content narrow">
<div className="notice-hero"><Bell/><h2>Notifiche</h2><p>Promemoria reali sui dispositivi autorizzati.</p></div>
<div className="notice-list">
<div><span className="notice-dot red"/><div><b>{due} scadenze richiedono attenzione</b><small>Scadute o entro 3 giorni</small></div></div>
<div><span className="notice-dot orange"/><div><b>{week} scadenze entro 7 giorni</b><small>Riepilogo della settimana</small></div></div>
<div><span className="notice-dot green"/><div><b>Push su questo dispositivo</b><small>{!supported?"Non supportato":deviceEnabled?"Attivo":permission==="denied"?"Bloccato nelle impostazioni del browser":"Non attivo"} · {serverDevices} dispositiv{serverDevices===1?"o":"i"} registrat{serverDevices===1?"o":"i"} per {session.name}</small></div>
{deviceEnabled?<button className="secondary" disabled={busy} onClick={disablePush}><BellOff/>Disattiva</button>:<button className="secondary" disabled={busy||!configured} onClick={enablePush}><BellRing/>Attiva</button>}
</div>
</div>

{message&&<div className="push-message">{message}</div>}

{session.role==="ADMIN"&&<section className="push-test-panel">
<div className="push-test-head"><div><span className="eyebrow">DIAGNOSTICA</span><h2>Test notifiche</h2><p>Invia subito una vera notifica push ai dispositivi degli utenti selezionati.</p></div>
<button type="button" className="secondary" onClick={()=>setTestUsers(activeUsers.map(u=>u.id))}>Tutti</button></div>
<div className="push-user-grid">{activeUsers.map(user=><label className="push-user-check" key={user.id}>
<input type="checkbox" checked={testUsers.includes(user.id)} onChange={()=>toggleTestUser(user.id)}/>
<span className="push-user-dot" style={{background:user.color}}/><span>{user.name}</span>
</label>)}</div>
<button type="button" className="primary push-test-button" disabled={busy||!configured||testUsers.length===0} onClick={sendTest}><Send/>{busy?"Invio…":"Invia test notifiche"}</button>
{testResult.length>0&&<div className="push-test-results">{testResult.map(row=>{
const user=db.users.find(u=>u.id===row.userId);
return <div key={row.userId}><b>{user?.name||row.userId}</b><span>{row.devices} dispositivi · {row.sent} inviate{row.failed?` · ${row.failed} errori`:""}{row.removed?` · ${row.removed} rimosse`:""}</span></div>
})}</div>}
</section>}
</div>
}

function SettingsView({db,reload,canEdit}:{db:Database;reload:()=>Promise<void>;canEdit:boolean}){const [days,setDays]=useState(db.archiveAfterDays??30);async function save(){const r=await fetch("/api/settings",{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({archiveAfterDays:days})});if(r.ok)await reload()}return <div className="content settings-grid"><UserAdmin/><section className="settings-card"><h2>Categorie</h2><p>Usate per organizzare senza complicare.</p><div className="category-cloud">{db.categories.map(c=><span key={c} style={categoryStyle(c)}>{c}</span>)}</div></section><section className="settings-card"><h2>Notifiche</h2><p>Regole predefinite anti-bombardamento.</p><div className="setting-row"><b>Importante</b><span>7, 3 e 1 giorno prima</span></div><div className="setting-row"><b>Urgente</b><span>7, 3, 1 giorno e il giorno stesso</span></div></section>{canEdit&&<section className="settings-card"><h2>Archiviazione automatica</h2><p>Le scadenze completate restano nello storico.</p><label>Dopo quanti giorni? (-1 disabilita)<input type="number" min="-1" max="3650" value={days} onChange={e=>setDays(Number(e.target.value))}/></label><button className="secondary" onClick={save}>Salva</button></section>}</div>}
function ArchiveView({items,db,act,canEdit}:{items:Deadline[];db:Database;act:(i:string,b:object)=>void;canEdit:boolean}){return <div className="content narrow"><h2>Archivio</h2>{items.length===0?<div className="empty">Nessuna scadenza archiviata.</div>:items.map(x=><div className="trash-row" key={x.id}><div><b>{x.title}</b><small>{x.dueDate} · {db.users.find(u=>u.id===x.assigneeId)?.name} · {x.status}</small></div>{canEdit&&<button className="secondary" onClick={()=>act(x.id,{action:"unarchive"})}>Ripristina</button>}</div>)}</div>}
function Trash({items,db,act}:{items:Deadline[];db:Database;act:(i:string,b:object)=>void}){return <div className="content narrow"><div className="trash-info"><Trash2/><div><h2>Cestino</h2><p>Le scadenze restano recuperabili per 30 giorni.</p></div></div>{items.length===0?<div className="empty">Il cestino è vuoto.</div>:items.map(x=><div className="trash-row" key={x.id}><div><b>{x.title}</b><small>Eliminata il {format(new Date(x.deletedAt!),"d MMMM",{locale:it})}</small></div><button className="secondary" onClick={()=>act(x.id,{action:"restore"})}>Ripristina</button></div>)}</div>}
