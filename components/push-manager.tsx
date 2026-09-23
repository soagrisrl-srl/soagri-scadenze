"use client";

import { useCallback,useEffect,useMemo,useState } from "react";
import {
  Bell,
  BellRing,
  CheckCircle2,
  CircleAlert,
  Loader2,
  RefreshCw,
  Send,
  Smartphone
} from "lucide-react";
import type { Deadline,User } from "@/types";
import type { Session } from "@/lib/auth";
import {
  configureCurrentDevice,
  inspectCurrentDevice,
  isIOS,
  isStandalone
} from "./push-client";

type Device={
  id:string;
  userId:string;
  deviceName:string|null;
  platform:string|null;
  browser:string|null;
  enabled:boolean;
  createdAt:string;
  lastSeenAt:string;
  lastPushAt:string|null;
  lastReceivedAt:string|null;
  lastDisplayedAt:string|null;
  lastError:string|null;
};

type DevicesResponse={
  configured:boolean;
  devices:Device[];
};

function dt(value:string|null){
  if(!value)return 0;
  return new Date(value).getTime();
}

function prettyDate(value:string|null){
  if(!value)return "mai";

  return new Intl.DateTimeFormat("it-IT",{
    day:"2-digit",
    month:"2-digit",
    hour:"2-digit",
    minute:"2-digit"
  }).format(new Date(value));
}

function deliveryState(device:Device){
  if(!device.enabled){
    return {
      label:"Registrazione scaduta",
      tone:"error"
    };
  }

  const push=dt(device.lastPushAt);
  const received=dt(device.lastReceivedAt);
  const displayed=dt(device.lastDisplayedAt);

  if(push&&displayed>=push){
    return {
      label:"Ricevuta e affidata alle notifiche del dispositivo",
      tone:"ok"
    };
  }

  if(push&&received>=push){
    return {
      label:"Ricevuta dal dispositivo",
      tone:"ok"
    };
  }

  if(push){
    return {
      label:"Accettata dal servizio push, attendo conferma dal dispositivo",
      tone:"wait"
    };
  }

  return {
    label:"Dispositivo collegato",
    tone:"ok"
  };
}

async function realTest(deviceIds:string[]){
  const response=await fetch("/api/push/test",{
    method:"POST",
    headers:{"Content-Type":"application/json"},
    body:JSON.stringify({deviceIds})
  });

  const result=await response.json();

  if(!response.ok){
    throw new Error(result.error||"Test non riuscito");
  }

  return result;
}

export function PushOnboarding({session}:{session:Session}){
  const [open,setOpen]=useState(false);
  const [busy,setBusy]=useState(false);
  const [message,setMessage]=useState("");
  const [needsInstall,setNeedsInstall]=useState(false);

  useEffect(()=>{
    let cancelled=false;

    (async()=>{
      try{
        const state=await inspectCurrentDevice();

        if(cancelled)return;

        if(!state.registered){
          setNeedsInstall(Boolean(state.needsInstall));
          setMessage(state.reason||"");
          setOpen(true);
        }
      }catch{
        if(!cancelled)setOpen(true);
      }
    })();

    return()=>{cancelled=true};
  },[session.id]);

  async function configure(){
    setBusy(true);
    setMessage("");

    try{
      const result=await configureCurrentDevice();

      if(result.needsInstall){
        setNeedsInstall(true);
        setMessage(
          "Su iPhone/iPad apri So.Agri da Safari, premi Condividi → Aggiungi alla schermata Home, poi apri l'icona So.Agri."
        );
        return;
      }

      if(!result.registered||!result.deviceId){
        throw new Error("Dispositivo non registrato.");
      }

      await realTest([result.deviceId]);

      setMessage(
        "Dispositivo collegato. Ho appena inviato una notifica di prova REALE usando lo stesso motore delle scadenze."
      );
    }catch(error){
      setMessage(
        error instanceof Error
          ? error.message
          : "Configurazione non riuscita."
      );
    }finally{
      setBusy(false);
    }
  }

  if(!open)return null;

  const iosInstructions=
    needsInstall||(typeof navigator!=="undefined"&&isIOS()&&!isStandalone());

  return <div className="push-onboarding-backdrop">
    <section className="push-onboarding">
      <div className="push-onboarding-icon">
        <BellRing/>
      </div>

      <span className="eyebrow">SO.AGRI NOTIFICHE</span>
      <h2>Configura questo dispositivo</h2>

      {iosInstructions
        ? <>
            <p>
              Su iPhone/iPad le notifiche funzionano dalla web app
              installata sulla schermata Home.
            </p>

            <ol>
              <li>Apri So.Agri in Safari.</li>
              <li>Premi <b>Condividi</b>.</li>
              <li>Premi <b>Aggiungi alla schermata Home</b>.</li>
              <li>Apri So.Agri dalla nuova icona.</li>
              <li>Premi <b>Configura notifiche</b>.</li>
            </ol>
          </>
        : <p>
            Questo dispositivo non è ancora collegato alle notifiche
            di {session.name}. Configuralo una volta sola.
          </p>
      }

      {message&&
        <div className="push-onboarding-message">{message}</div>
      }

      <div className="push-onboarding-actions">
        {!iosInstructions&&
          <button
            className="primary"
            disabled={busy}
            onClick={configure}
          >
            {busy
              ? <Loader2 className="spin"/>
              : <BellRing/>
            }
            Configura notifiche
          </button>
        }

        <button
          className="secondary"
          onClick={()=>setOpen(false)}
        >
          {message.includes("Dispositivo collegato")
            ?"Chiudi"
            :"Ricordamelo dopo"}
        </button>
      </div>
    </section>
  </div>
}

