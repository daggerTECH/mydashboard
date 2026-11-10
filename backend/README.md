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

## 6. Enabling real Conversion Rate (Google Analytics 4)

By default the Sales Overview page shows "Requires Google Analytics 4
integration" for Conversion Rate instead of a number — the dashboard never
estimates a conversion rate from order counts alone. Follow these steps to
turn it on for real: **Conversion rate = WooCommerce orders ÷ GA4 sessions**
for the same date range.

### a. Find your GA4 Property ID
In Google Analytics: **Admin** (gear icon) → under the "Property" column,
click **Property details**. The Property ID is the number shown near the top
(e.g. `123456789`) — not the "G-XXXXXXX" Measurement ID, which is different.

### b. Create a Google Cloud service account
1. Go to the [Google Cloud Console](https://console.cloud.google.com/), create
   a project if you don't have one already (it's free, no billing required
   for this).
2. **APIs & Services → Library**, search for **Google Analytics Data API**,
   click **Enable**.
3. **APIs & Services → Credentials → Create Credentials → Service account**.
   Give it any name (e.g. "xl-peptides-dashboard"), skip the optional role
   grants, click **Done**.
4. Click into the service account you just created → **Keys** tab →
   **Add Key → Create new key → JSON**. This downloads a `.json` file —
   this is the only copy of the private key, keep it safe.

### c. Give that service account access to your GA4 property
Back in Google Analytics: **Admin → Property Access Management → +  →
Add users**. Paste in the service account's email address (it looks like
`xl-peptides-dashboard@your-project.iam.gserviceaccount.com`, found in the
JSON file as `client_email`), role **Viewer**, save.

### d. Upload the key file to your Oracle Cloud instance
```bash
scp -i your-key.pem ga4-service-account.json ubuntu@<instance-ip>:~/xl-peptides-backend/
ssh -i your-key.pem ubuntu@<instance-ip>
cd ~/xl-peptides-backend
chmod 600 ga4-service-account.json   # only the app's user can read it
```

### e. Update `.env` and restart
```bash
nano .env
```
Set:
```
GA4_ENABLED=true
GA4_PROPERTY_ID=123456789
GOOGLE_APPLICATION_CREDENTIALS=./ga4-service-account.json
```
Then:
```bash
pm2 restart xl-peptides-api
```

### f. Verify
Reload the dashboard. The Conversion Rate card should now show a real
percentage. If it still shows "Requires Google Analytics 4 integration,"
check the backend's logs for the actual reason:
```bash
pm2 logs xl-peptides-api --lines 50
```
Common causes: the service account wasn't added to the GA4 property (step c),
the property ID is the Measurement ID instead of the numeric Property ID
(step a), or the JSON key path in `.env` doesn't match where you uploaded it.

A GA4 failure for any reason — wrong property, revoked key, API quota, GA4
itself being down — never breaks the rest of the Sales Overview page; every
other KPI card keeps working normally and only Conversion Rate falls back to
"unavailable."

## 7. Marketing & Ads tab (channel attribution + Google Ads)

Adds channel attribution, Google Ads spend, and ACOS/ROAS/TACOS to the
dashboard as a new "Marketing & Ads" section — no separate dashboard, same
date-range filter as everything else. Two independent pieces:

**Always on, no setup needed:** Sales by Channel and Attribution Detail read
straight from WooCommerce's built-in Order Attribution meta fields (already
present on every order since WooCommerce 8.5+), the same way the rest of this
backend reads orders. Nothing to configure.

**Optional, needs its own credentials:** Ad spend, ACOS, ROAS, TACOS, and the
Campaign Performance table all need Google Ads connected. Off by default —
those cards show "Requires Google Ads integration" until you set it up below.

### a. Confirm your WooCommerce version supports Order Attribution
WooCommerce → Plugins → check the WooCommerce version is 8.5 or later.
Attribution data only exists for orders placed after it was enabled —
earlier orders will always show "Unknown," which is correct, not a bug.

