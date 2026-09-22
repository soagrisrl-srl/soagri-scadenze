import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { pushConfigured } from "@/lib/push";

export const runtime="nodejs";

export async function GET(){
  const session=await getSession();
  if(!session)return NextResponse.json({error:"Non autorizzato"},{status:401});

  const devices=await prisma.pushSubscription.count({
    where:{userId:session.id,enabled:true}
  });

  return NextResponse.json({
    configured:pushConfigured(),
    devices
  });
}
