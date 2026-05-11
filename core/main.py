import asyncio
import json
import os
import shutil
import time
import re
from contextlib import asynccontextmanager

from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException, UploadFile, File, Form, Request
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles

from server_manager import MinecraftServer
from system_stats import get_stats, get_process_stats
from backup_manager import BackupManager
from auth import (init_db, init_servers_table, authenticate, get_user_by_token,
                  logout as auth_logout, create_user, update_pfp, update_wallpaper,
                  list_users, delete_user, update_user, update_permissions,
                  create_remember_token, get_user_by_remember_token,
                  delete_remember_token, create_session_token,
                  create_server, list_servers, delete_server as db_delete_server, get_server)

UPLOAD_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "uploads"))
PLAN_PATH = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "roadmap.md"))

server_instances: dict[int, MinecraftServer] = {}
backup_managers: dict[int, BackupManager] = {}
console_clients: dict[int, set[WebSocket]] = {}
metrics_clients: dict[int, set[WebSocket]] = {}
current_players: dict[int, set[str]] = {}


def require_auth(token: str | None) -> dict:
    if not token:
        raise HTTPException(401, "Not authenticated")
    user = get_user_by_token(token)
    if not user:
        raise HTTPException(401, "Invalid token")
    return user


def require_admin(token: str | None) -> dict:
    user = require_auth(token)
    if user["role"] not in ("owner", "admin"):
        raise HTTPException(403, "Admin access required")
    return user


def get_server_instance(server_id: int) -> MinecraftServer:
    if server_id not in server_instances:
        sv = get_server(server_id)
        if not sv:
            raise HTTPException(404, "Server not found")
        server_instances[server_id] = MinecraftServer(sv["id"], sv["name"], sv["path"], sv["starter_file"], sv["ram_mb"])
        backup_managers[server_id] = BackupManager(sv["name"], sv["path"])
        console_clients[server_id] = set()
        metrics_clients[server_id] = set()
        current_players[server_id] = set()
    return server_instances[server_id]


def get_backup_manager(server_id: int) -> BackupManager:
    if server_id not in backup_managers:
        get_server_instance(server_id)
    return backup_managers[server_id]


async def broadcast_console(server_id: int):
    server = get_server_instance(server_id)
    clients = console_clients[server_id]
    players = current_players[server_id]
    async for line in server.read_output():
        line_lower = line.lower()
        if "joined the game" in line_lower:
            m = re.search(r'\]\s*(.+?)\s+joined the game', line)
            if m:
                players.add(m.group(1).strip())
        elif "left the game" in line_lower:
            m = re.search(r'\]\s*(.+?)\s+left the game', line)
            if m:
                players.discard(m.group(1).strip())
        msg = json.dumps({"type": "output", "data": line})
        for client in list(clients):
            try:
                await client.send_text(msg)
            except Exception:
                clients.discard(client)


async def broadcast_metrics():
    while True:
        for sid in list(server_instances.keys()):
            clients = metrics_clients.get(sid, set())
            if clients:
                server = server_instances[sid]
                stats, proc = await asyncio.gather(
                    get_stats(),
                    get_process_stats(server.pid) if server.running else asyncio.sleep(0, None),
                )
                msg = json.dumps({
                    "type": "metrics", "server_id": sid,
                    "data": stats, "process": proc,
                    "running": server.running,
                    "players": sorted(list(current_players.get(sid, set()))),
                })
                for client in list(clients):
                    try:
                        await client.send_text(msg)
                    except Exception:
                        clients.discard(client)
        await asyncio.sleep(2)


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    init_servers_table()
    svs = list_servers()
    if not svs:
        sp_file = os.path.join(os.path.dirname(__file__), "server_path.txt")
        if os.path.exists(sp_file):
            with open(sp_file) as f:
                sp = f.read().strip()
            if sp:
                svs = [create_server("Default", sp, "run.sh", 4096)]
        if not svs:
            pass  # No default server — user adds one via UI
    for sv in svs:
        server_instances[sv["id"]] = MinecraftServer(sv["id"], sv["name"], sv["path"], sv["starter_file"], sv["ram_mb"])
        backup_managers[sv["id"]] = BackupManager(sv["name"], sv["path"])
        console_clients[sv["id"]] = set()
        metrics_clients[sv["id"]] = set()
        current_players[sv["id"]] = set()
    asyncio.create_task(broadcast_metrics())
    yield
    for s in server_instances.values():
        if s.running:
            await s.stop()


