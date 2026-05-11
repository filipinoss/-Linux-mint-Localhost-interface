import os
import shutil
from datetime import datetime

BACKUP_BASE = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "backups"))


class BackupManager:
    def __init__(self, server_name: str, server_path: str):
        self.server_name = server_name
        self.server_path = os.path.abspath(server_path)
        self.backup_dir = os.path.join(BACKUP_BASE, server_name)
        os.makedirs(self.backup_dir, exist_ok=True)

    def _next_backup_num(self):
        max_n = 0
        if os.path.isdir(self.backup_dir):
            for d in os.listdir(self.backup_dir):
                parts = d.rsplit("-", 1)
                if len(parts) == 2 and parts[1].startswith("backup"):
                    try:
                        n = int(parts[1][6:])
                        max_n = max(max_n, n)
                    except ValueError:
                        pass
        return max_n + 1

    def get_worlds(self) -> list[dict]:
        world_name = "world"
        props_path = os.path.join(self.server_path, "server.properties")
        if os.path.exists(props_path):
            with open(props_path) as f:
                for line in f:
                    if line.startswith("level-name="):
                        world_name = line.strip().split("=", 1)[1].strip()
                        break
        world_path = os.path.join(self.server_path, world_name)
        if os.path.isdir(world_path):
            size = sum(
                os.path.getsize(os.path.join(dp, f))
                for dp, _, fn in os.walk(world_path)
                for f in fn
            )
            return [{"name": world_name, "size": size}]
        return []

    def create_backup(self, world: str) -> dict:
        now = datetime.now()
        date_part = now.strftime("%Y%m%d-%H%M")
        num = self._next_backup_num()
        backup_name = f"{date_part}-backup{num}"
        backup_path = os.path.join(self.backup_dir, backup_name)
        world_path = os.path.join(self.server_path, world)
        if not os.path.isdir(world_path):
            raise ValueError(f"World '{world}' not found at {world_path}")
        shutil.copytree(world_path, os.path.join(backup_path, world))
        return {
            "name": backup_name,
            "world": world,
            "date": now.strftime("%Y-%m-%d %H:%M"),
            "path": backup_path,
        }

    def list_backups(self) -> list[dict]:
        if not os.path.isdir(self.backup_dir):
            return []
        backups = []
        for entry in sorted(os.listdir(self.backup_dir), reverse=True):
            ep = os.path.join(self.backup_dir, entry)
            if not os.path.isdir(ep):
                continue
            world_folders = [d for d in os.listdir(ep) if os.path.isdir(os.path.join(ep, d))]
            world = world_folders[0] if world_folders else "?"
            size = sum(
                os.path.getsize(os.path.join(dp, f))
                for dp, _, fn in os.walk(ep)
                for f in fn
            )
            mtime = os.path.getmtime(ep)
            backups.append({
                "name": entry,
                "world": world,
                "size": size,
                "created": datetime.fromtimestamp(mtime).strftime("%Y-%m-%d %H:%M"),
            })
        return backups

    def delete_backup(self, name: str) -> bool:
        ep = os.path.join(self.backup_dir, name)
        if os.path.isdir(ep):
            shutil.rmtree(ep)
            return True
        return False

    def restore_backup(self, name: str) -> dict:
        backup_path = os.path.join(self.backup_dir, name)
        if not os.path.isdir(backup_path):
            raise ValueError(f"Backup '{name}' not found")
        worlds = [d for d in os.listdir(backup_path) if os.path.isdir(os.path.join(backup_path, d))]
        if not worlds:
            raise ValueError("No world folder found in backup")
        world = worlds[0]
        source = os.path.join(backup_path, world)
        world_path = os.path.join(self.server_path, world)
        if os.path.isdir(world_path):
            timestamp = datetime.now().strftime("%Y%m%d-%H%M%S")
            pre_restore = os.path.join(self.backup_dir, f"_pre-restore_{world}_{timestamp}")
            shutil.copytree(world_path, pre_restore)
        if os.path.isdir(world_path):
            shutil.rmtree(world_path)
        shutil.copytree(source, world_path)
        return {
            "message": f"World '{world}' restored from backup '{name}'",
            "world": world,
            "backup": name,
        }
