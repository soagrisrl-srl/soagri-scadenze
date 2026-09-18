import { prisma } from "../lib/prisma";import { createSeed } from "../lib/seed";
async function main(){const seed=createSeed();for(const u of seed.users)await prisma.user.upsert({where:{email:u.email},update:{name:u.name,role:u.role,color:u.color},create:{...u,passwordHash:"login-gestito-tramite-ADMIN_PASSWORD"}});console.log("Utenti iniziali creati. I dati demo locali non vengono copiati automaticamente in produzione.")}
main().finally(()=>prisma.$disconnect());