app = FastAPI(lifespan=lifespan)
ALLOWED_EXTENSIONS = {".png", ".jpg", ".jpeg", ".gif", ".webp"}


def _token_from_header(request):
    auth = request.headers.get("Authorization", "")
    if auth.startswith("Bearer "):
        return auth[7:]
    return None


# ── Auth ──

@app.post("/api/auth/login")
async def login(data: dict):
    username = data.get("username", "")
    password = data.get("password", "")
    result = authenticate(username, password)
    if not result:
        raise HTTPException(401, "Invalid username or password")
    response = JSONResponse(result)
    if data.get("remember"):
        remember_token = create_remember_token(username)
        response.set_cookie(key="mc_remember", value=remember_token, max_age=30 * 24 * 60 * 60, httponly=True, samesite="lax")
    return response


@app.post("/api/auth/logout")
async def do_logout(data: dict, request: Request):
    token = data.get("token", "")
    auth_logout(token)
    remember = request.cookies.get("mc_remember")
    if remember:
        delete_remember_token(remember)
    response = JSONResponse({"message": "Logged out"})
    response.delete_cookie("mc_remember")
    return response


@app.post("/api/auth/cookie-login")
async def cookie_login(request: Request):
    remember = request.cookies.get("mc_remember")
    if not remember:
        raise HTTPException(401, "No remember token")
    user = get_user_by_remember_token(remember)
    if not user:
        response = JSONResponse({"error": "Invalid remember token"}, status_code=401)
        response.delete_cookie("mc_remember")
        return response
    token = create_session_token(user["username"])
    return {"token": token, **user}


@app.get("/api/me")
async def get_me(token: str = ""):
    user = require_auth(token or None)
    return user


@app.post("/api/auth/register")
async def register(data: dict):
    username = data.get("username", "").strip()
    password = data.get("password", "")
    if not username or not password:
        raise HTTPException(400, "Username and password required")
    if len(username) < 2 or len(username) > 24:
        raise HTTPException(400, "Username must be 2-24 characters")
    if len(password) < 3:
        raise HTTPException(400, "Password must be at least 3 characters")
    result = create_user(username, password)
    if not result:
        raise HTTPException(409, "Username already taken")
    return result


# ── Server Management ──

@app.get("/api/servers")
async def list_servers_api(token: str = ""):
    require_auth(token or None)
    return list_servers()


@app.post("/api/servers")
async def add_server_api(data: dict, token: str = ""):
    require_admin(token or None)
    name = data.get("name", "").strip()
    path = data.get("path", "").strip()
    starter_file = data.get("starter_file", "run.sh").strip()
    ram_mb = int(data.get("ram_mb", 4096))
    if not name or not path:
        raise HTTPException(400, "Name and path are required")
    sv = create_server(name, path, starter_file, ram_mb)
    server_instances[sv["id"]] = MinecraftServer(sv["id"], sv["name"], sv["path"], sv["starter_file"], sv["ram_mb"])
    backup_managers[sv["id"]] = BackupManager(sv["name"], sv["path"])
    console_clients[sv["id"]] = set()
    metrics_clients[sv["id"]] = set()
    current_players[sv["id"]] = set()
    return sv


@app.put("/api/servers/{server_id}")
async def update_server_api(server_id: int, data: dict, token: str = ""):
    require_admin(token or None)
    srv = get_server(server_id)
    if not srv:
        raise HTTPException(404, "Server not found")
    if server_id in server_instances:
        inst = server_instances[server_id]
        if inst.running:
            raise HTTPException(400, "Stop the server before editing")
        del server_instances[server_id]
        backup_managers.pop(server_id, None)
        console_clients.pop(server_id, None)
        metrics_clients.pop(server_id, None)
        current_players.pop(server_id, None)
    new_name = data.get("name", srv["name"])
    new_path = data.get("path", srv["path"])
    new_starter = data.get("starter_file", srv["starter_file"])
    new_ram = int(data.get("ram_mb", srv["ram_mb"]))
    sv = create_server(new_name, new_path, new_starter, new_ram)
    # Delete old, return new
    db_delete_server(server_id)
    server_instances[sv["id"]] = MinecraftServer(sv["id"], sv["name"], sv["path"], sv["starter_file"], sv["ram_mb"])
    backup_managers[sv["id"]] = BackupManager(sv["name"], sv["path"])
    console_clients[sv["id"]] = set()
    metrics_clients[sv["id"]] = set()
    current_players[sv["id"]] = set()
    return sv