export function PushManager({
  items,
  users,
  session
}:{
  items:Deadline[];
  users:User[];
  session:Session;
}){
  const [devices,setDevices]=useState<Device[]>([]);
  const [configured,setConfigured]=useState(false);
  const [busy,setBusy]=useState("");
  const [message,setMessage]=useState("");

  const activeUsers=useMemo(
    ()=>users.filter(user=>user.active),
    [users]
  );

  const load=useCallback(async()=>{
    const response=await fetch("/api/push/devices",{
      cache:"no-store"
    });

    if(!response.ok)return;

    const result=await response.json() as DevicesResponse;

    setDevices(result.devices);
    setConfigured(result.configured);
  },[]);

  useEffect(()=>{
    void load();
  },[load]);

  function poll(){
    setTimeout(()=>void load(),1000);
    setTimeout(()=>void load(),3000);
    setTimeout(()=>void load(),7000);
  }

  async function configureThisDevice(){
    setBusy("configure");
    setMessage("");

    try{
      const result=await configureCurrentDevice();

      if(result.needsInstall){
        setMessage(
          "Su iPhone aggiungi prima So.Agri alla schermata Home, poi aprila dall'icona e riprova."
        );
        return;
      }

      if(!result.deviceId){
        throw new Error("Registrazione del dispositivo non riuscita.");
      }

      await load();

      await realTest([result.deviceId]);

      setMessage(
        "Telefono collegato. Test reale inviato: ora il gestore controlla anche se il dispositivo lo riceve."
      );

      poll();
    }catch(error){
      setMessage(
        error instanceof Error
          ? error.message
          : "Configurazione non riuscita."
      );
    }finally{
      setBusy("");
    }
  }

  async function testDevices(ids:string[]){
    if(!ids.length){
      setMessage("Nessun dispositivo collegato da testare.");
      return;
    }

    setBusy("test");
    setMessage("");

    try{
      const result=await realTest(ids);

      const accepted=(result.results||[])
        .filter((row:{status:string})=>row.status==="ACCEPTED")
        .length;

      setMessage(
        `Test reale inviato a ${accepted}/${ids.length} dispositivi. Attendo la conferma di ricezione dai telefoni.`
      );

      await load();
      poll();
    }catch(error){
      setMessage(
        error instanceof Error
          ? error.message
          : "Test non riuscito."
      );
    }finally{
      setBusy("");
    }
  }

  const visibleUsers=session.role==="ADMIN"
    ? activeUsers
    : activeUsers.filter(user=>user.id===session.id);

  return <div className="content narrow">
    <div className="notice-hero">
      <Bell/>
      <h2>Gestore notifiche</h2>
      <p>
        Qui vedi i dispositivi realmente collegati all&apos;app.
      </p>
    </div>

    {!configured&&
      <div className="push-warning">
        <CircleAlert/>
        Configurazione server delle notifiche incompleta.
      </div>
    }

    <div className="push-manager-actions">
      <button
        className="primary"
        disabled={busy!==""}
        onClick={configureThisDevice}
      >
        <Smartphone/>
        Collega questo dispositivo
      </button>

      <button
        className="secondary"
        disabled={busy!==""||!devices.some(d=>d.enabled)}
        onClick={()=>testDevices(
          devices.filter(d=>d.enabled).map(d=>d.id)
        )}
      >
        {busy==="test"
          ? <Loader2 className="spin"/>
          : <Send/>
        }
        Test reale su tutti
      </button>

      <button
        className="icon-btn"
        aria-label="Aggiorna dispositivi"
        onClick={()=>void load()}
      >
        <RefreshCw/>
      </button>
    </div>

    {message&&
      <div className="push-message">{message}</div>
    }

    <div className="push-users">
      {visibleUsers.map(user=>{
        const userDevices=devices.filter(
          device=>device.userId===user.id
        );

        return <section className="push-user-card" key={user.id}>
          <header>
            <span
              className="push-user-avatar"
              style={{background:user.color}}
            >
              {user.name[0]}
            </span>

            <div>
              <h3>{user.name}</h3>
              <p>
                {userDevices.filter(d=>d.enabled).length}
                {" "}
                dispositiv
                {userDevices.filter(d=>d.enabled).length===1?"o":"i"}
                {" "}
                collegat
                {userDevices.filter(d=>d.enabled).length===1?"o":"i"}
              </p>
            </div>
          </header>

          {userDevices.length===0
            ? <div className="push-no-device">
                <CircleAlert/>
                Nessun telefono o computer configurato.
                Quando {user.name} entra nell&apos;app da un nuovo
                dispositivo, So.Agri gli chiederà di configurarlo.
              </div>
            : <div className="push-device-list">
                {userDevices.map(device=>{
                  const state=deliveryState(device);

                  return <article
                    className={`push-device ${device.enabled?"":"disabled"}`}
                    key={device.id}
                  >
                    <div className="push-device-top">
                      <Smartphone/>

                      <div>
                        <b>
                          {device.deviceName||
                            `${device.platform||"Dispositivo"} · ${device.browser||"Browser"}`}
                        </b>

                        <small>
                          Ultimo collegamento:
                          {" "}
                          {prettyDate(device.lastSeenAt)}
                        </small>
                      </div>

                      <span className={`push-state ${state.tone}`}>
                        {state.tone==="ok"
                          ? <CheckCircle2/>
                          : <CircleAlert/>
                        }
                        {state.label}
                      </span>
                    </div>

                    <div className="push-device-details">
                      <span>
                        Ultimo invio:
                        {" "}
                        {prettyDate(device.lastPushAt)}
                      </span>

                      <span>
                        Ricevuta dall&apos;app:
                        {" "}
                        {prettyDate(device.lastReceivedAt)}
                      </span>

                      <span>
                        Affidata al sistema:
                        {" "}
                        {prettyDate(device.lastDisplayedAt)}
                      </span>
                    </div>

                    {device.lastError&&
                      <div className="push-device-error">
                        {device.lastError}
                      </div>
                    }

                    {device.enabled&&
                      <button
                        className="secondary"
                        disabled={busy!==""}
                        onClick={()=>testDevices([device.id])}
                      >
                        <Send/>
                        Testa questo dispositivo
                      </button>
                    }
                  </article>
                })}
              </div>
          }
        </section>
      })}
    </div>

    <div className="push-manager-note">
      <b>Importante</b>
      <p>
        Il test usa esattamente lo stesso motore che invia
        le notifiche delle scadenze. “Accettata” da sola non
        basta più: il telefono deve anche confermare la ricezione.
      </p>
    </div>

    <div className="push-deadline-summary">
      Scadenze attive considerate dal sistema: {items.length}
    </div>
  </div>
}
