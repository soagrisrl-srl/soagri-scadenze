"use client";
import { useEffect,useState } from "react";
import { Plus,Trash2,X } from "lucide-react";
import type { Deadline,Priority,User,WorkingDayAdjustment,RecurrenceAnchor,Status } from "@/types";
import { parseRecurrence,recurrenceRule } from "@/lib/deadline";
import { categoryStyle } from "@/lib/constants";

type Draft={ datePrecision?: "DAY"|"MONTH"|"YEAR";title:string;dueDate:string;startDate?:string;endDate?:string;priority:Priority;status:Status;assigneeId:string;description:string;category:string;recurrence:string;recurrenceAnchor:RecurrenceAnchor;workingDayAdjustment:WorkingDayAdjustment;dependsOnIds:string[];notes:string;waitingFor:string;requireRead:boolean;notifyIds:string[];reminders:number[];links:string[];checklist:{id:string;text:string;done:boolean}[]};
function monthEnd(ym:string){
  const [y,m]=ym.split("-").map(Number);
  return new Date(Date.UTC(y,m,0)).toISOString().slice(0,10);
}

export function DeadlineForm({open,onClose,onSave,users,categories,deadlines,item}:{open:boolean;onClose:()=>void;onSave:(d:Record<string,unknown>)=>Promise<void>;users:User[];categories:string[];deadlines:Deadline[];item:Deadline|null}){
  const empty=():Draft=>({title:"",dueDate:new Date().toISOString().slice(0,10),priority:"NORMAL",status:"TODO",assigneeId:users.find(u=>u.active)?.id||"",description:"",category:categories[0]||"Altro",recurrence:"NONE",recurrenceAnchor:"DUE_DATE",workingDayAdjustment:"NONE",dependsOnIds:[],notes:"",waitingFor:"",requireRead:false,notifyIds:[],reminders:[1],links:[],checklist:[]});
  const [d,setD]=useState<Draft>(empty),[more,setMore]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState("");
  useEffect(()=>{if(open){setD(item?{title:item.title,dueDate:item.dueDate,startDate:item.startDate,endDate:item.endDate,priority:item.priority,status:item.status,assigneeId:item.assigneeId,description:item.description,category:item.category,recurrence:item.recurrence,recurrenceAnchor:item.recurrenceAnchor||"DUE_DATE",workingDayAdjustment:item.workingDayAdjustment||"NONE",dependsOnIds:item.dependsOnIds||[],notes:item.notes,waitingFor:item.waitingFor,requireRead:item.requireRead,notifyIds:item.notifyIds,reminders:item.reminders,links:item.links,checklist:item.checklist}:empty());setError("")}},[open,item]);
  if(!open)return null;
  const set=<K extends keyof Draft>(key:K,value:Draft[K])=>setD(x=>({...x,[key]:value}));
  const recurrence=parseRecurrence(d.recurrence);
  const dateType=d.startDate?"RANGE":d.endDate?"DUE_BY":"EXACT";
  const range=dateType==="RANGE";
  const dueBy=dateType==="DUE_BY";
  const precision=d.datePrecision==="YEAR"?"YEAR":"MONTH";
  async function submit(e:React.FormEvent){e.preventDefault();
  if(range&&(!d.startDate||!d.endDate||d.startDate>d.endDate)){setError("Controlla le date del periodo.");return}
  if(dueBy&&!d.endDate){setError("Indica la data limite.");return}
  setBusy(true);try{
    const due=dateType==="EXACT"?d.dueDate:d.endDate!;
    await onSave({...d,datePrecision:dueBy?precision:"DAY",dueDate:due,startDate:range?d.startDate:item?null:undefined,endDate:dateType==="EXACT"?(item?null:undefined):d.endDate});
    onClose()
  }catch(e){setError((e as Error).message)}finally{setBusy(false)}}
  return <div className="modal-backdrop" onMouseDown={e=>e.target===e.currentTarget&&onClose()}><section className="modal"><header><div><span className="eyebrow">{item?"MODIFICA":"NUOVA SCADENZA"}</span><h2>{item?item.title:"Crea in pochi secondi"}</h2></div><button className="icon-btn" onClick={onClose}><X/></button></header><form onSubmit={submit}>
    <label>Titolo<input required autoFocus value={d.title} onChange={e=>set("title",e.target.value)}/></label>
    <div className="form-grid">
<label>Tipo data<select value={dateType} onChange={e=>{
  const v=e.target.value;
  if(v==="RANGE")setD(x=>({...x,datePrecision:"DAY",startDate:x.dueDate,endDate:x.dueDate}));
  else if(v==="DUE_BY")setD(x=>{
    const last=monthEnd(x.dueDate.slice(0,7));
    return {...x,datePrecision:"MONTH",startDate:undefined,endDate:last,dueDate:last}
  });
  else setD(x=>({...x,datePrecision:"DAY",startDate:undefined,endDate:undefined}));
}}>
<option value="EXACT">Data precisa</option>
<option value="DUE_BY">Entro il</option>
<option value="RANGE">Periodo</option>
</select></label>
{range?<><label>Dal<input required type="date" value={d.startDate||""} onChange={e=>set("startDate",e.target.value)}/></label><label>Al<input required type="date" value={d.endDate||""} onChange={e=>set("endDate",e.target.value)}/></label></>
:dueBy?<>
<label>Precisione
<select value={precision} onChange={e=>{
  const v=e.target.value as "MONTH"|"YEAR";
  if(v==="YEAR"){
    const y=d.dueDate.slice(0,4);
    setD(x=>({...x,datePrecision:"YEAR",dueDate:`${y}-12-31`,endDate:`${y}-12-31`}));
  }else{
    const last=monthEnd(d.dueDate.slice(0,7));
    setD(x=>({...x,datePrecision:"MONTH",dueDate:last,endDate:last}));
  }
}}>
<option value="MONTH">Mese</option>
<option value="YEAR">Anno</option>
</select>
</label>

{precision==="MONTH"?
<label>Entro il mese
<input required type="month" value={d.dueDate.slice(0,7)} onChange={e=>{
  const last=monthEnd(e.target.value);
  setD(x=>({...x,datePrecision:"MONTH",dueDate:last,endDate:last}));
}}/>
<small>Esempio: 05/2028. Nessun giorno preciso.</small>
</label>
:
<label>Entro l&apos;anno
<input required type="number" min="2000" max="2100" value={d.dueDate.slice(0,4)} onChange={e=>{
  const y=e.target.value;
  setD(x=>({...x,datePrecision:"YEAR",dueDate:`${y}-12-31`,endDate:`${y}-12-31`}));
}}/>
<small>Esempio: 2028. Nessun mese o giorno preciso.</small>
</label>}
</>:<label>Data<input required type="date" value={d.dueDate} onChange={e=>set("dueDate",e.target.value)}/></label>}
</div>
    <div className="form-grid"><label>Priorità<select value={d.priority} onChange={e=>set("priority",e.target.value as Priority)}><option value="NORMAL">Normale</option><option value="IMPORTANT">Importante</option><option value="URGENT">Urgente</option></select></label><label>Responsabile<select value={d.assigneeId} onChange={e=>set("assigneeId",e.target.value)}>{users.filter(u=>u.active).map(u=><option key={u.id} value={u.id}>{u.name}</option>)}</select></label><label>Stato<select value={d.status} onChange={e=>set("status",e.target.value as Status)}><option value="TODO">Da fare</option><option value="IN_PROGRESS">In gestione</option><option value="WAITING">In attesa</option><option value="COMPLETED">Completata</option></select></label></div>
    <button type="button" className="more-toggle" onClick={()=>setMore(!more)}>Altre opzioni</button>{more&&<div className="more-fields"><label>Descrizione<textarea value={d.description} onChange={e=>set("description",e.target.value)}/></label><div className="form-grid"><label>Categoria<select value={d.category} style={categoryStyle(d.category)} onChange={e=>set("category",e.target.value)}>{categories.map(c=><option key={c} style={categoryStyle(c)}>{c}</option>)}</select></label><label>In attesa di<input value={d.waitingFor} onChange={e=>set("waitingFor",e.target.value)} placeholder="Studio Inglese, cliente, fornitore…"/></label><label>Se non lavorativo<select value={d.workingDayAdjustment} onChange={e=>set("workingDayAdjustment",e.target.value as WorkingDayAdjustment)}><option value="NONE">Lascia invariata</option><option value="PREVIOUS_WORKDAY">Giorno precedente</option><option value="NEXT_WORKDAY">Giorno successivo</option></select></label></div>
      <div className="form-grid"><label>Ricorrenza<select value={recurrence?"REPEAT":"NONE"} onChange={e=>set("recurrence",e.target.value==="NONE"?"NONE":"DAYS:1")}><option value="NONE">Nessuna</option><option value="REPEAT">Ogni N unità</option></select></label>{recurrence&&<><label>Ogni<input type="number" min="1" value={recurrence.every} onChange={e=>set("recurrence",recurrenceRule(Number(e.target.value)||1,recurrence.unit))}/></label><label>Unità<select value={recurrence.unit} onChange={e=>set("recurrence",recurrenceRule(recurrence.every,e.target.value as "DAY"|"WEEK"|"MONTH"|"YEAR"))}><option value="DAY">Giorni</option><option value="WEEK">Settimane</option><option value="MONTH">Mesi</option><option value="YEAR">Anni</option></select></label></>}</div>
      {recurrence&&<label>Calcola la prossima scadenza da<select value={d.recurrenceAnchor} onChange={e=>set("recurrenceAnchor",e.target.value as RecurrenceAnchor)}><option value="DUE_DATE">Data prevista</option><option value="COMPLETION_DATE">Data effettiva di completamento</option></select></label>}
      <div className="dependency-editor">
        <div className="dependency-title">
          <b>Dipendenze</b>
          <small>Opzionale: la scadenza può non dipendere da nulla.</small>
        </div>

        {d.dependsOnIds.length>0
          ? <div className="dependency-chips">
              {d.dependsOnIds.map(id=>{
                const dep=deadlines.find(x=>x.id===id);
                return <span key={id}>
                  {dep?`${dep.title}${dep.deletedAt?" · nel cestino":""}`:"Scadenza non disponibile"}
                  <button
                    type="button"
                    title="Rimuovi dipendenza"
                    aria-label="Rimuovi dipendenza"
                    onClick={()=>set("dependsOnIds",d.dependsOnIds.filter(x=>x!==id))}
                  ><X/></button>
                </span>
              })}
            </div>
          : <div className="dependency-empty">Nessuna dipendenza.</div>
        }

        <select
          value=""
          onChange={e=>{
            const id=e.target.value;
            if(id&&!d.dependsOnIds.includes(id)){
              set("dependsOnIds",[...d.dependsOnIds,id]);
            }
          }}
        >
          <option value="">Aggiungi una dipendenza…</option>
          {deadlines
            .filter(x=>x.id!==item?.id&&!x.deletedAt&&!d.dependsOnIds.includes(x.id))
            .map(x=><option key={x.id} value={x.id}>{x.title} · {x.dueDate}</option>)
          }
        </select>

        {d.dependsOnIds.length>0&&
          <button
            type="button"
            className="dependency-clear"
            onClick={()=>set("dependsOnIds",[])}
          >
            Rimuovi tutte le dipendenze
          </button>
        }
      </div>
      <label>Note<textarea value={d.notes} onChange={e=>set("notes",e.target.value)}/></label><label>Preavvisi (giorni, separati da virgola)<input value={d.reminders.join(",")} onChange={e=>set("reminders",e.target.value.split(",").map(Number).filter(Number.isFinite))}/></label><label className="check"><input type="checkbox" checked={d.requireRead} onChange={e=>set("requireRead",e.target.checked)}/>Richiedi conferma lettura</label>
      <div className="checklist-editor"><b>Checklist</b>{d.checklist.map((x,i)=><div key={x.id}><input value={x.text} onChange={e=>set("checklist",d.checklist.map((c,j)=>j===i?{...c,text:e.target.value}:c))}/><button type="button" onClick={()=>set("checklist",d.checklist.filter((_,j)=>j!==i))}><Trash2/></button></div>)}<button type="button" onClick={()=>set("checklist",[...d.checklist,{id:crypto.randomUUID(),text:"",done:false}])}><Plus/>Aggiungi voce</button></div></div>}
    {error&&<p className="form-error">{error}</p>}<footer><button type="button" className="secondary" onClick={onClose}>Annulla</button><button className="primary" disabled={busy}>{busy?"Salvataggio…":item?"Salva modifiche":"Crea scadenza"}</button></footer>
  </form></section></div>
}