@app.delete("/api/servers/{server_id}")
async def delete_server_api(server_id: int, token: str = ""):
    require_admin(token or None)
    if server_id in server_instances:
        srv = server_instances[server_id]
        if srv.running:
            await srv.stop()
        del server_instances[server_id]
        backup_managers.pop(server_id, None)
        console_clients.pop(server_id, None)
        metrics_clients.pop(server_id, None)
        current_players.pop(server_id, None)
    db_delete_server(server_id)
    return {"message": "Server deleted"}


# ── Admin ──

@app.get("/api/admin/users")
async def admin_list_users(token: str = ""):
    require_admin(token or None)
    return list_users()


@app.delete("/api/admin/users/{username}")
async def admin_delete_user(username: str, token: str = ""):
    require_admin(token or None)
    if not delete_user(username):
        raise HTTPException(400, "Cannot delete built-in admin or user not found")
    return {"message": "User deleted"}


@app.put("/api/admin/users/{username}")
async def admin_update_user(username: str, data: dict, token: str = ""):
    require_admin(token or None)
    updates = {}
    if "password" in data:
        updates["password"] = data["password"]
    if "role" in data:
        updates["role"] = data["role"]
    if "new_username" in data:
        updates["new_username"] = data["new_username"]
    if not updates:
        raise HTTPException(400, "No updates provided")
    if not update_user(username, updates):
        raise HTTPException(400, "Update failed")
    return {"message": "User updated"}


@app.put("/api/admin/users/{username}/permissions")
async def admin_update_permissions(username: str, data: dict, token: str = ""):
    require_admin(token or None)
    perms = data.get("permissions", {})
    if not isinstance(perms, dict):
        raise HTTPException(400, "Permissions must be a dict")
    if not update_permissions(username, perms):
        raise HTTPException(400, "Update failed")
    return {"message": "Permissions updated"}


@app.get("/api/admin/plan")
async def admin_get_plan(token: str = ""):
    require_admin(token or None)
    if os.path.exists(PLAN_PATH):
        with open(PLAN_PATH, "r") as f:
            content = f.read()
        return {"content": content}
    return {"content": "# Roadmap\n\n*No roadmap yet.*"}


# ── Uploads (PFP, Wallpaper, Images) ──

@app.post("/api/upload/pfp")
async def upload_pfp(token: str = Form(...), file: UploadFile = File(...)):
    user = require_auth(token)
    ext = os.path.splitext(file.filename or ".png")[1].lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(400, "Invalid file type. Allowed: png, jpg, gif, webp")
    filename = f"{user['username']}{ext}"
    dest = os.path.join(UPLOAD_DIR, "pfps", filename)
    content = await file.read()
    with open(dest, "wb") as f:
        f.write(content)
    update_pfp(user["username"], filename)
    return {"message": "PFP updated", "filename": filename}


@app.post("/api/upload/wallpaper")
async def upload_wallpaper(token: str = Form(...), file: UploadFile = File(...)):
    user = require_auth(token)
    ext = os.path.splitext(file.filename or ".png")[1].lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(400, "Invalid file type")
    filename = f"{user['username']}_wall{ext}"
    dest = os.path.join(UPLOAD_DIR, "wallpapers", filename)
    content = await file.read()
    with open(dest, "wb") as f:
        f.write(content)
    update_wallpaper(user["username"], filename)
    return {"message": "Wallpaper updated", "filename": filename}


@app.post("/api/wallpaper/remove")
async def remove_wallpaper(token: str = ""):
    user = require_auth(token or None)
    update_wallpaper(user["username"], None)
    return {"message": "Wallpaper removed"}


@app.post("/api/wallpaper/random")
async def random_wallpaper(token: str = ""):
    user = require_auth(token or None)
    import httpx
    url = "https://picsum.photos/1920/1080"
    try:
        async with httpx.AsyncClient(follow_redirects=True, timeout=15) as client:
            resp = await client.get(url)
            content = resp.content
    except Exception:
        raise HTTPException(502, "Failed to fetch random wallpaper")
    filename = f"{user['username']}_wall_random.jpg"
    dest = os.path.join(UPLOAD_DIR, "wallpapers", filename)
    with open(dest, "wb") as f:
        f.write(content)
    update_wallpaper(user["username"], filename)
    return {"message": "Wallpaper updated", "filename": filename}


