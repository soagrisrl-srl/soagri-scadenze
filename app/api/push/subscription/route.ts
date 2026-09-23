import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { pushConfigured } from "@/lib/push";

export const runtime="nodejs";

type Body={
  endpoint?:string;
  keys?:{
    p256dh?:string;
    auth?:string;
  };
  deviceName?:string;
  platform?:string;
  browser?:string;
  userAgent?:string;
};

function text(value:unknown,max:number){
  return typeof value==="string"
    ? value.slice(0,max)
    : null;
}

export async function POST(req:Request){
  const session=await getSession();

  if(!session){
    return NextResponse.json(
      {error:"Non autorizzato"},
      {status:401}
    );
  }

  if(!pushConfigured()){
    return NextResponse.json(
      {error:"Web Push non configurato"},
      {status:503}
    );
  }

  const body=await req.json() as Body;

  if(
    !body.endpoint||
    !body.keys?.p256dh||
    !body.keys?.auth
  ){
    return NextResponse.json(
      {error:"Subscription non valida"},
      {status:400}
    );
  }

  const subscription=await prisma.pushSubscription.upsert({
    where:{endpoint:body.endpoint},
    update:{
      userId:session.id,
      p256dh:body.keys.p256dh,
      auth:body.keys.auth,
      enabled:true,
      deviceName:text(body.deviceName,120),
      platform:text(body.platform,80),
      browser:text(body.browser,80),
      userAgent:text(body.userAgent,500),
      lastSeenAt:new Date(),
      lastError:null
    },
    create:{
      userId:session.id,
      endpoint:body.endpoint,
      p256dh:body.keys.p256dh,
      auth:body.keys.auth,
      enabled:true,
      deviceName:text(body.deviceName,120),
      platform:text(body.platform,80),
      browser:text(body.browser,80),
      userAgent:text(body.userAgent,500),
      lastSeenAt:new Date()
    }
  });

  const devices=await prisma.pushSubscription.count({
    where:{
      userId:session.id,
      enabled:true
    }
  });

  return NextResponse.json({
    ok:true,
    deviceId:subscription.id,
    devices
  });
}

export async function DELETE(req:Request){
  const session=await getSession();

  if(!session){
    return NextResponse.json(
      {error:"Non autorizzato"},
      {status:401}
    );
  }

  const body=await req.json() as {endpoint?:string};

  if(!body.endpoint){
    return NextResponse.json(
      {error:"Endpoint mancante"},
      {status:400}
    );
  }

  await prisma.pushSubscription.updateMany({
    where:{
      userId:session.id,
      endpoint:body.endpoint
    },
    data:{
      enabled:false,
      lastError:"Disattivato dall'utente"
    }
  });

  return NextResponse.json({ok:true});
}
