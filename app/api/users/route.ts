import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession,hashPassword } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { publicUser,readDb,updateDb } from "@/lib/store";
import type { User } from "@/types";

export const userInput=z.object({
  name:z.string().trim().min(2).max(80),
  email:z.email().trim().toLowerCase(),
  role:z.enum(["ADMIN","MANAGER","VIEWER"]),
  active:z.boolean(),
  canManageEvents:z.boolean(),
  password:z.string().min(8).max(128)
});

export async function GET(){
  const session=await getSession();
  if(!can(session,"users.manage"))return NextResponse.json({error:"Non autorizzato"},{status:403});
  return NextResponse.json((await readDb()).users.map(publicUser));
}

export async function POST(req:Request){
  const session=await getSession();
  if(!can(session,"users.manage"))return NextResponse.json({error:"Non autorizzato"},{status:403});
  const parsed=userInput.safeParse(await req.json());
  if(!parsed.success)return NextResponse.json({error:"Controlla i dati e usa una password di almeno 8 caratteri"},{status:400});
  const input=parsed.data;
  try{
    const result=await updateDb(db=>{
      if(db.users.some(u=>u.email.toLowerCase()===input.email))throw new Error("DUPLICATE_EMAIL");
      const user:User={id:crypto.randomUUID(),name:input.name,email:input.email,role:input.role,active:input.active,canManageEvents:input.canManageEvents,color:"#176b45",passwordHash:hashPassword(input.password)};
      db.users.push(user);
      return publicUser(user);
    });
    return NextResponse.json(result,{status:201});
  }catch(error){
    if((error as Error).message==="DUPLICATE_EMAIL")return NextResponse.json({error:"Email già utilizzata"},{status:409});
    throw error;
  }
}