@app.post("/api/upload/image")
async def upload_image(token: str = Form(...), file: UploadFile = File(...)):
    user = require_auth(token)
    ext = os.path.splitext(file.filename or ".png")[1].lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(400, "Invalid file type")
    filename = f"{int(time.time())}_{user['username']}{ext}"
    images_dir = os.path.join(UPLOAD_DIR, "images")
    os.makedirs(images_dir, exist_ok=True)
    dest = os.path.join(images_dir, filename)
    content = await file.read()
    with open(dest, "wb") as f:
        f.write(content)
    return {"message": "Image uploaded", "filename": filename}


@app.get("/api/images")
async def list_images(token: str = ""):
    user = require_auth(token or None)
    images_dir = os.path.join(UPLOAD_DIR, "images")
    if not os.path.exists(images_dir):
        return {"images": []}
    files = []
    for f_name in sorted(os.listdir(images_dir), reverse=True):
        fp = os.path.join(images_dir, f_name)
        if os.path.isfile(fp) and any(f_name.lower().endswith(ext) for ext in ALLOWED_EXTENSIONS):
            if f"_{user['username']}." in f_name:
                files.append({"filename": f_name, "url": f"/uploads/images/{f_name}", "size": os.path.getsize(fp)})
    return {"images": files}


@app.post("/api/images/{filename}/set-pfp")
async def set_pfp_from_image(filename: str, token: str = ""):
    user = require_auth(token or None)
    src = os.path.join(UPLOAD_DIR, "images", filename)
    if not os.path.isfile(src):
        raise HTTPException(404, "Image not found")
    ext = os.path.splitext(filename)[1].lower()
    dest_filename = f"{user['username']}{ext}"
    dest = os.path.join(UPLOAD_DIR, "pfps", dest_filename)
    with open(src, "rb") as f:
        content = f.read()
    with open(dest, "wb") as f:
        f.write(content)
    update_pfp(user["username"], dest_filename)
    return {"message": "PFP updated", "filename": dest_filename}


@app.get("/api/fs/list")
async def fs_list(path: str = "/", token: str = ""):
    require_auth(token or None)
    target = os.path.abspath(os.path.expanduser(path))
    if not os.path.isdir(target):
        raise HTTPException(400, "Not a directory")
    parent = os.path.dirname(target) if target != "/" else None
    items = []
    try:
        for entry in sorted(os.listdir(target)):
            ep = os.path.join(target, entry)
            if os.path.isdir(ep) and not entry.startswith("."):
                items.append({"name": entry, "path": ep})
    except PermissionError:
        pass
    return {"path": target, "parent": parent, "items": items}


# ── Server Operations (per-server_id) ──

@app.get("/api/status")
async def get_status(server_id: int = 0):
    server = get_server_instance(server_id)
    stats, proc = await asyncio.gather(
        get_stats(),
        get_process_stats(server.pid) if server.running else asyncio.sleep(0, None),
    )
    return {
        "running": server.running,
        "server_path": server.server_path,
        "server_name": server.name,
        "server_id": server.server_id,
        "stats": stats,
        "process": proc,
    }


@app.post("/api/server/start")
async def start_server(server_id: int = 0):
    server = get_server_instance(server_id)
    if server.running:
        return {"message": "Server is already running"}
    ok = await server.start()
    if ok:
        asyncio.create_task(broadcast_console(server_id))
    return {"message": "Server started" if ok else "Failed to start"}


@app.post("/api/server/stop")
async def stop_server(server_id: int = 0):
    server = get_server_instance(server_id)
    if not server.running:
        return {"message": "Server is not running"}
    await server.stop()
    return {"message": "Server stopped"}


@app.post("/api/server/restart")
async def restart_server(server_id: int = 0):
    server = get_server_instance(server_id)
    await server.stop()
    await server.start()
    asyncio.create_task(broadcast_console(server_id))
    return {"message": "Server restarted"}


