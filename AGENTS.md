# MC Hosting Panel — Project Spis

## Identity

| Item | Value |
|------|-------|
| Project | Self-hosted web dashboard for MC server |
| Design | iOS 26 Liquid Glass (adaptive transparency, contextual blur, material realism) |
| Platform | Linux Mint, same machine as MC server |

## Stack

Backend: FastAPI → Uvicorn → port 3000
Frontend: Vanilla JS SPA, xterm.js, CSS Custom Properties
Auth: SHA-256 + SQLite + in-memory token dict + httponly cookie autologin
DB: SQLite (data/users.db)
Stats: psutil

## File Structure

```
mc-hosting/
├── AGENTS.md, roadmap.md
├── backups/
├── core/
│   ├── main.py, auth.py, server_manager.py, system_stats.py, backup_manager.py
│   ├── start.sh, requirements.txt
│   └── web/
│       ├── index.html
│       ├── css/style.css
│       └── js/ (app.js, login.js, console.js, dashboard.js, files.js, backups.js, settings.js)
├── data/users.db
└── uploads/ (pfps/, wallpapers/, images/)
```

## API Endpoints

| Method | Route | Description |
|--------|-------|-------------|
| POST | `/api/auth/login` | Login → token + user + remember cookie |
| POST | `/api/auth/logout` | Remove token + cookies |
| POST | `/api/auth/cookie-login` | Cookie → fresh session |
| POST | `/api/auth/register` | Create account |
| GET | `/api/me?token=` | User info |
| POST | `/api/upload/pfp` | Profile picture |
| POST | `/api/upload/wallpaper` | Wallpaper |
| POST | `/api/upload/image` | Upload image to gallery |
| GET | `/api/images?token=` | List current user's images |
| POST | `/api/images/{filename}/set-pfp?token=` | Set image as profile picture |
| GET | `/api/fs/list?path=&token=` | Browse filesystem directories |
| GET/POST/DELETE | `/api/servers` | List/add/delete servers |
| PUT | `/api/servers/{id}` | Update server |
| GET | `/api/status?server_id=X` | Server status + stats |
| POST | `/api/server/{start,stop,restart}?server_id=X` | MC server control |
| GET | `/api/files?path=&server_id=X` | List/read files |
| POST | `/api/files/write` | Save file (+ server_id in body) |
| DELETE | `/api/files?path=&server_id=X` | Delete file |
| GET | `/api/backups/worlds?server_id=X` | List worlds |
| GET | `/api/players` | Current players |
| GET | `/api/backups?server_id=X` | List backups |
| POST | `/api/backups/create?server_id=X` | Create backup (auto-named) |
| POST | `/api/backups/{name}/restore?server_id=X` | Restore world |
| DELETE | `/api/backups/{name}?server_id=X` | Delete backup |
| GET/PUT/DELETE | `/api/admin/users/...` | Admin CRUD |
| GET | `/api/admin/plan` | Content of roadmap.md |
| WS | `/ws/console?server_id=X` | MC stdout + commands |
| WS | `/ws/metrics?server_id=X` | CPU/RAM/disk every 2s |

## Auth Flow

1. Login → POST /api/auth/login → session token (in-memory) + remember cookie (httponly, 30d)
2. Page load → checkAuth() tries localStorage token, then cookie
3. Logout → removes token + cookie + DB record
4. Permissions: JSON in DB, frontend hides `.tab-item` based on `user.permissions`

Credentials: `admin`/`admin` + `admines`/`admineček` (both owner, built-in, cannot be deleted)

## Design System

**9 themes**: Catppuccin, Tokyo Night, Nord, Dracula, Gruvbox, Everforest, iOS Light, iOS Dark, iOS Graphite
**Panel Style**: Glass (default) / Solid (`data-style="glass|solid"`)
**Font**: `-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', system-ui, sans-serif`

### Custom Colors
19 CSS variables (--base, --mantle, ..., --peach), edit via color picker, stored in localStorage('mc-custom-colors')

## Run

```bash
cd /path/to/mc-hosting/core
pip install -r requirements.txt
uvicorn main:app --host 0.0.0.0 --port 3000
```

*(Linux only)*

## Server Info

Multiple servers supported via `servers` SQLite table. Per-server console/metrics/players/backups. RAM override in starter script via `-Xms/-Xmx`. Auto-named backups: `YYYYMMDD-HHmm-backupN`. On first launch, reads `core/server_path.txt` if no servers in DB.


## Rules

1. Read this spis before starting work
2. Only write to AGENTS.md, do not create new memory files
3. Keep roadmap.md in sync

## Known Limitations

1. Backups without compression (shutil.copytree)
2. Session tokens in memory (remember cookie solves this)
3. No Docker
4. Only catppuccin base theme (custom colors picker provides full customization)
5. File browser starts from /home on Linux