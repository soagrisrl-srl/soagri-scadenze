import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { updateDb } from "@/lib/store";
import { updateDeadline,updateFields } from "@/lib/services/deadlines";

export async function PATCH(req:Request,{params}:{params:Promise<{id:string}>}){
  const session=await getSession();if(!can(session,"events.manage"))return NextResponse.json({error:"Non autorizzato"},{status:403});
  const parsed=updateFields.safeParse(await req.json());if(!parsed.success)return NextResponse.json({error:"Dati non validi",details:parsed.error.issues},{status:400});
  const {id}=await params;
  try{return NextResponse.json(await updateDb(db=>updateDeadline(db,id,parsed.data,db.users.find(u=>u.id===session!.id)!,"WEB")))}
  catch(error){const message=(error as Error).message;if(!["NOT_FOUND","DEPENDENCIES_INCOMPLETE","INVALID_ASSIGNEE","INVALID_DATE_RANGE","SELF_DEPENDENCY","INVALID_DEPENDENCY","CYCLIC_DEPENDENCY","INVALID_RECURRENCE"].includes(message))throw error;return NextResponse.json({error:message},{status:message==="NOT_FOUND"?404:message==="DEPENDENCIES_INCOMPLETE"?409:400})}
}