@app.get("/api/files")
async def list_files(path: str = "", server_id: int = 0):
    server = get_server_instance(server_id)
    full = os.path.normpath(os.path.join(server.server_path, path))
    if not full.startswith(server.server_path):
        raise HTTPException(403, "Access denied")
    if not os.path.exists(full):
        raise HTTPException(404, "Path not found")
    if os.path.isfile(full):
        with open(full, "r", errors="replace") as f:
            content = f.read()
        return {"type": "file", "name": os.path.basename(full), "content": content, "path": path}
    items = []
    for entry in os.listdir(full):
        ep = os.path.join(full, entry)
        items.append({
            "name": entry,
            "type": "dir" if os.path.isdir(ep) else "file",
            "size": os.path.getsize(ep) if os.path.isfile(ep) else 0,
        })
    items.sort(key=lambda x: (x["type"] != "dir", x["name"].lower()))
    return {"type": "dir", "path": path, "items": items}


@app.post("/api/files/write")
async def write_file(data: dict):
    path = data.get("path", "")
    content = data.get("content", "")
    server_id = data.get("server_id", 0)
    server = get_server_instance(server_id)
    full = os.path.normpath(os.path.join(server.server_path, path))
    if not full.startswith(server.server_path):
        raise HTTPException(403, "Access denied")
    with open(full, "w") as f:
        f.write(content)
    return {"message": "File saved"}


@app.delete("/api/files")
async def delete_file(path: str, server_id: int = 0):
    server = get_server_instance(server_id)
    full = os.path.normpath(os.path.join(server.server_path, path))
    if not full.startswith(server.server_path):
        raise HTTPException(403, "Access denied")
    if os.path.isfile(full):
        os.remove(full)
    else:
        shutil.rmtree(full)
    return {"message": "Deleted"}


@app.websocket("/ws/console")
async def console_ws(ws: WebSocket, server_id: int = 0):
    await ws.accept()
    server = get_server_instance(server_id)
    console_clients[server_id].add(ws)
    await ws.send_text(json.dumps({"type": "info", "data": f"Connected to {server.name}. Server is {'running' if server.running else 'stopped'}"}))
    try:
        while True:
            data = await ws.receive_text()
            msg = json.loads(data)
            if msg.get("type") == "command":
                await server.send_command(msg["data"])
    except WebSocketDisconnect:
        pass
    finally:
        console_clients[server_id].discard(ws)


@app.get("/api/players")
async def get_players(server_id: int = 0):
    return {"players": sorted(list(current_players.get(server_id, set())))}


@app.websocket("/ws/metrics")
async def metrics_ws(ws: WebSocket, server_id: int = 0):
    await ws.accept()
    metrics_clients[server_id].add(ws)
    try:
        while True:
            await ws.receive_text()
    except WebSocketDisconnect:
        pass
    finally:
        metrics_clients[server_id].discard(ws)


@app.get("/api/backups/worlds")
async def list_worlds(server_id: int = 0):
    bm = get_backup_manager(server_id)
    return bm.get_worlds()


@app.get("/api/backups")
async def list_backups(server_id: int = 0):
    bm = get_backup_manager(server_id)
    return bm.list_backups()


@app.post("/api/backups/create")
async def create_backup(data: dict, server_id: int = 0):
    world = data.get("world", "")
    bm = get_backup_manager(server_id)
    if not world:
        worlds = bm.get_worlds()
        if worlds:
            world = worlds[0]["name"]
    if not world:
        raise HTTPException(400, "No world specified and none found automatically")
    try:
        result = bm.create_backup(world)
        return {"message": "Backup created", "backup": result}
    except ValueError as e:
        raise HTTPException(400, str(e))


@app.delete("/api/backups/{name}")
async def delete_backup(name: str, server_id: int = 0):
    bm = get_backup_manager(server_id)
    if bm.delete_backup(name):
        return {"message": "Backup deleted"}
    raise HTTPException(404, "Backup not found")


@app.post("/api/backups/{name}/restore")
async def restore_backup(name: str, server_id: int = 0):
    server = get_server_instance(server_id)
    if server.running:
        raise HTTPException(400, "Stop the server before restoring")
    bm = get_backup_manager(server_id)
    try:
        result = bm.restore_backup(name)
        return result
    except ValueError as e:
        raise HTTPException(400, str(e))


app.mount("/uploads", StaticFiles(directory=UPLOAD_DIR), name="uploads")
app.mount("/", StaticFiles(directory="web", html=True), name="static")
