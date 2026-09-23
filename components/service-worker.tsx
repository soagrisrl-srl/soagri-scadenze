"use client";

import { useEffect } from "react";

export function ServiceWorker(){
  useEffect(()=>{
    if(!("serviceWorker" in navigator))return;

    navigator.serviceWorker
      .register("/sw.js",{updateViaCache:"none"})
      .then(async registration=>{
        try{
          await registration.update();
        }catch{
          // non bloccare l'app
        }
      })
      .catch(error=>{
        console.error(
          "Registrazione Service Worker So.Agri fallita",
          error
        );
      });
  },[]);

  return null;
}
