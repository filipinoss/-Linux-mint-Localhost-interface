# MC Hosting Panel

Self-hosted web dashboard for managing Minecraft servers on **Linux**.
multi-server console, file browser, world backups, image gallery, wallpapers.

---

## Requirements

- **Python 3.10+**
- **pip** (`sudo apt install python3-pip`)
- **A Minecraft server folder** (vanilla, Forge, Paper, etc.)
- **Java 17+** (only if starting the server from the dashboard)

```bash
sudo apt install python3 python3-pip python3-venv
pip install -r core/requirements.txt
```

---

## Quick Start

```bash
cd mc-hosting/core
./start.sh
```

Or manually:

```bash
cd mc-hosting/core
uvicorn main:app --host 0.0.0.0 --port 3000
```

Open **http://localhost:3000** in your browser.

---

## First-Time Setup

1. **Log in** with `admin` / `admin`
2. Go to the **Servers** tab (bottom bar)
3. Click **+ Add Server**
4. Fill in:
   - **Server name** — e.g. "My Survival World"
   - **Path** — click **Browse** to pick your MC server folder, or type the path
   - **Starter file** — usually `run.sh` or your server JAR name
   - **RAM** — drag the slider to set memory
5. Click **Save**, go to **Dashboard**, click **Start**

---

## Features

| Tab | What it does |
|-----|-------------|
| **Dashboard** | Live console, CPU/RAM gauges, player list, start/stop/restart |
| **Files** | Browse and edit server files |
| **Backups** | Create/restore/delete world backups (auto-named, no compression) |
| **Servers** | Add, switch, or delete servers |
| **Admin** | Manage users and permissions (owner only) |
| **Settings** | Custom colors, wallpapers, profile picture, panel style |

---

## Access from other devices

The dashboard binds to `0.0.0.0:3000`. Find your LAN IP with `ip a` and open `http://<lan-ip>:3000`. The current host:port is shown in the nav bar next to the clock.

---

## Project Structure

```
mc-hosting/
├── AGENTS.md          — AI session memory
├── README.md
├── SUMMARY.md         — technical summary
├── roadmap.md         — changelog
├── .gitignore
├── backups/           — world backups (one folder per server)
├── uploads/           — user images, pfps, wallpapers
├── data/              — SQLite database
└── core/
    ├── main.py        — FastAPI server
    ├── auth.py        — authentication + user/server management
    ├── server_manager.py — MC server process control
    ├── backup_manager.py  — backup/restore logic
    ├── system_stats.py    — CPU/RAM/disk metrics
    ├── start.sh       — launcher script
    ├── requirements.txt
    └── web/
        ├── index.html
        ├── css/style.css
        └── js/ (app, login, console, dashboard, files, backups, settings)
```

---

## Default Login

| Username | Password | Role |
|----------|----------|------|
| `admin` | `admin` | Owner |

---

## Notes

- Backups use folder copy (fast, no compression — more disk space)
- Session tokens are in-memory; remember cookie persists across restarts
- Custom colors override the Catppuccin base theme
