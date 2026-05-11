function getSid() { return window.getServerId ? window.getServerId() : 0; }

async function loadBackupWorlds() {
  try {
    const res = await fetch(`/api/backups/worlds?server_id=${getSid()}`);
    const worlds = await res.json();
    const sel = document.getElementById('backup-world');
    sel.innerHTML = '';
    worlds.forEach(w => {
      const opt = document.createElement('option');
      opt.value = w.name;
      opt.textContent = `${w.name} (${(w.size / 1024 / 1024).toFixed(1)} MB)`;
      sel.appendChild(opt);
    });
  } catch {}
}

async function loadBackups() {
  try {
    const res = await fetch(`/api/backups?server_id=${getSid()}`);
    const backups = await res.json();
    const list = document.getElementById('backup-list');
    const count = document.getElementById('backup-count');
    count.textContent = backups.length;
    if (!backups.length) { list.innerHTML = '<div class="backup-empty">No backups yet.</div>'; return; }
    list.innerHTML = '';
    backups.forEach(b => {
      const card = document.createElement('div');
      card.className = 'backup-card';
      card.innerHTML = `
        <div class="backup-info">
          <span class="backup-name">${escHtml(b.name)}</span>
          <span class="backup-meta">
            <span class="backup-date">${b.created}</span>
            <span class="backup-sep">·</span>
            <span class="backup-world">${escHtml(b.world)}</span>
            <span class="backup-sep">·</span>
            <span class="backup-size">${(b.size / 1024 / 1024).toFixed(1)} MB</span>
          </span>
        </div>
        <div class="backup-actions">
          <button class="btn btn-sm btn-primary restore-btn" data-name="${escHtml(b.name)}">Restore</button>
          <button class="btn btn-sm btn-danger" data-name="${escHtml(b.name)}">Delete</button>
        </div>`;
      card.querySelector('.restore-btn')?.addEventListener('click', async () => {
        if (!confirm(`Restore "${escHtml(b.world)}" from backup "${escHtml(b.name)}"?\nServer must be stopped.`)) return;
        try {
          const res = await fetch(`/api/backups/${encodeURIComponent(b.name)}/restore?server_id=${getSid()}`, { method: 'POST' });
          if (res.ok) { if (typeof showToast === 'function') showToast('World restored!', 'success'); }
          else { const err = await res.json(); if (typeof showToast === 'function') showToast(err.detail || 'Restore failed', 'error'); }
        } catch { if (typeof showToast === 'function') showToast('Restore failed', 'error'); }
      });
      card.querySelector('.btn-danger')?.addEventListener('click', async () => {
        if (!confirm(`Delete backup "${escHtml(b.name)}"?`)) return;
        try {
          await fetch(`/api/backups/${encodeURIComponent(b.name)}?server_id=${getSid()}`, { method: 'DELETE' });
          if (typeof showToast === 'function') showToast('Backup deleted', 'info');
          loadBackups();
        } catch { if (typeof showToast === 'function') showToast('Failed to delete', 'error'); }
      });
      list.appendChild(card);
    });
  } catch {}
}

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('backup-create-btn')?.addEventListener('click', async () => {
    const world = document.getElementById('backup-world').value;
    if (!world) return;
    const btn = document.getElementById('backup-create-btn');
    btn.disabled = true; btn.textContent = 'Creating...';
    try {
      const res = await fetch(`/api/backups/create?server_id=${getSid()}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ world }),
      });
      if (res.ok) {
        loadBackups();
        loadBackupWorlds();
        if (typeof showToast === 'function') showToast('Backup created!', 'success');
      } else {
        const data = await res.json();
        if (typeof showToast === 'function') showToast(data.detail || 'Failed', 'error');
      }
    } catch { if (typeof showToast === 'function') showToast('Connection error', 'error'); }
    btn.disabled = false; btn.textContent = 'Create Backup';
  });
});

function escHtml(s) { const d = document.createElement('div'); d.textContent = s; return d.innerHTML; }
