# So.Agri Scadenze

Applicazione web privata per gestire le scadenze aziendali da computer, telefono e TV. La V1 include login con ruoli, creazione e modifica, presa in carico, rimando, completamento e ricorrenze, checklist, ricerca, calendario, vista TV, storico attività e cestino.

## Avvio locale

Servono Node.js 20.9 o successivo e npm (oppure pnpm).

```bash
npm install
npm run dev
```

Aprire `http://localhost:3000`. Senza configurazione database l'app usa automaticamente `data/local-db.json`, creato al primo avvio con dati dimostrativi. Account demo: `domenico@soagri.local`, password `soagri2026`. Cambiare la password prima di un uso reale.

## Variabili ambiente

Copiare `.env.example` in `.env.local`. Non commettere mai questo file su GitHub. `AUTH_SECRET` deve essere una stringa casuale lunga. `ADMIN_PASSWORD` stabilisce la password temporanea comune usata dalla V1; per la produzione impostarne una robusta.

## Database PostgreSQL

In locale non è obbligatorio configurarlo. In produzione impostare `DATABASE_URL`: l'app passerà automaticamente dal file locale a PostgreSQL tramite Prisma.

```bash
npm run db:generate
npm run db:push       # prima configurazione
npm run db:migrate    # migrazioni versionate successive
npm run db:seed
```

Il modello comprende utenti, scadenze, audit log, sottoscrizioni push e log notifiche. I dati demo locali sono separati e non vengono copiati automaticamente in produzione.

## Controlli e build

```bash
npm run lint
npm run typecheck
npm test
npm run build
```

## Deploy su Vercel e collegamento GitHub

1. Creare un repository vuoto nell'account GitHub So.Agri e caricare questa cartella.
2. In Vercel scegliere **Add New Project** e importare il repository.
3. Aggiungere `DATABASE_URL`, `AUTH_SECRET`, `ADMIN_EMAIL` e `ADMIN_PASSWORD` nelle variabili del progetto.
4. Eseguire una volta `npm run db:push` contro il database PostgreSQL scelto.
5. Distribuire. Il comando di build è già compatibile con Vercel.

## Notifiche e PWA

Manifest e service worker rendono l'app installabile. Il service worker non mette in cache API o dati aziendali. Per il Web Push valorizzare le chiavi VAPID indicate in `.env.example`; senza chiavi l'interfaccia mostra chiaramente che il push va configurato. Il modello database per sottoscrizioni e log è già presente.

## Vista TV

Dopo il login aprire **TV**. Il pulsante a destra attiva lo schermo intero. La vista alterna lentamente priorità e timeline, usa caratteri grandi e torna al pannello normale con il pulsante di chiusura.

## Utenti e ruoli

- **Admin**: configurazione e gestione completa.
- **Gestore**: crea, modifica, prende in carico, rimanda e completa.
- **Visualizzatore**: sola consultazione.

Gli utenti iniziali demo sono Domenico, Flavio e Giuseppe. La struttura non dipende dai loro nomi ed è pronta per una futura gestione utenti completa. Per questa V1 l'accesso usa la password bootstrap da ambiente; prima di aprire l'app a Internet è consigliato collegare Auth.js o un provider aziendale mantenendo i ruoli già presenti.
