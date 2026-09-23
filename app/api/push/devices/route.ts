import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { pushConfigured } from "@/lib/push";

export const runtime="nodejs";
export const dynamic="force-dynamic";

export async function GET(){
  const session=await getSession();

  if(!session){
    return NextResponse.json(
      {error:"Non autorizzato"},
      {status:401}
    );
  }

  const devices=await prisma.pushSubscription.findMany({
    where:session.role==="ADMIN"
      ? {}
      : {userId:session.id},
    orderBy:[
      {enabled:"desc"},
      {lastSeenAt:"desc"}
    ],
    select:{
      id:true,
      userId:true,
      deviceName:true,
      platform:true,
      browser:true,
      enabled:true,
      createdAt:true,
      lastSeenAt:true,
      lastPushAt:true,
      lastReceivedAt:true,
      lastDisplayedAt:true,
      lastError:true
    }
  });

  return NextResponse.json({
    configured:pushConfigured(),
    devices
  });
}
