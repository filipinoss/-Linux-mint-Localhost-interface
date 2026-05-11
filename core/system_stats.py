import asyncio
import psutil


def _get_system_stats() -> dict:
    cpu = psutil.cpu_percent(interval=0)  # non-blocking
    mem = psutil.virtual_memory()
    disk = psutil.disk_usage("/")
    return {
        "cpu": {"percent": cpu, "cores": psutil.cpu_count()},
        "memory": {
            "total": mem.total,
            "used": mem.used,
            "percent": mem.percent,
        },
        "disk": {
            "total": disk.total,
            "used": disk.used,
            "percent": disk.percent,
        },
    }


def _get_process_stats(pid: int | None) -> dict | None:
    if pid is None:
        return None
    try:
        proc = psutil.Process(pid)
        mem = proc.memory_info()
        return {
            "cpu_percent": proc.cpu_percent(interval=0.2),
            "memory_rss": mem.rss,
            "memory_vms": mem.vms,
            "name": proc.name(),
        }
    except (psutil.NoSuchProcess, psutil.AccessDenied):
        return None


async def get_stats() -> dict:
    return await asyncio.get_event_loop().run_in_executor(None, _get_system_stats)


async def get_process_stats(pid: int | None) -> dict | None:
    if pid is None:
        return None
    return await asyncio.get_event_loop().run_in_executor(None, _get_process_stats, pid)
