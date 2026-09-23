import webpush from "web-push";
import { prisma } from "./prisma";

export type DispatchPushInput={
  userIds?:string[];
  deviceIds?:string[];
  deadlineId?:string;
  channel:string;
  title:string;
  body:string;
  url?:string;
  tag?:string;
};

export type DeviceDelivery={
  userId:string;
  deviceId:string|null;
  deviceName:string|null;
  status:"ACCEPTED"|"FAILED"|"EXPIRED"|"NO_DEVICE";
  httpStatus?:number;
  error?:string;
};

export function pushConfigured(){
  return Boolean(
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY &&
    process.env.VAPID_PRIVATE_KEY &&
    process.env.VAPID_SUBJECT
  );
}

function configure(){
  if(!pushConfigured()){
    throw new Error("Configurazione VAPID incompleta.");
  }

  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT!,
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
    process.env.VAPID_PRIVATE_KEY!
  );
}

function errorMessage(error:unknown){
  if(error instanceof Error)return error.message;
  return String(error);
}

export async function dispatchPush(
  input:DispatchPushInput
):Promise<DeviceDelivery[]>{
  configure();

  const userIds=[...new Set((input.userIds||[]).filter(Boolean))];
  const deviceIds=[...new Set((input.deviceIds||[]).filter(Boolean))];

  const subscriptions=deviceIds.length
    ? await prisma.pushSubscription.findMany({
        where:{
          id:{in:deviceIds},
          enabled:true
        }
      })
    : userIds.length
      ? await prisma.pushSubscription.findMany({
          where:{
            userId:{in:userIds},
            enabled:true
          }
        })
      : [];

  const results:DeviceDelivery[]=[];

  if(!deviceIds.length){
    const usersWithDevice=new Set(subscriptions.map(s=>s.userId));

    for(const userId of userIds){
      if(usersWithDevice.has(userId))continue;

      await prisma.notificationLog.create({
        data:{
          userId,
          deadlineId:input.deadlineId,
          channel:input.channel,
          status:"NO_DEVICE",
          message:`${input.title} — ${input.body}`
        }
      });

      results.push({
        userId,
        deviceId:null,
        deviceName:null,
        status:"NO_DEVICE"
      });
    }
  }

  for(const subscription of subscriptions){
    const log=await prisma.notificationLog.create({
      data:{
        userId:subscription.userId,
        deadlineId:input.deadlineId,
        channel:input.channel,
        status:"SENDING",
        message:`${input.title} — ${input.body}`
      }
    });

    const payload=JSON.stringify({
      title:input.title,
      body:input.body,
      url:input.url||"/",
      tag:input.tag||`soagri-${log.id}`,
      deliveryId:log.id,
      deviceId:subscription.id
    });

    try{
      const response=await webpush.sendNotification(
        {
          endpoint:subscription.endpoint,
          keys:{
            p256dh:subscription.p256dh,
            auth:subscription.auth
          }
        },
        payload,
        {TTL:86400}
      );

      const now=new Date();

      await prisma.$transaction([
        prisma.notificationLog.updateMany({
          where:{
            id:log.id,
            status:"SENDING"
          },
          data:{status:"ACCEPTED"}
        }),
        prisma.pushSubscription.update({
          where:{id:subscription.id},
          data:{
            lastPushAt:now,
            lastError:null
          }
        })
      ]);

      results.push({
        userId:subscription.userId,
        deviceId:subscription.id,
        deviceName:subscription.deviceName,
        status:"ACCEPTED",
        httpStatus:response.statusCode
      });
    }catch(error){
      const statusCode=(error as {statusCode?:number}).statusCode;
      const expired=statusCode===404||statusCode===410;
      const message=errorMessage(error);

      await prisma.$transaction([
        prisma.notificationLog.update({
          where:{id:log.id},
          data:{
            status:expired?"EXPIRED":"FAILED",
            message:`${input.title} — ${message}`
          }
        }),
        prisma.pushSubscription.update({
          where:{id:subscription.id},
          data:{
            enabled:expired?false:subscription.enabled,
            lastError:message
          }
        })
      ]);

      results.push({
        userId:subscription.userId,
        deviceId:subscription.id,
        deviceName:subscription.deviceName,
        status:expired?"EXPIRED":"FAILED",
        httpStatus:statusCode,
        error:message
      });
    }
  }

  return results;
}