### b. Check your Google Ads tracking template
For per-campaign ACOS to work, your Google Ads final URL suffix needs to
pass the campaign name (or ID) as a UTM parameter, e.g.:
```
utm_source=google&utm_medium=cpc&utm_campaign={campaignname}
```
In Google Ads: **Settings → Account settings → Tracking → Tracking template /
Final URL suffix**. If this isn't set, Google Ads data will still show
totals (ad spend, ACOS Google-reported), but the Campaign Performance table
will show every campaign as "(unmatched)" — store orders/revenue/ACOS(Store)
will be blank for all of them, because there's no way to tell which
WooCommerce order came from which campaign.

### c. Apply for Google Ads API access
1. In your Google Ads account: **Tools & Settings → API Center**. Apply for a
   **Developer Token** (Basic access is enough for reading your own account's
   data; Google reviews applications, which can take a few days — start this
   early).
2. While waiting, you can use a **Test** developer token against a Google Ads
   **test account** to build/verify the integration, then switch to the real
   token once approved.

### d. Create OAuth credentials and a refresh token
1. [Google Cloud Console](https://console.cloud.google.com/) → **APIs &
   Services → Credentials → Create Credentials → OAuth client ID** → type
   **Desktop app**. This gives you a Client ID and Client Secret.
2. Generate a one-time refresh token by running Google's official
   [OAuth2 generation script](https://github.com/googleads/google-ads-python/blob/main/examples/authentication/generate_user_credentials.py)
   (Python) or any OAuth2 "installed app" flow with scope
   `https://www.googleapis.com/auth/adwords` — sign in with the Google
   account that has access to the Google Ads account you want to read. This
   produces a **refresh token** that doesn't expire until revoked.
3. Find your **Customer ID** in the Google Ads UI (top right, format
   `123-456-7890` — enter it in `.env` as digits only, no dashes). If you
   access this account through a manager (MCC) account, also set
   `GOOGLE_ADS_LOGIN_CUSTOMER_ID` to the MCC's customer ID.

### e. Set the backend's `.env` and restart
```
GOOGLE_ADS_ENABLED=true
GOOGLE_ADS_CLIENT_ID=...
GOOGLE_ADS_CLIENT_SECRET=...
GOOGLE_ADS_DEVELOPER_TOKEN=...
GOOGLE_ADS_REFRESH_TOKEN=...
GOOGLE_ADS_CUSTOMER_ID=1234567890
```
```bash
pm2 restart xl-peptides-api
```

### f. Verify
Reload the Marketing & Ads tab. Ad spend, ACOS, ROAS and TACOS should show
real numbers. If a card still shows "Requires Google Ads integration," check
`pm2 logs xl-peptides-api` for the actual error — same fail-soft pattern as
GA4: a wrong customer ID, an unapproved developer token, or a revoked refresh
token logs a clear message server-side and falls back gracefully rather than
breaking the page.

### Where each number comes from (the short note the brief's acceptance
checklist asks for — see `src/services/marketing.js` for the full version
with code):

| Metric | Formula | Source |
|---|---|---|
| Channel | Classified from WooCommerce's `_wc_order_attribution_*` order meta — see `src/services/channelMapping.js` for the exact rules (the one editable place to adjust them) | WooCommerce |
| Sales by Channel (gross/net/AOV) | Same gross/net sales formulas as the Sales Overview page, grouped by Channel | WooCommerce |
| Ad spend | Sum of `metrics.cost_micros ÷ 1,000,000` across campaigns/days in range | Google Ads |
| Google Ads revenue (store) | Net sales of orders whose Channel = "Google Ads" | WooCommerce |
| **ACOS (Store)** — the headline number | Ad spend ÷ Google Ads revenue (store) | Both |
| ACOS (Google-reported) | Ad spend ÷ Google Ads' own `metrics.conversions_value` | Google Ads |
| Gap | Google-reported conversion value − store-attributed revenue; a sudden jump usually means tracking broke | Both |
| ROAS | Inverse of ACOS (Store) | Both |
| TACOS | Ad spend ÷ total store net sales (every channel) | Both |
| Campaign-level matching | WooCommerce `utm_campaign` matched against Google Ads campaign name/ID (exact or substring match); unmatched campaigns show "—" for store columns rather than a guess | Both |

Every ratio divides safely: zero orders, zero spend, or zero sessions shows
"—" on the dashboard, never a fabricated 0% or a crash.
