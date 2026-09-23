import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime="nodejs";

type Stage="RECEIVED"|"DISPLAYED"|"ERROR";

export async function POST(req:Request){
  const body=await req.json() as {
    deliveryId?:string;
    deviceId?:string;
    stage?:Stage;
    error?:string;
  };

  if(
    !body.deliveryId||
    !body.deviceId||
    !body.stage||
    !["RECEIVED","DISPLAYED","ERROR"].includes(body.stage)
  ){
    return NextResponse.json(
      {error:"ACK non valido"},
      {status:400}
    );
  }

  const device=await prisma.pushSubscription.findUnique({
    where:{id:body.deviceId},
    select:{
      id:true,
      userId:true
    }
  });

  if(!device){
    return NextResponse.json(
      {error:"Dispositivo non trovato"},
      {status:404}
    );
  }

  const now=new Date();

  if(body.stage==="RECEIVED"){
    await prisma.$transaction([
      prisma.notificationLog.updateMany({
        where:{
          id:body.deliveryId,
          userId:device.userId
        },
        data:{status:"RECEIVED"}
      }),
      prisma.pushSubscription.update({
        where:{id:device.id},
        data:{
          lastReceivedAt:now,
          lastSeenAt:now,
          lastError:null
        }
      })
    ]);
  }

  if(body.stage==="DISPLAYED"){
    await prisma.$transaction([
      prisma.notificationLog.updateMany({
        where:{
          id:body.deliveryId,
          userId:device.userId
        },
        data:{status:"DISPLAYED"}
      }),
      prisma.pushSubscription.update({
        where:{id:device.id},
        data:{
          lastReceivedAt:now,
          lastDisplayedAt:now,
          lastSeenAt:now,
          lastError:null
        }
      })
    ]);
  }

  if(body.stage==="ERROR"){
    const error=(body.error||"Errore visualizzazione").slice(0,500);

    await prisma.$transaction([
      prisma.notificationLog.updateMany({
        where:{
          id:body.deliveryId,
          userId:device.userId
        },
        data:{
          status:"DISPLAY_ERROR",
          message:error
        }
      }),
      prisma.pushSubscription.update({
        where:{id:device.id},
        data:{
          lastReceivedAt:now,
          lastSeenAt:now,
          lastError:error
        }
      })
    ]);
  }

  return NextResponse.json({ok:true});
}
