document.addEventListener('DOMContentLoaded', () => {
  const root = document.documentElement;

  document.querySelectorAll('.style-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const style = btn.dataset.style;
      root.dataset.style = style;
      localStorage.setItem('mc-style', style);
      document.querySelectorAll('.style-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
    });
  });
  const savedStyle = localStorage.getItem('mc-style') || 'glass';
  document.querySelector(`.style-btn[data-style="${savedStyle}"]`)?.classList.add('active');

  // Wallpaper upload
  const wallpaperInput = document.getElementById('wallpaper-input');
  const wallpaperBtn = document.getElementById('wallpaper-btn');
  const wallpaperName = document.getElementById('wallpaper-name');

  wallpaperBtn?.addEventListener('click', () => wallpaperInput?.click());
  wallpaperInput?.addEventListener('change', async () => {
    const file = wallpaperInput.files?.[0];
    if (!file) return;
    const token = window.__token || localStorage.getItem('mc-token');
    if (!token) return;
    const form = new FormData();
    form.append('token', token);
    form.append('file', file);
    wallpaperBtn.disabled = true;
    wallpaperBtn.textContent = 'Uploading...';
    try {
      const res = await fetch('/api/upload/wallpaper', { method: 'POST', body: form });
      if (res.ok) {
        const data = await res.json();
        if (wallpaperName) wallpaperName.textContent = data.filename;
        if (typeof applyWallpaper === 'function') applyWallpaper(data.filename);
        if (typeof showToast === 'function') showToast('Wallpaper uploaded!', 'success');
      } else { if (typeof showToast === 'function') showToast('Upload failed', 'error'); }
    } catch { if (typeof showToast === 'function') showToast('Upload error', 'error'); }
    wallpaperBtn.disabled = false;
    wallpaperBtn.textContent = 'Upload Wallpaper';
    wallpaperInput.value = '';
  });

  // Random Wallpaper
  document.getElementById('wallpaper-random-btn')?.addEventListener('click', async () => {
    const btn = document.getElementById('wallpaper-random-btn');
    const token = window.__token || localStorage.getItem('mc-token');
    if (!token) return;
    btn.disabled = true; btn.textContent = 'Loading...';
    try {
      const res = await fetch(`/api/wallpaper/random?token=${token}`, { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        if (wallpaperName) wallpaperName.textContent = data.filename;
        if (typeof applyWallpaper === 'function') applyWallpaper(data.filename);
        if (typeof showToast === 'function') showToast('Random wallpaper applied!', 'success');
      } else { if (typeof showToast === 'function') showToast('Failed', 'error'); }
    } catch { if (typeof showToast === 'function') showToast('Error', 'error'); }
    btn.disabled = false; btn.textContent = 'Random';
  });

  document.getElementById('wallpaper-remove-btn')?.addEventListener('click', async () => {
    const token = window.__token || localStorage.getItem('mc-token');
    if (!token) return;
    try {
      const res = await fetch(`/api/wallpaper/remove?token=${token}`, { method: 'POST' });
      if (res.ok) {
        if (wallpaperName) wallpaperName.textContent = '';
        if (typeof applyWallpaper === 'function') applyWallpaper(null);
        if (typeof showToast === 'function') showToast('Wallpaper removed', 'success');
      } else { if (typeof showToast === 'function') showToast('Failed', 'error'); }
    } catch { if (typeof showToast === 'function') showToast('Error', 'error'); }
  });

  // Load My Images when settings tab is opened
  document.querySelector('[data-view="settings"]')?.addEventListener('click', () => {
    if (typeof loadMyImages === 'function') loadMyImages();
  });
});

function switchView(view) {
  const btn = document.querySelector(`.tab-item[data-view="${view}"]`);
  if (btn) btn.click();
}
