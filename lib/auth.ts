import { cookies } from "next/headers";
import { SignJWT, jwtVerify } from "jose";
import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import type { Role } from "@/types";
import { readDb } from "./store";
const secret=new TextEncoder().encode(process.env.AUTH_SECRET||"soagri-local-development-secret-change-me");
export type Session={id:string;name:string;role:Role;active:boolean;canManageEvents:boolean};
export async function signSession(s:Session){return new SignJWT(s).setProtectedHeader({alg:"HS256"}).setIssuedAt().setExpirationTime("7d").sign(secret)}
export async function getSession():Promise<Session|null>{try{if(process.env.NODE_ENV==="production"&&!process.env.AUTH_SECRET)return null;const token=(await cookies()).get("soagri_session")?.value;if(!token)return null;const payload=(await jwtVerify(token,secret)).payload;const user=(await readDb()).users.find(u=>u.id===payload.id);if(!user?.active)return null;return{id:user.id,name:user.name,role:user.role,active:user.active,canManageEvents:user.canManageEvents}}catch{return null}}
export function hashPassword(password:string):string{const salt=randomBytes(16).toString("hex");return `scrypt:${salt}:${scryptSync(password,salt,64).toString("hex")}`}
export function verifyPassword(password:string,hash?:string):boolean{
  if(hash?.startsWith("scrypt:")){const [,salt,value]=hash.split(":");const expected=Buffer.from(value,"hex");const actual=scryptSync(password,salt,expected.length);return timingSafeEqual(expected,actual)}
  const bootstrap=process.env.ADMIN_PASSWORD||(process.env.NODE_ENV==="production"?undefined:"soagri2026");
  return Boolean(bootstrap&&password===bootstrap);
}
