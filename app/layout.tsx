import type { Metadata,Viewport } from "next";import "./globals.css";import { ServiceWorker } from "@/components/service-worker";
export const metadata:Metadata={title:"So.Agri Scadenze",description:"Gestione semplice delle scadenze aziendali",manifest:"/manifest.webmanifest",appleWebApp:{capable:true,title:"So.Agri"}};
export const viewport:Viewport={themeColor:"#155c3d",width:"device-width",initialScale:1,viewportFit:"cover"};
export default function Layout({children}:{children:React.ReactNode}){return <html lang="it"><body>{children}<ServiceWorker/></body></html>}
