"use client";
import { useEffect, useState } from "react";
import { Pencil, UserCheck, UserPlus, Users, UserX, X } from "lucide-react";
import type { Role, User } from "@/types";

type SafeUser = Omit<User,"passwordHash">;
type Draft = {name:string;email:string;role:Role;active:boolean;canManageEvents:boolean;password:string};
const blank:Draft={name:"",email:"",role:"VIEWER",active:true,canManageEvents:false,password:""};
const roleName:Record<Role,string>={ADMIN:"Admin",MANAGER:"Gestore",VIEWER:"Visualizzatore"};

export function UserAdmin(){
  const [users,setUsers]=useState<SafeUser[]|null>(null);
  const [selected,setSelected]=useState<SafeUser|null>(null);
  const [editing,setEditing]=useState(false);
  const [draft,setDraft]=useState<Draft>(blank);
  const [error,setError]=useState("");
  const [busy,setBusy]=useState(false);
  useEffect(()=>{fetch("/api/users").then(async r=>r.ok?setUsers(await r.json()):null)},[]);
  if(users===null)return null;
  function start(user?:SafeUser){
    setSelected(user||null);
    setDraft(user?{name:user.name,email:user.email,role:user.role,active:user.active,canManageEvents:user.canManageEvents,password:""}:{...blank});
    setError("");
    setEditing(true);
  }
  async function save(e:React.FormEvent){
    e.preventDefault();
    setBusy(true);setError("");
    try{
      const response=await fetch(selected?`/api/users/${selected.id}`:"/api/users",{
        method:selected?"PATCH":"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(draft)
      });
      const result=await response.json();
      if(!response.ok){setError(result.error||"Impossibile salvare l'utente");return}
      setUsers(current=>current!.some(u=>u.id===result.id)?current!.map(u=>u.id===result.id?result:u):[...current!,result]);
      setEditing(false);
    }catch{setError("Connessione non disponibile. Riprova.")}
    finally{setBusy(false)}
  }
  const set=(key:keyof Draft,value:string|boolean)=>setDraft(d=>({...d,[key]:value}));
  return <section className="settings-card user-admin">
    <header className="user-admin-head"><div><span className="eyebrow">AMMINISTRAZIONE</span><h2><Users size={21}/> Utenti e permessi</h2><p>Gestisci accesso e diritto di creare e modificare le scadenze.</p></div><button className="primary" onClick={()=>start()}><UserPlus size={18}/> Nuovo utente</button></header>
    <div className="user-list">
      {users.map(user=><div className="user-line" key={user.id}>
        <span className="avatar" style={{background:user.color}}>{user.name[0]}</span>
        <div className="user-identity"><b>{user.name}</b><small>{user.email}</small></div>
        <span className="role">{roleName[user.role]}</span>
        <span className="user-permission">{user.canManageEvents||user.role==="ADMIN"?"Gestione scadenze: sì":"Gestione scadenze: no"}</span>
        <span className={user.active?"user-active":"user-inactive"}>{user.active?<UserCheck size={16}/>:<UserX size={16}/>} {user.active?"Attivo":"Disattivato"}</span>
        <button className="secondary" onClick={()=>start(user)}><Pencil size={15}/> Modifica</button>
      </div>)}
    </div>
    {editing&&<div className="modal-backdrop" onMouseDown={e=>e.target===e.currentTarget&&setEditing(false)}><section className="modal user-modal">
      <header><div><span className="eyebrow">UTENTI E PERMESSI</span><h2>{selected?"Modifica utente":"Nuovo utente"}</h2></div><button className="icon-btn" onClick={()=>setEditing(false)} aria-label="Chiudi"><X/></button></header>
      <form onSubmit={save}>
        <label>Nome<input required minLength={2} value={draft.name} onChange={e=>set("name",e.target.value)}/></label>
        <label>Email<input required type="email" value={draft.email} onChange={e=>set("email",e.target.value)}/></label>
        <div className="form-grid"><label>Ruolo<select value={draft.role} onChange={e=>{const role=e.target.value as Role;setDraft(d=>({...d,role,canManageEvents:role!=="VIEWER"}))}}><option value="ADMIN">Admin</option><option value="MANAGER">Gestore</option><option value="VIEWER">Visualizzatore</option></select></label></div>
        <label>Password {selected?"(lascia vuoto per mantenerla)":"(almeno 8 caratteri)"}<input type="password" minLength={8} required={!selected} value={draft.password} onChange={e=>set("password",e.target.value)} autoComplete="new-password"/></label>
        <label className="check"><input type="checkbox" checked={draft.active} onChange={e=>set("active",e.target.checked)}/>Account attivo</label>
        <label className="check"><input type="checkbox" checked={draft.canManageEvents} onChange={e=>set("canManageEvents",e.target.checked)}/>Può creare e gestire eventi/scadenze</label>
        {error&&<p className="form-error" role="alert">{error}</p>}
        <footer><button type="button" className="secondary" onClick={()=>setEditing(false)}>Annulla</button><button className="primary" disabled={busy}>{busy?"Salvataggio…":"Salva utente"}</button></footer>
      </form>
    </section></div>}
  </section>;
}
