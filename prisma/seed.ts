import { prisma } from "../lib/prisma";
import { createSeed } from "../lib/seed";

async function main(){
  const initial=createSeed().users;
  for(const entry of initial){
    const existing=await prisma.user.findUnique({where:{email:entry.email}});
    if(existing){
      if(entry.id==="u2"&&existing.name==="Flavio"){
        await prisma.user.update({where:{id:existing.id},data:{name:"Flavio D"}});
      }
      continue;
    }
    await prisma.user.create({
      data:{...entry,id:await prisma.user.findUnique({where:{id:entry.id}})?undefined:entry.id,passwordHash:"bootstrap-via-env"}
    });
  }
  console.log("Utenti iniziali verificati senza modificare account già configurati.");
}

main().finally(()=>prisma.$disconnect());
