import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { updateDb } from "@/lib/store";
import { nextDate } from "@/lib/deadline";
import { formatISO } from "date-fns";
import { z } from "zod";

const changes = z.object({
  action:z.enum(["take","complete","delete","restore","postpone","reopen"]).optional(),
  title:z.string().min(2).optional(), dueDate:z.iso.date().optional(),
  priority:z.enum(["NORMAL","IMPORTANT","URGENT"]).optional(),
  status:z.enum(["TODO","IN_PROGRESS","WAITING","COMPLETED","CANCELLED"]).optional(),
  assigneeId:z.string().optional(), description:z.string().optional(),
  category:z.string().optional(), recurrence:z.string().optional(),
  notes:z.string().optional(), waitingFor:z.string().optional(),
  requireRead:z.boolean().optional(),
  links:z.array(z.string()).optional(),
  checklist:z.array(z.object({id:z.string(),text:z.string(),done:z.boolean()})).optional(),
  notifyIds:z.array(z.string()).optional(),reminders:z.array(z.number()).optional()
}).strict();

export async function PATCH(req:Request,{params}:{params:Promise<{id:string}>}){
  const session=await getSession();
  if(!can(session,"events.manage"))return NextResponse.json({error:"Non autorizzato"},{status:403});
  const parsed=changes.safeParse(await req.json());
  if(!parsed.success)return NextResponse.json({error:"Dati non validi"},{status:400});
  const {id}=await params;
  const body=parsed.data;
  try{
    const item=await updateDb(db=>{
      const deadline=db.deadlines.find(d=>d.id===id);
      if(!deadline)throw new Error("NOT_FOUND");
      if(body.assigneeId&&!db.users.some(u=>u.id===body.assigneeId&&u.active))throw new Error("INVALID_ASSIGNEE");
      const now=new Date().toISOString();
      let action="Modifica";
      if(body.action==="take"){body.status="IN_PROGRESS";body.assigneeId=session!.id;deadline.takenAt=now;action="Presa in carico"}
      if(body.action==="complete"){
        body.status="COMPLETED";deadline.completedAt=now;action="Completamento";
        if(deadline.status!=="COMPLETED"){
          const next=nextDate(deadline.dueDate,deadline.recurrence);
          if(next)db.deadlines.push({...deadline,id:crypto.randomUUID(),dueDate:formatISO(next,{representation:"date"}),status:"TODO",completedAt:undefined,takenAt:undefined,createdAt:now,updatedAt:now,audits:[{id:crypto.randomUUID(),at:now,actor:"Sistema",action:"Ricorrenza generata"}]});
        }
      }
      if(body.action==="delete"){deadline.deletedAt=now;action="Spostamento nel cestino"}
      if(body.action==="restore"){deadline.deletedAt=undefined;action="Ripristino"}
      if(body.action==="reopen"){body.status="TODO";deadline.completedAt=undefined;action="Riapertura"}
      if(body.action==="postpone")action="Rimandata";
      const {action:_,...fields}=body;void _;
      Object.assign(deadline,fields,{updatedAt:now});
      deadline.audits.unshift({id:crypto.randomUUID(),at:now,actor:session!.name,action});
      return deadline;
    });
    return NextResponse.json(item);
  }catch(error){
    if((error as Error).message==="NOT_FOUND")return NextResponse.json({error:"Scadenza non trovata"},{status:404});
    if((error as Error).message==="INVALID_ASSIGNEE")return NextResponse.json({error:"Responsabile non valido"},{status:400});
    throw error;
  }
}
