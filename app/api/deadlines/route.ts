import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { readDb, updateDb, publicUser } from "@/lib/store";
import { can } from "@/lib/permissions";
import { createDeadline, createFields } from "@/lib/services/deadlines";

export async function GET(){const s=await getSession();if(!s)return NextResponse.json({error:"Non autorizzato"},{status:401});const db=await readDb();return NextResponse.json({...db,users:db.users.map(publicUser)})}
export async function POST(req:Request){const s=await getSession();if(!can(s,"events.create"))return NextResponse.json({error:"Non autorizzato"},{status:403});const parsed=createFields.safeParse(await req.json());if(!parsed.success)return NextResponse.json({error:"Dati non validi",details:parsed.error.issues},{status:400});try{return NextResponse.json(await updateDb(db=>createDeadline(db,parsed.data,db.users.find(u=>u.id===s!.id)!,"WEB")),{status:201})}catch(error){const message=(error as Error).message;if(["INVALID_ASSIGNEE","INVALID_DATE_RANGE","SELF_DEPENDENCY","INVALID_DEPENDENCY","CYCLIC_DEPENDENCY","INVALID_RECURRENCE"].includes(message))return NextResponse.json({error:message},{status:400});throw error}}
