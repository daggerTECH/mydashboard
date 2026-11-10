# XL Peptides Dashboard — Frontend (React + Vite, for Vercel)

```
frontend/
├── index.html
├── public/
│   ├── logo.png             Full-color logo (light backgrounds)
│   ├── logo-on-dark.png     Logo with black→white swap, used in the dark UI
│   └── favicon.ico, favicon-*.png, apple-touch-icon.png
├── src/
│   ├── main.jsx, App.jsx
│   ├── index.css             Dark theme — same design tokens as the backend's brand
│   ├── context/
│   │   ├── DashboardContext.jsx   Auth state, date range, currency, connection status
│   │   └── ToastContext.jsx
│   ├── components/            Sidebar, Topbar, Login, OrderModal, charts/, States.jsx
│   ├── pages/                 One file per sidebar page
│   └── lib/
│       ├── api.js             Talks to the Express backend (or demo data)
│       ├── demoData.js        Generated sample data for DEMO_MODE
│       ├── format.js          Currency/date/CSV helpers
│       └── chartTheme.js      Chart.js theming shared by all charts
└── .env.example
```

## 1. Local development

```bash
npm install
cp .env.example .env.local
npm run dev
```

Opens at `http://localhost:5173`. With `VITE_DEMO_MODE=true` (the default),
the dashboard works immediately with generated sample data — no backend
needed. Set it to `false` and point `VITE_API_BASE_URL` at your backend
(`http://localhost:4000` for local, or your Oracle Cloud URL) to use real
WooCommerce data.

## 2. Deploying to Vercel

1. Push this `frontend/` folder to a GitHub repo (or just the `frontend`
   subfolder of a monorepo — Vercel lets you set a root directory).
2. In Vercel: **Add New → Project**, import the repo.
3. **Root Directory**: set to `frontend` if this is part of a monorepo with
   the backend alongside it.
4. **Framework Preset**: Vite (auto-detected).
5. **Environment Variables** — add both, for all environments:
   - `VITE_API_BASE_URL` → your Oracle Cloud backend's HTTPS URL, e.g. `https://api.yourdomain.com`
   - `VITE_DEMO_MODE` → `false`
6. Deploy. Vercel builds with `npm run build` and serves the `dist/` output automatically.

After the first deploy, copy the exact Vercel URL (e.g.
`https://xl-peptides-dashboard.vercel.app`) and set it as `FRONTEND_URL` in
the **backend's** `.env` on Oracle Cloud, then restart the backend
(`pm2 restart xl-peptides-api`). CORS and the session cookie both depend on
this matching exactly.

## 3. Demo mode vs. live mode

| | Demo mode (`VITE_DEMO_MODE=true`) | Live mode (`VITE_DEMO_MODE=false`) |
|---|---|---|
| Data source | Generated in-browser, deterministic per date range | Real WooCommerce data via your Express backend |
| Login | Bypassed entirely | Required — calls `/api/auth/login` on the backend |
| Banner | Yellow "Demo data" banner shown on every page | None |
| Use case | Preview the UI, demo to stakeholders, UI development | Production |

A failed *live* request never falls back to demo data — it shows a proper
error state with a Retry button. Demo mode is a separate, explicit, clearly
labeled path, never a silent substitute for a broken connection.

## 4. Brand assets

`public/logo-on-dark.png` was generated from `Logo_Final-1.png` by converting
its black fill to white (the brand blue `#26ACE2` dots/letterform are
untouched) so it reads clearly on the dashboard's dark background. If you
update the logo later, regenerate this variant rather than dropping the
original file in directly — a logo with black text will be invisible on the
sidebar and login screen.

The brand blue (`#26ACE2`) is set as `--blue` / `--brand` in `src/index.css`
and used for the active sidebar item, primary buttons, and the "Gross sales"
chart series, so it stays consistent everywhere.

## 5. Marketing & Ads tab

`src/pages/Marketing.jsx` needs no frontend configuration — it just calls
the backend's marketing endpoints. Sales by Channel and Attribution Detail
work as soon as the backend is connected to WooCommerce; the ad-spend
cards (Ad spend, ACOS, ROAS, TACOS, Campaign Performance) show "Requires
Google Ads integration" until Google Ads is connected on the backend side
(see `backend/README.md` section 7). Demo mode generates realistic sample
data for all of it, including a mix of matched and unmatched campaigns, so
you can see the full layout before connecting anything real.

## 6. Build locally (sanity check before deploying)

```bash
npm run build
npm run preview   # serves the production build at http://localhost:4173
```
