# XL Peptides Dashboard — Backend (Express, for Oracle Cloud)

A small Express API that sits between the React dashboard and your WooCommerce
store. It holds your WooCommerce Consumer Key/Secret, authenticates the
dashboard user, and does all the sales/revenue/refund aggregation server-side.

```
backend/
├── src/
│   ├── server.js              Express app entry point
│   ├── config.js              Loads and validates .env
│   ├── middleware/auth.js     Login/logout, JWT cookie session, requireAuth
│   ├── services/
│   │   ├── wooClient.js       WooCommerce REST API client (axios)
│   │   ├── cache.js           In-memory TTL cache
│   │   ├── aggregations.js    All the sales/revenue/refund/product math
│   │   └── sanitize.js        Input validation helpers
│   └── routes/
│       ├── auth.js            /api/auth/login, /logout, /me
│       └── data.js            Every dashboard data endpoint
├── package.json
└── .env.example
```

## 1. Local development

```bash
npm install
cp .env.example .env
# edit .env — at minimum set WC_STORE_URL, WC_CONSUMER_KEY, WC_CONSUMER_SECRET,
# DASHBOARD_PASSWORD_HASH, and JWT_SECRET (see .env.example for how to generate these)
npm run dev
```

The server listens on `http://localhost:4000` by default. Point the frontend's
`VITE_API_BASE_URL` at this address for local testing.

## 2. Deploying to Oracle Cloud (Always Free tier works fine)

These steps assume an Ubuntu 22.04/24.04 Compute instance. Adjust package
manager commands if you're on Oracle Linux.

### a. Provision the instance
1. Create a VM.Standard.E2.1.Micro (or similar) instance in the OCI console.
2. In the instance's **Virtual Cloud Network → Security List**, add ingress
   rules for ports **80** and **443** (and temporarily 4000 if you want to
   test before putting nginx in front).
3. SSH in: `ssh -i your-key.pem ubuntu@<instance-public-ip>`

### b. Install Node.js and PM2
```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs
sudo npm install -g pm2
```

### c. Upload and configure the backend
```bash
# from your local machine
scp -i your-key.pem -r backend ubuntu@<instance-ip>:~/xl-peptides-backend

# on the instance
cd ~/xl-peptides-backend
npm install --omit=dev
cp .env.example .env
nano .env   # fill in real WooCommerce keys, generate DASHBOARD_PASSWORD_HASH and JWT_SECRET
```

Generate the two secrets directly on the instance so they're never typed
anywhere else:
```bash
node -e "console.log(require('bcryptjs').hashSync('your-password', 10))"
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

Set `FRONTEND_URL` in `.env` to your exact Vercel URL (e.g.
`https://xl-peptides-dashboard.vercel.app`), and `NODE_ENV=production`.

### d. Run it under PM2 (keeps it alive across reboots/crashes)
```bash
pm2 start src/server.js --name xl-peptides-api
pm2 save
pm2 startup   # follow the printed command to enable on-boot startup
```

### e. Put nginx in front with HTTPS
```bash
sudo apt-get install -y nginx certbot python3-certbot-nginx
```

Create `/etc/nginx/sites-available/xl-peptides-api`:
```nginx
server {
    listen 80;
    server_name api.yourdomain.com;

    location / {
        proxy_pass http://localhost:4000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```
```bash
sudo ln -s /etc/nginx/sites-available/xl-peptides-api /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
sudo certbot --nginx -d api.yourdomain.com   # issues + auto-renews a free TLS cert
```

Your API is now live at `https://api.yourdomain.com`. Use that as
`VITE_API_BASE_URL` in the frontend's Vercel environment variables.

**Note on the login cookie:** because the frontend (Vercel) and backend
(Oracle Cloud) are different domains, the session cookie is set with
`SameSite=None; Secure`, which requires HTTPS on the backend — don't skip the
certbot step, cross-site cookies silently fail over plain HTTP.

### f. Updating the backend later
```bash
# re-upload changed files, then:
pm2 restart xl-peptides-api
```

## 3. Environment variables reference

See `.env.example` for the full list with comments. The important ones:

| Variable | Purpose |
|---|---|
| `FRONTEND_URL` | Exact Vercel origin, for CORS — must match exactly, no trailing slash |
| `WC_STORE_URL`, `WC_CONSUMER_KEY`, `WC_CONSUMER_SECRET` | Your WooCommerce REST API credentials (Read-only key recommended) |
| `DASHBOARD_USERNAME`, `DASHBOARD_PASSWORD_HASH` | The single dashboard login (bcrypt hash, never the plain password) |
| `JWT_SECRET` | Signs the session cookie — keep this secret and don't rotate it while people are logged in |
| `CACHE_TTL_SECONDS` | How long WooCommerce responses are cached in memory (default 5 minutes) |
| `RATE_LIMIT_MAX` / `RATE_LIMIT_WINDOW_MS` | Throttles requests per IP to protect the WooCommerce API from being hammered |

## 4. Security notes

- Consumer Key/Secret and the JWT secret live only in `.env` on the server, never in the frontend or in version control (`.gitignore` already excludes `.env`).
- Use a **Read-only** WooCommerce API key — this backend never writes to WooCommerce.
- The session cookie is httpOnly (inaccessible to JavaScript) and signed, so it can't be read or forged from the browser.
- `helmet` sets standard security headers; `express-rate-limit` throttles abusive clients before they can hammer WooCommerce.
- Every error response is JSON with a generic message — stack traces are never sent to the client (see the central error handler in `server.js`).

## 5. Metric definitions

Documented in full in the header comment of `src/services/aggregations.js` —
the same definitions as the original PHP implementation (gross sales, net
sales, average order value, refund handling, etc.), so figures stay
consistent if you ever compare the two.
