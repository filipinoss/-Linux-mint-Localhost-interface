import hashlib
import os
import secrets
import sqlite3
import json
from datetime import datetime

DATA_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "data"))
DB_PATH = os.path.join(DATA_DIR, "users.db")
UPLOAD_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "uploads"))
PFP_DIR = os.path.join(UPLOAD_DIR, "pfps")
WALLPAPER_DIR = os.path.join(UPLOAD_DIR, "wallpapers")

REMEMBER_DAYS = 30

os.makedirs(DATA_DIR, exist_ok=True)
os.makedirs(PFP_DIR, exist_ok=True)
os.makedirs(WALLPAPER_DIR, exist_ok=True)

_tokens: dict[str, str] = {}

ADMIN_USERNAME = "admin"
ADMIN_PASSWORD = "admin"
ADMIN2_USERNAME = "admines"
ADMIN2_PASSWORD = "admineček"


def _hash_password(password: str) -> str:
    return hashlib.sha256(password.encode()).hexdigest()


def _get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def init_db():
    conn = _get_db()
    conn.execute("""
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            password_hash TEXT NOT NULL,
            role TEXT DEFAULT 'user',
            pfp TEXT DEFAULT NULL,
            wallpaper TEXT DEFAULT NULL,
            permissions TEXT DEFAULT '{}'
        )
    """)
    conn.execute("""
        CREATE TABLE IF NOT EXISTS remember_tokens (
            token TEXT PRIMARY KEY,
            username TEXT NOT NULL,
            expires_at TEXT NOT NULL
        )
    """)
    conn.commit()

    try:
        conn.execute("ALTER TABLE users ADD COLUMN created_at TEXT DEFAULT NULL")
    except sqlite3.OperationalError:
        pass

    for uname, pwd, role in [
        (ADMIN_USERNAME, ADMIN_PASSWORD, "owner"),
        (ADMIN2_USERNAME, ADMIN2_PASSWORD, "owner"),
    ]:
        existing = conn.execute("SELECT id FROM users WHERE username = ?", (uname,)).fetchone()
        if not existing:
            now = datetime.utcnow().isoformat()
            conn.execute(
                "INSERT INTO users (username, password_hash, role, permissions, created_at) VALUES (?, ?, ?, ?, ?)",
                (uname, _hash_password(pwd), role,
                 json.dumps({"dashboard": True, "console": True, "files": True, "backups": True, "settings": True}),
                 now),
            )
            conn.commit()

    conn.close()


def _row_to_user(row) -> dict:
    return {
        "username": row["username"],
        "role": row["role"],
        "pfp": row["pfp"],
        "wallpaper": row["wallpaper"],
        "created_at": row["created_at"],
        "permissions": json.loads(row["permissions"] or "{}"),
    }


def authenticate(username: str, password: str) -> dict | None:
    conn = _get_db()
    row = conn.execute("SELECT * FROM users WHERE username = ?", (username,)).fetchone()
    conn.close()
    if row and row["password_hash"] == _hash_password(password):
        token = secrets.token_hex(32)
        _tokens[token] = row["username"]
        return {"token": token, **_row_to_user(row)}
    return None


def get_user_by_token(token: str) -> dict | None:
    username = _tokens.get(token)
    if not username:
        return None
    conn = _get_db()
    row = conn.execute("SELECT * FROM users WHERE username = ?", (username,)).fetchone()
    conn.close()
    if not row:
        return None
    return _row_to_user(row)


def logout(token: str):
    _tokens.pop(token, None)


def create_session_token(username: str) -> str:
    token = secrets.token_hex(32)
    _tokens[token] = username
    return token


def create_remember_token(username: str, days: int = REMEMBER_DAYS) -> str:
    token = secrets.token_hex(32)
    expires = datetime.utcnow().isoformat()
    conn = _get_db()
    conn.execute(
        "INSERT OR REPLACE INTO remember_tokens (token, username, expires_at) VALUES (?, ?, ?)",
        (token, username, expires),
    )
    conn.commit()
    conn.close()
    return token


def get_user_by_remember_token(token: str) -> dict | None:
    conn = _get_db()
    row = conn.execute(
        "SELECT username FROM remember_tokens WHERE token = ?", (token,)
    ).fetchone()
    conn.close()
    if not row:
        return None
    username = row["username"]
    conn2 = _get_db()
    user_row = conn2.execute("SELECT * FROM users WHERE username = ?", (username,)).fetchone()
    conn2.close()
    if not user_row:
        return None
    return _row_to_user(user_row)


def delete_remember_token(token: str):
    conn = _get_db()
    conn.execute("DELETE FROM remember_tokens WHERE token = ?", (token,))
    conn.commit()
    conn.close()


