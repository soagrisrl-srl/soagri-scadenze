import { getSession } from "@/lib/auth";import { App } from "@/components/app";import { Login } from "@/components/login";
export const dynamic="force-dynamic";
export default async function Page(){const session=await getSession();return session?<App session={session}/>:<Login/>}
