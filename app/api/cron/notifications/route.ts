import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { dispatchPush } from "@/lib/push";

export const runtime="nodejs";
export const dynamic="force-dynamic";

function todayRome(){
  return new Intl.DateTimeFormat("en-CA",{
    timeZone:"Europe/Rome",
    year:"numeric",
    month:"2-digit",
    day:"2-digit"
  }).format(new Date());
}

function dayNumber(value:string){
  const [year,month,day]=value.split("-").map(Number);

  return Math.floor(
    Date.UTC(year,month-1,day)/86400000
  );
}

function reminderText(days:number){
  if(days===0)return "Scade oggi";
  if(days===1)return "Scade domani";
  return `Scade tra ${days} giorni`;
}

export async function GET(req:Request){
  const secret=process.env.CRON_SECRET;
  const authorization=req.headers.get("authorization");

  if(
    !secret||
    authorization!==`Bearer ${secret}`
  ){
    return NextResponse.json(
      {error:"Non autorizzato"},
      {status:401}
    );
  }

  const today=todayRome();

  const [deadlines,users]=await Promise.all([
    prisma.deadLine.findMany(),
    prisma.user.findMany({
      where:{active:true},
      select:{id:true}
    })
  ]);

  const activeIds=new Set(users.map(user=>user.id));

  let checked=0;
  let accepted=0;
  let noDevice=0;
  let failed=0;
  let skipped=0;

  for(const deadline of deadlines){
    if(deadline.deletedAt||deadline.archivedAt)continue;
    if(["COMPLETED","CANCELLED"].includes(deadline.status))continue;

    const due=deadline.dueDate.toISOString().slice(0,10);
    const days=dayNumber(due)-dayNumber(today);

    if(!deadline.reminders.includes(days))continue;

    const recipients=[
      ...new Set(deadline.notifyIds)
    ].filter(id=>activeIds.has(id));

    if(!recipients.length)continue;

    checked++;

    const channel=`PUSH_REMINDER:${due}:${days}`;

    for(const userId of recipients){
      const alreadyDelivered=
        await prisma.notificationLog.findFirst({
          where:{
            deadlineId:deadline.id,
            userId,
            channel,
            status:{
              in:[
                "ACCEPTED",
                "RECEIVED",
                "DISPLAYED"
              ]
            }
          }
        });

      if(alreadyDelivered){
        skipped++;
        continue;
      }

      const results=await dispatchPush({
        userIds:[userId],
        deadlineId:deadline.id,
        channel,
        title:`So.Agri — ${deadline.title}`,
        body:`${reminderText(days)} · ${deadline.category}`,
        url:"/",
        tag:`deadline-${deadline.id}-${due}-${days}`
      });

      accepted+=results.filter(
        result=>result.status==="ACCEPTED"
      ).length;

      noDevice+=results.filter(
        result=>result.status==="NO_DEVICE"
      ).length;

      failed+=results.filter(
        result=>["FAILED","EXPIRED"].includes(result.status)
      ).length;
    }
  }

  return NextResponse.json({
    ok:true,
    date:today,
    checked,
    accepted,
    noDevice,
    failed,
    skipped
  });
}
