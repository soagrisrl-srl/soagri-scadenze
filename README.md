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

Copiare `.env.example` in `.env.local`. Non commettere mai questo file su GitHub. `AUTH_SECRET` deve essere una stringa casuale lunga. `ADMIN_PASSWORD` resta la password temporanea degli account iniziali finché un amministratore non assegna loro password individuali. I nuovi utenti ricevono sempre una password personale dal form.

## Database PostgreSQL

In locale non è obbligatorio configurarlo. In produzione impostare `DATABASE_URL`: l'app passerà automaticamente dal file locale a PostgreSQL tramite Prisma.

Database PostgreSQL **nuovo**:

```bash
npm run db:generate
npm run db:migrate
npm run db:seed
```

Se il database PostgreSQL era già stato creato con `db:push` prima dell'introduzione delle migrazioni, registrare una sola volta lo schema precedente e applicare l'aggiornamento senza cancellare dati:

```bash
npx prisma migrate resolve --applied 20260918000000_initial
npm run db:migrate
npm run db:seed
```

Se il database contiene già entrambi i nuovi campi `active` e `canManageEvents`, registrare anche `20260919120000_user_permissions` come applicata invece di eseguirla di nuovo.

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
4. Eseguire una volta le migrazioni e il seed secondo il caso indicato sopra.
5. Distribuire. Il comando di build è già compatibile con Vercel.

## Notifiche e PWA

Manifest e service worker rendono l'app installabile. Il service worker non mette in cache API o dati aziendali. Per il Web Push valorizzare le chiavi VAPID indicate in `.env.example`; senza chiavi l'interfaccia mostra chiaramente che il push va configurato. Il modello database per sottoscrizioni e log è già presente.

## Vista TV

Dopo il login aprire **TV**. Il pulsante a destra attiva lo schermo intero. La vista alterna lentamente priorità e timeline, usa caratteri grandi e torna al pannello normale con il pulsante di chiusura.

## Utenti e ruoli

- **Admin**: configurazione e gestione completa.
- **Gestore**: crea, modifica, prende in carico, rimanda e completa se ha il permesso di gestione scadenze.
- **Visualizzatore**: sola consultazione.

Gli utenti iniziali sono Domenico, Giuseppe, Flavio D e Flavio G, distinti. L'ID del precedente account Flavio rimane associato a Flavio D, così le assegnazioni esistenti restano valide. Tutti e quattro possono gestire le scadenze. L'admin trova **Utenti e permessi** in Impostazioni: può creare utenti, cambiare ruolo, assegnare il permesso di gestione, disattivare account e impostare password individuali. Gli account disattivati mantengono lo storico ma non possono accedere. I nuovi utenti non ricevono la password bootstrap.
