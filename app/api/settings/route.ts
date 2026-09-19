import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { updateDb } from "@/lib/store";
import { z } from "zod";

export async function PATCH(req:Request){const user=await getSession();if(!user||user.role!=="ADMIN")return NextResponse.json({error:"Non autorizzato"},{status:403});const p=z.object({archiveAfterDays:z.number().int().min(-1).max(3650)}).safeParse(await req.json());if(!p.success)return NextResponse.json({error:"Valore non valido"},{status:400});await updateDb(db=>{db.archiveAfterDays=p.data.archiveAfterDays});return NextResponse.json({ok:true})}
