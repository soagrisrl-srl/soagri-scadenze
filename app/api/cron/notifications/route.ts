import { createHash } from "node:crypto";
import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendPushToUsers } from "@/lib/push";

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
  const [y,m,d]=value.split("-").map(Number);
  return Math.floor(Date.UTC(y,m-1,d)/86400000);
}

function reminderText(days:number){
  if(days===0)return "Scade oggi";
  if(days===1)return "Scade domani";
  return `Scade tra ${days} giorni`;
}

function notificationId(deadlineId:string,userId:string,due:string,days:number){
  return "push_"+createHash("sha256")
    .update(`${deadlineId}|${userId}|${due}|${days}`)
    .digest("hex")
    .slice(0,40);
}

export async function GET(req:Request){
  const secret=process.env.CRON_SECRET;
  const authorization=req.headers.get("authorization");

  if(!secret||authorization!==`Bearer ${secret}`){
    return NextResponse.json({error:"Non autorizzato"},{status:401});
  }

  const today=todayRome();

  const [deadlines,activeUsers]=await Promise.all([
    prisma.deadLine.findMany(),
    prisma.user.findMany({
      where:{active:true},
      select:{id:true}
    })
  ]);

  const activeIds=new Set(activeUsers.map(u=>u.id));

  let checked=0;
  let sent=0;
  let skipped=0;
  let failed=0;

  for(const deadline of deadlines){
    if(deadline.deletedAt||deadline.archivedAt)continue;
    if(["COMPLETED","CANCELLED"].includes(deadline.status))continue;

    const due=deadline.dueDate.toISOString().slice(0,10);
    const days=dayNumber(due)-dayNumber(today);

    if(!deadline.reminders.includes(days))continue;

    const recipients=[...new Set(deadline.notifyIds)]
      .filter(id=>activeIds.has(id));

    if(!recipients.length)continue;

    checked++;

    for(const userId of recipients){
      const id=notificationId(deadline.id,userId,due,days);

      try{
        await prisma.notificationLog.create({
          data:{
            id,
            userId,
            deadlineId:deadline.id,
            channel:"PUSH_REMINDER",
            status:"PROCESSING",
            message:`${deadline.title} — ${reminderText(days)}`
          }
        });
      }catch(error){
        if(error instanceof Prisma.PrismaClientKnownRequestError&&error.code==="P2002"){
          skipped++;
          continue;
        }
        throw error;
      }

      try{
        const [result]=await sendPushToUsers([userId],{
          title:`So.Agri — ${deadline.title}`,
          body:`${reminderText(days)} · ${deadline.category}`,
          url:"/",
          tag:`deadline-${deadline.id}-${due}-${days}`
        });

        const delivered=result?.sent||0;
        sent+=delivered;

        await prisma.notificationLog.update({
          where:{id},
          data:{
            status:delivered>0?"SENT":"NO_DEVICE",
            message:`${deadline.title} — ${reminderText(days)}`
          }
        });
      }catch(error){
        failed++;

        await prisma.notificationLog.update({
          where:{id},
          data:{
            status:"FAILED",
            message:`${deadline.title} — ${(error as Error).message}`
          }
        });
      }
    }
  }

  return NextResponse.json({
    ok:true,
    date:today,
    checked,
    sent,
    skipped,
    failed
  });
}