def create_user(username: str, password: str) -> dict | None:
    conn = _get_db()
    existing = conn.execute("SELECT id FROM users WHERE username = ?", (username,)).fetchone()
    if existing:
        conn.close()
        return None
    now = datetime.utcnow().isoformat()
    conn.execute(
        "INSERT INTO users (username, password_hash, role, permissions, created_at) VALUES (?, ?, ?, ?, ?)",
        (username, _hash_password(password), "user",
         json.dumps({"dashboard": True, "console": True, "files": True, "backups": True, "settings": True}),
         now),
    )
    conn.commit()
    conn.close()
    token = secrets.token_hex(32)
    _tokens[token] = username
    return {"token": token, "username": username, "role": "user",
            "pfp": None, "wallpaper": None, "created_at": now,
            "permissions": {"dashboard": True, "console": True, "files": True, "backups": True, "settings": True}}


def update_pfp(username: str, filename: str):
    conn = _get_db()
    conn.execute("UPDATE users SET pfp = ? WHERE username = ?", (filename, username))
    conn.commit()
    conn.close()


def update_wallpaper(username: str, filename: str):
    conn = _get_db()
    conn.execute("UPDATE users SET wallpaper = ? WHERE username = ?", (filename, username))
    conn.commit()
    conn.close()


def list_users() -> list[dict]:
    conn = _get_db()
    rows = conn.execute("SELECT username, role, pfp, wallpaper, created_at, permissions FROM users ORDER BY rowid ASC").fetchall()
    conn.close()
    return [_row_to_user(r) for r in rows]


def delete_user(username: str) -> bool:
    if username in (ADMIN_USERNAME, ADMIN2_USERNAME):
        return False
    conn = _get_db()
    cur = conn.execute("DELETE FROM users WHERE username = ?", (username,))
    conn.commit()
    conn.close()
    global _tokens
    _tokens = {k: v for k, v in _tokens.items() if v != username}
    return cur.rowcount > 0


def update_user(username: str, updates: dict) -> bool:
    conn = _get_db()
    fields = []
    vals = []
    if "password" in updates:
        fields.append("password_hash = ?")
        vals.append(_hash_password(updates["password"]))
    if "role" in updates:
        fields.append("role = ?")
        vals.append(updates["role"])
    if "new_username" in updates:
        fields.append("username = ?")
        vals.append(updates["new_username"])
        target_uname = updates["new_username"]
    else:
        target_uname = username
    if not fields:
        conn.close()
        return False
    vals.append(username)
    conn.execute(f"UPDATE users SET {', '.join(fields)} WHERE username = ?", vals)
    conn.commit()
    conn.close()
    return True


def update_permissions(username: str, permissions: dict) -> bool:
    conn = _get_db()
    cur = conn.execute("UPDATE users SET permissions = ? WHERE username = ?",
                       (json.dumps(permissions), username))
    conn.commit()
    conn.close()
    return cur.rowcount > 0


def init_servers_table():
    conn = _get_db()
    conn.execute("""
        CREATE TABLE IF NOT EXISTS servers (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            path TEXT NOT NULL,
            starter_file TEXT DEFAULT 'run.sh',
            ram_mb INTEGER DEFAULT 4096,
            created_at TEXT DEFAULT (datetime('now'))
        )
    """)
    conn.commit()
    conn.close()


def create_server(name: str, path: str, starter_file: str = "run.sh", ram_mb: int = 4096) -> dict:
    conn = _get_db()
    cur = conn.execute(
        "INSERT INTO servers (name, path, starter_file, ram_mb) VALUES (?, ?, ?, ?)",
        (name, path, starter_file, ram_mb),
    )
    conn.commit()
    sid = cur.lastrowid
    conn.close()
    return {"id": sid, "name": name, "path": path, "starter_file": starter_file, "ram_mb": ram_mb}


def list_servers() -> list[dict]:
    conn = _get_db()
    rows = conn.execute("SELECT id, name, path, starter_file, ram_mb, created_at FROM servers ORDER BY id ASC").fetchall()
    conn.close()
    return [dict(r) for r in rows]


def delete_server(server_id: int):
    conn = _get_db()
    conn.execute("DELETE FROM servers WHERE id = ?", (server_id,))
    conn.commit()
    conn.close()


def get_server(server_id: int) -> dict | None:
    conn = _get_db()
    row = conn.execute("SELECT id, name, path, starter_file, ram_mb FROM servers WHERE id = ?", (server_id,)).fetchone()
    conn.close()
    if row:
        return dict(row)
    return None
