import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession,hashPassword } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { publicUser,updateDb } from "@/lib/store";
import { userInput } from "../route";

const editInput=userInput.omit({password:true}).extend({password:z.union([z.literal(""),z.string().min(8).max(128)]).optional()});

export async function PATCH(req:Request,{params}:{params:Promise<{id:string}>}){
  const session=await getSession();
  if(!can(session,"users.manage"))return NextResponse.json({error:"Non autorizzato"},{status:403});
  const parsed=editInput.safeParse(await req.json());
  if(!parsed.success)return NextResponse.json({error:"Dati non validi"},{status:400});
  const {id}=await params;
  const input=parsed.data;
  try{
    const result=await updateDb(db=>{
      const user=db.users.find(u=>u.id===id);
      if(!user)throw new Error("NOT_FOUND");
      if(db.users.some(u=>u.id!==id&&u.email.toLowerCase()===input.email))throw new Error("DUPLICATE_EMAIL");
      if(id===session!.id&&(!input.active||input.role!=="ADMIN"))throw new Error("SELF_LOCKOUT");
      if(user.role==="ADMIN"&&user.active&&(!input.active||input.role!=="ADMIN")&&!db.users.some(u=>u.id!==id&&u.active&&u.role==="ADMIN"))throw new Error("LAST_ADMIN");
      Object.assign(user,{name:input.name,email:input.email,role:input.role,active:input.active,canManageEvents:input.canManageEvents});
      if(input.password)user.passwordHash=hashPassword(input.password);
      return publicUser(user);
    });
    return NextResponse.json(result);
  }catch(error){
    const message=(error as Error).message;
    if(message==="NOT_FOUND")return NextResponse.json({error:"Utente non trovato"},{status:404});
    if(message==="DUPLICATE_EMAIL")return NextResponse.json({error:"Email già utilizzata"},{status:409});
    if(message==="SELF_LOCKOUT"||message==="LAST_ADMIN")return NextResponse.json({error:"Deve rimanere almeno un amministratore attivo; non puoi disattivare il tuo account"},{status:400});
    throw error;
  }
}
