let currentFilePath = '';
let currentFileContent = '';

function getSid() { return window.getServerId ? window.getServerId() : 0; }

async function loadFileTree(dir = '') {
  const list = document.getElementById('tree-list');
  if (!list) return;
  list.innerHTML = '<div class="tree-item" style="color:var(--surface2);font-size:12px;">Loading...</div>';
  try {
    const res = await fetch(`/api/files?path=${encodeURIComponent(dir)}&server_id=${getSid()}`);
    const data = await res.json();
    if (data.type !== 'dir') return;
    list.innerHTML = '';
    if (dir) {
      const parent = dir.split('/').slice(0, -1).join('/');
      const up = document.createElement('div');
      up.className = 'tree-item dir';
      up.innerHTML = '<span class="icon">📁</span><span class="name">..</span>';
      up.addEventListener('click', () => loadFileTree(parent));
      list.appendChild(up);
    }
    data.items.forEach(item => {
      const el = document.createElement('div');
      el.className = `tree-item ${item.type}`;
      el.innerHTML = `<span class="icon">${item.type === 'dir' ? '📁' : '📄'}</span><span class="name">${escHtml(item.name)}</span>`;
      el.addEventListener('click', () => {
        const path = dir ? `${dir}/${item.name}` : item.name;
        if (item.type === 'dir') loadFileTree(path);
        else loadFile(path);
      });
      list.appendChild(el);
    });
  } catch { list.innerHTML = '<div class="tree-item" style="color:var(--red);font-size:12px;">Failed to load files</div>'; }
}

async function loadFile(path) {
  try {
    const res = await fetch(`/api/files?path=${encodeURIComponent(path)}&server_id=${getSid()}`);
    const data = await res.json();
    if (data.type === 'file') {
      currentFilePath = path;
      currentFileContent = data.content;
      document.getElementById('editor-header').textContent = path;
      document.getElementById('editor-body').value = data.content;
    }
  } catch {}
}

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('props-btn')?.addEventListener('click', () => loadFile('server.properties'));
  document.getElementById('log-btn')?.addEventListener('click', () => loadFile('logs/latest.log'));

  document.getElementById('editor-save')?.addEventListener('click', async () => {
    if (!currentFilePath) return;
    const content = document.getElementById('editor-body').value;
    try {
      await fetch('/api/files/write', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: currentFilePath, content, server_id: getSid() }),
      });
      currentFileContent = content;
      const hdr = document.getElementById('editor-header');
      hdr.textContent = currentFilePath + ' ✓';
      setTimeout(() => { hdr.textContent = currentFilePath; }, 1500);
    } catch {}
  });
});

function escHtml(s) { const d = document.createElement('div'); d.textContent = s; return d.innerHTML; }
