# XL Peptides Sales Dashboard — React + Express

A two-part rebuild of the XL Peptides sales dashboard:

- **`frontend/`** — React + Vite, deploy to **Vercel**
- **`backend/`** — Node.js + Express, deploy to **Oracle Cloud**

The frontend never talks to WooCommerce directly. It calls the Express
backend, which holds your WooCommerce Consumer Key/Secret and does all the
reporting math server-side, exactly like the original PHP version — just in
Node now instead of PHP.

```
woo-dashboard/
├── frontend/   → see frontend/README.md for Vercel deployment
├── backend/    → see backend/README.md for Oracle Cloud deployment
└── README.md   → you are here
```

## Quick start (local, with sample data)

You can explore the whole UI right now with zero setup:

```bash
cd frontend
npm install
npm run dev
```

Open `http://localhost:5173`. `VITE_DEMO_MODE=true` by default, so every
page works immediately with generated sample data (clearly labeled with a
banner) and no backend or WooCommerce store required.

## Connecting to your real WooCommerce store

### Step 1 — Generate WooCommerce REST API keys
1. WordPress Admin → **WooCommerce → Settings → Advanced → REST API → Add key**
2. Description: "Sales Dashboard". Permissions: **Read**.
3. Click **Generate API key** and copy both values immediately — the secret
   is shown only once:
   - `ck_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx`
   - `cs_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx`

### Step 2 — Deploy the backend to Oracle Cloud
Follow **`backend/README.md`** in full — it covers provisioning the instance,
installing Node, running the API under PM2, and putting nginx + a free
Let's Encrypt certificate in front of it. You'll paste the keys from Step 1
into the backend's `.env` file there, never into the frontend.

### Step 3 — Deploy the frontend to Vercel
Follow **`frontend/README.md`**. You'll set two environment variables in the
Vercel dashboard: your backend's HTTPS URL, and `VITE_DEMO_MODE=false`.

### Step 4 — Connect the two
Set the backend's `FRONTEND_URL` to your exact Vercel URL and restart it.
CORS and the cross-domain login cookie both depend on this matching exactly.

## Architecture at a glance

```
┌─────────────────┐        HTTPS, credentials: include        ┌──────────────────┐        HTTPS         ┌───────────────┐
│  React frontend  │ ───────────────────────────────────────▶ │  Express backend  │ ───────────────────▶ │  WooCommerce   │
│  (Vercel)         │ ◀─────────────────────────────────────── │  (Oracle Cloud)    │ ◀─────────────────── │  REST API v3   │
└─────────────────┘        JSON + httpOnly session cookie     └──────────────────┘                        └───────────────┘
```

- The browser holds an httpOnly session cookie after login — never the
  WooCommerce credentials, never a JWT it can read or tamper with.
- The backend caches WooCommerce responses in memory for 5 minutes by
  default, so switching date ranges repeatedly doesn't hammer your store's
  API.
- All reporting math (gross/net sales, refunds, customer lifetime value,
  etc.) happens in `backend/src/services/aggregations.js`, fully documented
  at the top of that file.

## Metric definitions, testing checklist, and security notes

See `backend/README.md` sections 4 and 5. The definitions match the
original PHP build exactly, so numbers won't shift if you compare the two
implementations.
