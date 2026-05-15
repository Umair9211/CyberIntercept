# CyberIntercept

A local HTTP(S) intercept and traffic-inspection dashboard. **FastAPI** powers capture and control; **Next.js** provides the UI. Traffic is routed through **mitmproxy** (started by the backend when you turn on capture).

---

## What you need

| Tool | Purpose |
|------|---------|
| **Node.js** 18+ | Frontend and root dev scripts |
| **Python** 3.10+ | Backend API and mitmproxy |
| **FoxyProxy** (browser extension) | Send browser traffic through the capture proxy |
| **mitmproxy** | Installed via backend `requirements.txt`; issues the HTTPS trust certificate |

---

## Project layout

```
CyberIntercept/
├── backend/          # FastAPI + mitmproxy addon
├── frontend/         # Next.js dashboard
├── package.json      # Root scripts (run both apps together)
└── README.md
```

| Service | Default URL | Port |
|---------|-------------|------|
| Frontend (dashboard) | http://localhost:3000 | **3000** |
| Backend (API) | http://localhost:8000 | **8000** |
| Capture proxy (mitm) | `127.0.0.1` — **you choose** in the UI | e.g. **8080** |

> **Important:** The proxy port in the dashboard must **not** be `3000` or `8000` (those are used by the frontend and backend). Use another port, such as **8080**, and use the **same port** in FoxyProxy.

---

## Installation

### 1. Backend (Python)

```bash
cd backend
python -m venv venv
source venv/bin/activate          # Windows: venv\Scripts\activate
pip install -r requirements.txt
```

### 2. Frontend (Node)

```bash
cd frontend
npm install
npm run build
```

Optional: `frontend/.env` already sets the API URL. To change it:

```env
NEXT_PUBLIC_BACKEND_URL=http://localhost:8000
```

### 3. Root (monorepo dev tools)

From the **repository root**:

```bash
npm install
```

This installs `concurrently` so you can start backend and frontend with one command.

---

## Running the app

### Option A — Both services in one terminal (recommended)

From the **repository root**, with the backend venv activated (or `uvicorn` available on your PATH):

```bash
npm run dev
```

This starts:

- **Backend** — `uvicorn app.main:app --reload --port 8000`
- **Frontend** — Next.js dev server on port **3000**

### Option B — Separate terminals

**Terminal 1 — backend**

```bash
cd backend
source venv/bin/activate
uvicorn app.main:app --reload --port 8000
```

Or from root: `npm run backend`

**Terminal 2 — frontend**

```bash
cd frontend
npm run dev -- --webpack
or 
npm run build
npm start
```

Or from root: `npm run frontend`

Open the dashboard: **http://localhost:3000**

---

## Browser proxy setup (FoxyProxy)

1. Install **[FoxyProxy](https://getfoxyproxy.org/)** for [Firefox](https://addons.mozilla.org/firefox/addon/foxyproxy-standard/) or [Chrome](https://chrome.google.com/webstore/detail/foxyproxy/gcknhkkoolaabfmlnjonogaaifnjlfnp).
2. Add a new proxy:
   - **Host:** `127.0.0.1` or `localhost`
   - **Port:** same as **Proxy port** in the dashboard (e.g. `8080`)
   - **Type:** HTTP (or as FoxyProxy labels it for a local forward proxy)
3. Do **not** use ports **3000** or **8000** — those are the frontend and API.
4. Leave FoxyProxy **off** until capture is running (see workflow below).

---

## HTTPS: mitmproxy certificate

Encrypted sites (HTTPS) only work after you trust mitmproxy’s CA certificate.

### Get the certificate

**After capture is ON** (mitmproxy listening on your chosen port), use either:

| Method | Link / location |
|--------|------------------|
| **mitm.it** (easiest while proxy is active) | [http://mitm.it](http://mitm.it) — open in the browser **with FoxyProxy enabled** and the same proxy port; follow the page for your OS/browser |
| **Official docs** | [mitmproxy — Certificates](https://docs.mitmproxy.org/stable/concepts/certificates/) |
| **File on disk** (after mitm has run at least once) | `~/.mitmproxy/mitmproxy-ca-cert.pem` (Linux/macOS) or `%USERPROFILE%\.mitmproxy\mitmproxy-ca-cert.pem` (Windows) |

### Import in Firefox

1. Open **Settings** → **Privacy & Security**.
2. Scroll to **Certificates** → **View Certificates…**.
3. **Authorities** tab → **Import…**.
4. Select `mitmproxy-ca-cert.pem` (or the file downloaded from mitm.it).
5. Check **Trust this CA to identify websites** → **OK**.
6. Restart Firefox if HTTPS still fails.

### Import in Google Chrome

Chrome uses the system certificate store on many platforms.

**Windows / macOS**

1. Open **Settings** → **Privacy and security** → **Security** → **Manage certificates** (wording may vary).
2. **Trusted Root Certification Authorities** (or **Authorities**) → **Import**.
3. Choose `mitmproxy-ca-cert.pem` → place in **Trusted Root** / enable trust for SSL.
4. Restart Chrome.

**Linux**

Chrome often uses NSS. Example with `certutil` (install `libnss3-tools` if needed):

```bash
certutil -d sql:$HOME/.pki/nssdb -A -t "C,," -n "mitmproxy" -i ~/.mitmproxy/mitmproxy-ca-cert.pem
```

Then restart Chrome. Alternatively, use the **mitm.it** installer for Linux from [http://mitm.it](http://mitm.it) while the proxy is on.

> Without this step, HTTPS sites may show certificate errors or fail to load while capture is enabled.

---

## Typical workflow

1. **Install** dependencies (backend, frontend, root) as above.
2. **Start** the stack: `npm run dev` from the project root (or run backend + frontend separately).
3. Open **http://localhost:3000**.
4. In **Session controls**, set **Proxy port** (e.g. `8080`) — not `3000` or `8000`.
5. Turn **Capture** **ON** (starts mitmproxy on that port).
6. In FoxyProxy, set the proxy to `127.0.0.1` / `localhost` on the **same port** (e.g. `8080`) and **enable** the proxy.
7. Import the **mitmproxy certificate** if you need HTTPS (see above).
8. Browse your target sites; traffic appears in **Intercepted traffic**.
9. Optional: turn **Intercept** **ON** to pause requests for forward/drop; use **Payload** from the request inspector for fuzzing.

Turn **Capture** **OFF** and disable FoxyProxy when you are done.

---

## Root npm scripts

| Script | Command |
|--------|---------|
| `npm run dev` | Backend + frontend together |
| `npm run backend` | FastAPI only (`:8000`) |
| `npm run frontend` | Next.js only (`:3000`) |

---

## Troubleshooting

| Issue | What to check |
|-------|----------------|
| Dashboard can’t reach API | Backend running on `8000`; `NEXT_PUBLIC_BACKEND_URL` in `frontend/.env` |
| No traffic in the table | FoxyProxy on; port matches dashboard **Proxy port**; **Capture** is ON |
| HTTPS certificate errors | Import mitmproxy CA; visit [mitm.it](http://mitm.it) with proxy enabled |
| Port already in use | Pick another proxy port (e.g. `8081`) in UI and FoxyProxy |
| `mitmdump` not found | Activate venv; `pip install -r backend/requirements.txt` |
| New tab shows capture OFF | Refresh or switch tabs; state syncs from the backend after load |

---

## Development notes

- Backend and frontend are separate apps; the root `package.json` only orchestrates dev commands.
- Do not point the capture proxy at ports **3000** or **8000**.
- Multiple dashboard tabs share capture/intercept state via the backend and browser storage.

---

## License

See repository license file if present.
