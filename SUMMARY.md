# MC Hosting Panel

Self-hosted web dashboard for managing Minecraft (Forge 1.19.2)
## Stack

| Layer | Technology |
|-------|-----------|
| Backend | FastAPI (Python), Uvicorn |
| Frontend | Vanilla JS SPA, xterm.js, CSS Custom Properties |
| Auth | SHA-256 hashing, SQLite, in-memory session tokens, httponly cookie autologin (30d) |
| Database | SQLite (`data/users.db`) |
| OS stats | psutil |
| HTTP client | httpx (for random wallpaper fetch) |

## Files

```
mc-hosting/
├── AGENTS.md          — project spis for AI sessions
├── SUMMARY.md         — this file
├── roadmap.md         — roadmap / changelog
├── backups/           — server world backups
├── uploads/           — user images, pfps, wallpapers
├── data/users.db      — SQLite DB
└── core/
    ├── main.py        — FastAPI app: all API routes, WebSocket, file ops
    ├── auth.py        — user CRUD, session tokens, remember cookies, server CRUD
    ├── server_manager.py — MinecraftServer class: start/stop/command/console
    ├── backup_manager.py — BackupManager: copytree backups, auto-naming
    ├── system_stats.py   — psutil wrappers for CPU/RAM/disk
    ├── start.sh       — launcher script
    ├── server_path.txt — optional first-launch server path
    ├── requirements.txt
    └── web/
        ├── index.html — SPA shell: nav, tab bar, all views
        ├── css/style.css — iOS Liquid Glass theme, dashboard layout, components
        └── js/
            ├── app.js       — auth flow, nav, server selector, settings, admin panel, file browser
            ├── login.js     — login/register overlay
            ├── dashboard.js — gauges, player list, status/metrics WS
            ├── console.js   — xterm.js terminal with WebSocket
            ├── files.js     — file tree browser + editor
            ├── backups.js   — backup CRUD
            └── settings.js  — wallpaper upload, style toggle, random wallpaper
```

## Features

- Multi-server management: add/delete/switch servers via Servers tab
- Dashboard: live CPU/RAM/disk gauges, console terminal, player list, info cards
- Console: xterm.js terminal with full MC server input/output via WebSocket
- File browser: tree view + text editor for server files
- Backups: auto-named (`YYYYMMDD-HHmm-backupN`), restore with pre-restore safety copy
- Picture uploads: per-user image gallery, click to set as profile picture
- Wallpapers: upload custom, fetch random (picsum.photos), or remove (default gradient)
- Nav bar shows current host:port for LAN access
- Custom colors: 19 CSS variable picker, stored in localStorage
- Glass/Solid panel style toggle
- Admin panel: user management, permissions, roadmap viewer
- Remember me: httponly cookie autologin (30 days)
- Avatar dropdown: create account, login as another, logout

## Auth

Built-in admin accounts: `admin`/`admin`, `admines`/`admineček` (owner role)

## Run

```bash
cd /path/to/mc-hosting/core
pip install -r requirements.txt
uvicorn main:app --host 0.0.0.0 --port 3000
```

## Access

The server binds to `0.0.0.0:3000`, accessible from any device on the same LAN.

| From | URL |
|------|-----|
| Same machine | `http://localhost:3000` |
| LAN (any device) | `http://<server-lan-ip>:3000` |

The current host:port is displayed in the nav bar (next to the clock). First-time setup: `start.sh` prompts for the server path, or add servers later via the web UI Servers tab.
