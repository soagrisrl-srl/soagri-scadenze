import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { dispatchPush } from "@/lib/push";

export const runtime="nodejs";

export async function POST(req:Request){
  const session=await getSession();

  if(!session){
    return NextResponse.json(
      {error:"Non autorizzato"},
      {status:401}
    );
  }

  const body=await req.json() as {
    deviceIds?:string[];
    userIds?:string[];
  };

  let deviceIds=[
    ...new Set((body.deviceIds||[]).filter(Boolean))
  ].slice(0,100);

  let userIds=[
    ...new Set((body.userIds||[]).filter(Boolean))
  ].slice(0,100);

  if(session.role!=="ADMIN"){
    if(deviceIds.length){
      const own=await prisma.pushSubscription.findMany({
        where:{
          id:{in:deviceIds},
          userId:session.id
        },
        select:{id:true}
      });

      deviceIds=own.map(device=>device.id);
    }

    if(userIds.length){
      userIds=[session.id];
    }
  }

  if(!deviceIds.length&&!userIds.length){
    return NextResponse.json(
      {error:"Nessun dispositivo selezionato"},
      {status:400}
    );
  }

  const results=await dispatchPush({
    deviceIds,
    userIds,
    channel:"PUSH_TEST",
    title:"So.Agri — TEST REALE",
    body:"Questa notifica usa esattamente lo stesso motore delle scadenze.",
    url:"/",
    tag:`soagri-real-test-${Date.now()}`
  });

  return NextResponse.json({
    ok:true,
    accepted:results.filter(
      result=>result.status==="ACCEPTED"
    ).length,
    results
  });
}
