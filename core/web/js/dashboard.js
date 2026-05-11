const CIRCUMFERENCE = 2 * Math.PI * 50;

function setGauge(el, pct, color) {
  const v = Math.max(0, Math.min(100, pct));
  const offset = CIRCUMFERENCE - (v / 100) * CIRCUMFERENCE;
  el.style.strokeDashoffset = offset;
  el.style.stroke = color;
}

function formatBytes(bytes) {
  return (bytes / 1024 / 1024 / 1024).toFixed(1);
}

function formatUptime(seconds) {
  if (!seconds || seconds < 0) return '-';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

function getCSVar(name) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

function gaugeColors() {
  return {
    cpu: getCSVar('--blue') || '#89b4fa',
    mem: getCSVar('--mauve') || '#cba6f7',
    disk: getCSVar('--teal') || '#94e2d5',
  };
}

function updateDashboard(data) {
  const { stats, process: proc, running } = data;
  updatePlayerList(data.players || []);
  const colors = gaugeColors();
  const mcOnline = running || data.running;

  const cpuPct = (mcOnline && proc) ? proc.cpu_percent : 0;
  setGauge(document.getElementById('gauge-cpu'), cpuPct, colors.cpu);
  document.getElementById('cpu-value').textContent = mcOnline ? `${Math.round(cpuPct)}%` : 'OFF';
  document.getElementById('cpu-cores').textContent = mcOnline ? 'MC Server' : 'Server Offline';

  const maxHeap = 10 * 1024 * 1024 * 1024;
  if (mcOnline && proc) {
    const memPct = (proc.memory_rss / maxHeap) * 100;
    setGauge(document.getElementById('gauge-mem'), memPct, colors.mem);
    document.getElementById('mem-value').textContent = `${Math.round(memPct)}%`;
    document.getElementById('mem-detail').textContent = `${formatBytes(proc.memory_rss)} / 10 GB`;
  } else {
    setGauge(document.getElementById('gauge-mem'), 0, colors.mem);
    document.getElementById('mem-value').textContent = 'OFF';
    document.getElementById('mem-detail').textContent = '0 / 0 GB';
  }

  setGauge(document.getElementById('gauge-disk'), stats.disk.percent, colors.disk);
  document.getElementById('disk-value').textContent = `${Math.round(stats.disk.percent)}%`;
  document.getElementById('disk-detail').textContent = `${formatBytes(stats.disk.used)} / ${formatBytes(stats.disk.total)} GB`;

  const on = mcOnline;
  document.getElementById('dash-status').textContent = on ? 'Online' : 'Offline';
  document.getElementById('dash-path').textContent = data.server_name || '—';
}

function updatePlayerList(players) {
  const list = document.getElementById('players-list');
  const count = document.getElementById('players-count');
  if (!list) return;
  count.textContent = players.length;
  if (!players.length) { list.innerHTML = '<span class="players-empty">No players online</span>'; return; }
  list.innerHTML = players.map(p => `<span class="player-badge">${escHtml(p)}</span>`).join('');
}

function escHtml(s) {
  const d = document.createElement('div');
  d.textContent = s;
  return d.innerHTML;
}

async function fetchStatus() {
  const sid = window.getServerId ? window.getServerId() : 0;
  try {
    const res = await fetch(`/api/status?server_id=${sid}`);
    const data = await res.json();
    updateDashboard(data);
  } catch {}
}

async function serverAction(action) {
  const sid = window.getServerId ? window.getServerId() : 0;
  try {
    await fetch(`/api/server/${action}?server_id=${sid}`, { method: 'POST' });
    setTimeout(fetchStatus, 2000);
  } catch {}
}

let metricsWs = null;

function connectMetrics() {
  if (metricsWs) metricsWs.close();
  const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
  const sid = window.getServerId ? window.getServerId() : 0;
  metricsWs = new WebSocket(`${proto}//${location.host}/ws/metrics?server_id=${sid}`);
  metricsWs.onmessage = (event) => {
    try {
      const msg = JSON.parse(event.data);
      if (msg.type === 'metrics') updateDashboard(msg);
    } catch {}
  };
  metricsWs.onclose = () => { metricsWs = null; setTimeout(connectMetrics, 3000); };
  metricsWs.onerror = () => {};
}

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('console-start')?.addEventListener('click', () => serverAction('start'));
  document.getElementById('console-stop')?.addEventListener('click', () => serverAction('stop'));
  document.getElementById('console-restart')?.addEventListener('click', () => serverAction('restart'));
  connectMetrics();
  fetchStatus();
});
