import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { readDb } from "@/lib/store";
import { prisma } from "@/lib/prisma";
import { sendPushToUsers } from "@/lib/push";

export const runtime="nodejs";

export async function POST(req:Request){
  const session=await getSession();

  if(!session)return NextResponse.json({error:"Non autorizzato"},{status:401});
  if(session.role!=="ADMIN")return NextResponse.json({error:"Permesso negato"},{status:403});

  const body=await req.json() as {userIds?:string[]};
  const db=await readDb({readOnly:true});
  const active=new Set(db.users.filter(u=>u.active).map(u=>u.id));
  const userIds=[...new Set((body.userIds||[]).filter(id=>active.has(id)))];

  if(!userIds.length){
    return NextResponse.json({error:"Seleziona almeno un utente"},{status:400});
  }

  try{
    const results=await sendPushToUsers(userIds,{
      title:"So.Agri Scadenze — Test notifiche",
      body:"Se visualizzi questo messaggio, le notifiche di questo dispositivo funzionano correttamente.",
      url:"/",
      tag:`soagri-test-${Date.now()}`
    });

    await prisma.notificationLog.createMany({
      data:results.map(row=>({
        userId:row.userId,
        channel:"PUSH_TEST",
        status:row.sent>0?"SENT":"NO_DEVICE",
        message:`Test push: ${row.sent} inviate, ${row.failed} errori`
      }))
    });

    return NextResponse.json({
      results,
      sent:results.reduce((n,row)=>n+row.sent,0),
      failed:results.reduce((n,row)=>n+row.failed,0)
    });
  }catch(error){
    return NextResponse.json({error:(error as Error).message},{status:503});
  }
}
