let term = null;
let fitAddon = null;
let consoleWs = null;

function getCSVar(name) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

function terminalThemeFromCSS() {
  return {
    background: getCSVar('--crust') || '#11111b',
    foreground: getCSVar('--text') || '#cdd6f4',
    cursor: getCSVar('--mauve') || '#cba6f7',
    selectionBackground: getCSVar('--surface1') || '#45475a',
    black: getCSVar('--surface1') || '#45475a',
    red: getCSVar('--red') || '#f38ba8',
    green: getCSVar('--green') || '#a6e3a1',
    yellow: getCSVar('--yellow') || '#f9e2af',
    blue: getCSVar('--blue') || '#89b4fa',
    magenta: getCSVar('--mauve') || '#cba6f7',
    cyan: getCSVar('--teal') || '#94e2d5',
    white: getCSVar('--subtext1') || '#bac2de',
    brightBlack: getCSVar('--surface2') || '#585b70',
    brightRed: getCSVar('--red') || '#f38ba8',
    brightGreen: getCSVar('--green') || '#a6e3a1',
    brightYellow: getCSVar('--yellow') || '#f9e2af',
    brightBlue: getCSVar('--blue') || '#89b4fa',
    brightMagenta: getCSVar('--mauve') || '#cba6f7',
    brightCyan: getCSVar('--teal') || '#94e2d5',
    brightWhite: getCSVar('--text') || '#cdd6f4',
  };
}

function applyTerminalTheme() {
  if (!term) return;
  term.setOption('theme', terminalThemeFromCSS());
}

function destroyConsole() {
  if (consoleWs) { consoleWs.close(); consoleWs = null; }
  if (term) { term.dispose(); term = null; }
  fitAddon = null;
  const el = document.getElementById('terminal');
  if (el) el.innerHTML = '';
}

function initConsole() {
  destroyConsole();

  const el = document.getElementById('terminal');
  if (!el) return;

  term = new Terminal({
    cursorBlink: true,
    cursorStyle: 'block',
    fontSize: 13,
    fontFamily: '"JetBrains Mono", "Fira Code", monospace',
    theme: terminalThemeFromCSS(),
  });

  fitAddon = new FitAddon.FitAddon();
  term.loadAddon(fitAddon);
  term.open(el);
  requestAnimationFrame(() => { try { fitAddon.fit(); } catch (e) {} });

  if (!window._consoleResizeHandler) {
    window._consoleResizeHandler = () => { if (fitAddon) try { fitAddon.fit(); } catch (e) {} };
    window.addEventListener('resize', window._consoleResizeHandler);
  }

  connectConsoleWs();
  setupConsoleInput();
}

function connectConsoleWs() {
  if (consoleWs) consoleWs.close();
  const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
  const sid = window.getServerId ? window.getServerId() : 0;
  consoleWs = new WebSocket(`${protocol}//${location.host}/ws/console?server_id=${sid}`);

  consoleWs.onmessage = (event) => {
    try {
      const msg = JSON.parse(event.data);
      if (msg.type === 'output') term.writeln(msg.data.replace(/\n/g, '\r\n'));
      else if (msg.type === 'info') term.writeln(`\x1b[90m[INFO] ${msg.data}\x1b[0m`);
    } catch (e) { term.writeln(event.data); }
  };

  consoleWs.onclose = () => {
    term.writeln('\x1b[90m[Disconnected from server console]\x1b[0m');
    consoleWs = null;
  };

  consoleWs.onerror = () => {
    term.writeln('\x1b[91m[WebSocket error]\x1b[0m');
  };
}

function setupConsoleInput() {
  const input = document.getElementById('dash-console-input');
  const sendBtn = document.getElementById('dash-console-send');

  function sendCommand() {
    const cmd = input.value.trim();
    if (!cmd || !consoleWs || consoleWs.readyState !== WebSocket.OPEN) return;
    consoleWs.send(JSON.stringify({ type: 'command', data: cmd }));
    term.writeln(`\x1b[90m> ${cmd}\x1b[0m`);
    input.value = '';
  }

  input.addEventListener('keydown', (e) => { if (e.key === 'Enter') sendCommand(); });
  sendBtn.addEventListener('click', sendCommand);

  const enable = () => { input.disabled = false; sendBtn.disabled = false; input.placeholder = 'Type a command...'; };
  const disable = () => { input.disabled = true; sendBtn.disabled = true; input.placeholder = 'Connecting...'; };

  disable();
  const check = setInterval(() => {
    if (consoleWs && consoleWs.readyState === WebSocket.OPEN) { enable(); clearInterval(check); }
  }, 200);
}
