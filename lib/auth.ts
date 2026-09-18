import { cookies } from "next/headers";
import { SignJWT, jwtVerify } from "jose";
import type { Role } from "@/types";
const secret=new TextEncoder().encode(process.env.AUTH_SECRET||"soagri-local-development-secret-change-me");
export type Session={id:string;name:string;role:Role};
export async function signSession(s:Session){return new SignJWT(s).setProtectedHeader({alg:"HS256"}).setIssuedAt().setExpirationTime("7d").sign(secret)}
export async function getSession():Promise<Session|null>{try{const token=(await cookies()).get("soagri_session")?.value;if(!token)return null;return (await jwtVerify(token,secret)).payload as unknown as Session}catch{return null}}
