import webpush from "web-push";
import { prisma } from "./prisma";

export type PushPayload={
  title:string;
  body:string;
  url?:string;
  tag?:string;
};

export type PushResult={
  userId:string;
  devices:number;
  sent:number;
  failed:number;
  removed:number;
};

export function pushConfigured(){
  return Boolean(
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY &&
    process.env.VAPID_PRIVATE_KEY &&
    process.env.VAPID_SUBJECT
  );
}

function configure(){
  if(!pushConfigured())throw new Error("Web Push non configurato");

  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT!,
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
    process.env.VAPID_PRIVATE_KEY!
  );
}

export async function sendPushToUsers(userIds:string[],payload:PushPayload):Promise<PushResult[]>{
  configure();

  const ids=[...new Set(userIds.filter(Boolean))];
  const rows=new Map<string,PushResult>(
    ids.map(id=>[id,{userId:id,devices:0,sent:0,failed:0,removed:0}])
  );

  if(!ids.length)return [];

  const subscriptions=await prisma.pushSubscription.findMany({
    where:{userId:{in:ids},enabled:true}
  });

  const seen=new Set<string>();

  for(const subscription of subscriptions){
    if(seen.has(subscription.endpoint))continue;
    seen.add(subscription.endpoint);

    const row=rows.get(subscription.userId);
    if(!row)continue;

    row.devices++;

    try{
      await webpush.sendNotification(
        {
          endpoint:subscription.endpoint,
          keys:{p256dh:subscription.p256dh,auth:subscription.auth}
        },
        JSON.stringify(payload),
        {TTL:86400}
      );
      row.sent++;
    }catch(error){
      const code=(error as {statusCode?:number}).statusCode;

      if(code===404||code===410){
        await prisma.pushSubscription.deleteMany({
          where:{endpoint:subscription.endpoint}
        });
        row.removed++;
      }else{
        row.failed++;
      }
    }
  }

  return ids.map(id=>rows.get(id)!);
}
