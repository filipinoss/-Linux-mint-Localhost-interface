import asyncio
import os
import shlex


class MinecraftServer:
    def __init__(self, server_id: int, name: str, path: str, starter_file: str, ram_mb: int):
        self.server_id = server_id
        self.name = name
        self.server_path = os.path.abspath(path)
        self.starter_file = starter_file
        self.ram_mb = ram_mb
        self.process: asyncio.subprocess.Process | None = None
        self._running = False
        self.java_path = ""
        self.java_args: list[str] = []
        self._parse_run_script()

    def _parse_run_script(self):
        script_path = os.path.join(self.server_path, self.starter_file)
        if not os.path.exists(script_path):
            script_path = os.path.join(self.server_path, "run.sh")
            if not os.path.exists(script_path):
                return
        with open(script_path) as f:
            for line in reversed(f.read().strip().split("\n")):
                line = line.strip()
                if line and not line.startswith("#"):
                    parts = shlex.split(line)
                    self.java_path = parts[0]
                    args = parts[1:]
                    new_args = []
                    for a in args:
                        if a.startswith("-Xms"):
                            new_args.append(f"-Xms{self.ram_mb}M")
                        elif a.startswith("-Xmx"):
                            new_args.append(f"-Xmx{self.ram_mb}M")
                        else:
                            new_args.append(a)
                    self.java_args = new_args
                    return

    @property
    def pid(self) -> int | None:
        if self.process and self.process.pid:
            return self.process.pid
        return None

    @property
    def running(self) -> bool:
        if self.process and self.process.returncode is not None:
            self._running = False
        return self._running

    async def start(self) -> bool:
        if self.running:
            return False
        cmd = [self.java_path] + self.java_args
        self.process = await asyncio.create_subprocess_exec(
            *cmd,
            cwd=self.server_path,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.STDOUT,
            stdin=asyncio.subprocess.PIPE,
        )
        self._running = True
        return True

    async def stop(self):
        if not self.running:
            return
        self.process.stdin.write(b"stop\n")
        await self.process.stdin.drain()
        try:
            await asyncio.wait_for(self.process.wait(), timeout=30)
        except asyncio.TimeoutError:
            self.process.kill()
            await self.process.wait()
        self._running = False

    async def send_command(self, cmd: str):
        if not self.running:
            return
        self.process.stdin.write(f"{cmd}\n".encode())
        await self.process.stdin.drain()

    async def read_output(self):
        while self.running:
            line = await self.process.stdout.readline()
            if not line:
                break
            yield line.decode(errors="replace").rstrip()
