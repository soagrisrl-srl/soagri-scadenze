import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { pushConfigured } from "@/lib/push";

export const runtime="nodejs";

type Body={
  endpoint?:string;
  keys?:{p256dh?:string;auth?:string};
};

export async function POST(req:Request){
  const session=await getSession();
  if(!session)return NextResponse.json({error:"Non autorizzato"},{status:401});
  if(!pushConfigured())return NextResponse.json({error:"Web Push non configurato"},{status:503});

  const body=await req.json() as Body;

  if(!body.endpoint||!body.keys?.p256dh||!body.keys?.auth){
    return NextResponse.json({error:"Subscription non valida"},{status:400});
  }

  await prisma.pushSubscription.upsert({
    where:{endpoint:body.endpoint},
    update:{
      userId:session.id,
      p256dh:body.keys.p256dh,
      auth:body.keys.auth,
      enabled:true
    },
    create:{
      userId:session.id,
      endpoint:body.endpoint,
      p256dh:body.keys.p256dh,
      auth:body.keys.auth,
      enabled:true
    }
  });

  const devices=await prisma.pushSubscription.count({
    where:{userId:session.id,enabled:true}
  });

  return NextResponse.json({ok:true,devices});
}

export async function DELETE(req:Request){
  const session=await getSession();
  if(!session)return NextResponse.json({error:"Non autorizzato"},{status:401});

  const body=await req.json() as {endpoint?:string};

  if(!body.endpoint){
    return NextResponse.json({error:"Endpoint mancante"},{status:400});
  }

  await prisma.pushSubscription.deleteMany({
    where:{userId:session.id,endpoint:body.endpoint}
  });

  return NextResponse.json({ok:true});
}
