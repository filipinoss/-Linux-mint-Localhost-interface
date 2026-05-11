document.addEventListener('DOMContentLoaded', () => {
  const root = document.documentElement;
  const loginOverlay = document.getElementById('login-overlay');

  window.getServerId = function() {
    return parseInt(localStorage.getItem('active_server_id') || '0');
  };

  // ===== Navigation via Tab Bar =====
  const tabItems = document.querySelectorAll('.tab-item');
  const views = {
    dashboard: document.getElementById('view-dashboard'),
    files: document.getElementById('view-files'),
    backups: document.getElementById('view-backups'),
    servers: document.getElementById('view-servers'),
    admin: document.getElementById('view-admin'),
    settings: document.getElementById('view-settings'),
  };

  tabItems.forEach(item => {
    item.addEventListener('click', () => {
      const view = item.dataset.view;
      tabItems.forEach(t => t.classList.remove('active'));
      item.classList.add('active');
      Object.entries(views).forEach(([k, el]) => {
        el.classList.toggle('active', k === view);
      });
      if (view === 'dashboard' && typeof initConsole === 'function') initConsole();
      if (view === 'files' && typeof loadFileTree === 'function') loadFileTree();
      if (view === 'backups') {
        if (typeof loadBackupWorlds === 'function') loadBackupWorlds();
        if (typeof loadBackups === 'function') loadBackups();
      }
      if (view === 'servers' && typeof loadServers === 'function') loadServers();
      if (view === 'admin' && typeof loadAdminPanel === 'function') loadAdminPanel();
    });
  });

  window.switchView = function(view) {
    const btn = document.querySelector(`.tab-item[data-view="${view}"]`);
    if (btn) btn.click();
  };

  // ===== Nav title rename =====
  const titleEl = document.getElementById('nav-title');
  const titleInput = document.getElementById('nav-title-input');
  const savedTitle = localStorage.getItem('mc-title') || 'MC Panel';
  titleEl.textContent = savedTitle;

  titleEl.addEventListener('dblclick', () => {
    titleEl.classList.add('hidden');
    titleInput.classList.remove('hidden');
    titleInput.value = titleEl.textContent;
    titleInput.focus();
    titleInput.select();
  });

  function commitTitle() {
    const val = titleInput.value.trim() || 'MC Panel';
    titleEl.textContent = val;
    localStorage.setItem('mc-title', val);
    titleInput.classList.add('hidden');
    titleEl.classList.remove('hidden');
  }

  titleInput.addEventListener('blur', commitTitle);
  titleInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') commitTitle();
    if (e.key === 'Escape') {
      titleInput.classList.add('hidden');
      titleEl.classList.remove('hidden');
    }
  });

  // ===== Design + Style =====
  root.dataset.theme = 'catppuccin';
  let savedDesign = localStorage.getItem('mc-design') || 'ios';
  if (savedDesign === 'default' || savedDesign === 'macos' || savedDesign === 'gnome' || savedDesign === 'cinnamon') {
    savedDesign = 'ios'; localStorage.setItem('mc-design', 'ios');
  }
  root.dataset.design = savedDesign;

  const savedStyle = localStorage.getItem('mc-style') || 'glass';
  root.dataset.style = savedStyle;
  document.querySelectorAll('.style-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const style = btn.dataset.style;
      root.dataset.style = style;
      localStorage.setItem('mc-style', style);
      document.querySelectorAll('.style-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
    });
  });
  document.querySelector(`.style-btn[data-style="${savedStyle}"]`)?.classList.add('active');

  const observer = new MutationObserver(() => {
    if (typeof applyTerminalTheme === 'function') applyTerminalTheme();
    if (typeof syncCustomColors === 'function') syncCustomColors();
  });
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-style', 'data-design'] });

  // ===== Custom Colors =====
  const CUSTOM_COLOR_KEYS = ['base','mantle','crust','surface0','surface1','surface2','overlay0','overlay1','text','subtext0','subtext1','blue','mauve','red','green','yellow','teal','lavender','peach'];

  function getCSSVarValue(name) { return getComputedStyle(root).getPropertyValue('--' + name).trim(); }

  window.syncCustomColors = function() {
    const custom = JSON.parse(localStorage.getItem('mc-custom-colors') || '{}');
    if (Object.keys(custom).length === 0) return;
    for (const [key, val] of Object.entries(custom)) root.style.setProperty('--' + key, val);
  };

  function buildColorPicker() {
    const grid = document.getElementById('custom-color-grid');
    if (!grid) return;
    grid.innerHTML = '';
    const custom = JSON.parse(localStorage.getItem('mc-custom-colors') || '{}');
    for (const key of CUSTOM_COLOR_KEYS) {
      const val = custom[key] || getCSSVarValue(key) || '';
      const div = document.createElement('div');
      div.className = 'custom-color-item';
      div.innerHTML = `<label class="custom-color-label">--${key}</label><div class="custom-color-input-wrap"><input type="color" class="custom-color-picker" data-key="${key}" value="${val}"><input type="text" class="custom-color-text" data-key="${key}" value="${val}" maxlength="7" placeholder="#rrggbb"></div>`;
      grid.appendChild(div);
    }
  }

  function applyCustomColor(key, value) {
    const custom = JSON.parse(localStorage.getItem('mc-custom-colors') || '{}');
    if (value) { custom[key] = value; root.style.setProperty('--' + key, value); }
    else { delete custom[key]; root.style.removeProperty('--' + key); }
    localStorage.setItem('mc-custom-colors', JSON.stringify(custom));
  }

  document.getElementById('custom-colors-toggle')?.addEventListener('click', () => {
    const panel = document.getElementById('custom-colors-panel');
    const btn = document.getElementById('custom-colors-toggle');
    const isOpen = !panel.classList.contains('hidden');
    panel.classList.toggle('hidden');
    btn.textContent = isOpen ? 'Open Picker' : 'Close Picker';
    if (!isOpen) buildColorPicker();
  });

  document.getElementById('custom-colors-panel')?.addEventListener('input', (e) => {
    const target = e.target;
    if (target.classList.contains('custom-color-picker')) {
      const key = target.dataset.key;
      const val = target.value;
      const textInput = target.parentElement.querySelector('.custom-color-text');
      if (textInput) textInput.value = val;
      applyCustomColor(key, val);
    }
    if (target.classList.contains('custom-color-text')) {
      const key = target.dataset.key;
      let val = target.value.trim();
      if (/^#[0-9a-fA-F]{6}$/.test(val)) {
        const picker = target.parentElement.querySelector('.custom-color-picker');
        if (picker) picker.value = val;
        applyCustomColor(key, val);
      }
    }
  });

  document.getElementById('custom-colors-reset')?.addEventListener('click', () => {
    localStorage.removeItem('mc-custom-colors');
    for (const key of CUSTOM_COLOR_KEYS) root.style.removeProperty('--' + key);
    buildColorPicker();
    if (typeof applyTerminalTheme === 'function') applyTerminalTheme();
  });

  window.syncCustomColors();

  // ===== Toast =====
  window.showToast = function(message, type = 'info', duration = 3500) {
    const container = document.getElementById('toast-container');
    if (!container) return;
    const icons = { success: '\u2713', error: '\u2717', info: 'i' };
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.innerHTML = `<span class="toast-icon">${icons[type] || 'i'}</span><span class="toast-msg">${escHtml(message)}</span>`;
    container.appendChild(toast);
    setTimeout(() => { toast.classList.add('toast-out'); setTimeout(() => toast.remove(), 250); }, duration);
  };

  // ===== Nav clock =====
  function updateClock() {
    const el = document.getElementById('nav-time');
    if (!el) return;
    const now = new Date();
    el.textContent = String(now.getHours()).padStart(2,'0') + ':' + String(now.getMinutes()).padStart(2,'0');
  }
  updateClock();
  setInterval(updateClock, 30000);

  const hostEl = document.getElementById('nav-host');
  if (hostEl) hostEl.textContent = window.location.host;

  // ===== Avatar Dropdown =====
  const avatarWrap = document.getElementById('nav-avatar-wrap');
  const avatarDropdown = document.getElementById('avatar-dropdown');
  avatarWrap?.addEventListener('click', (e) => { e.stopPropagation(); avatarDropdown.classList.toggle('hidden'); });
  document.addEventListener('click', () => { avatarDropdown.classList.add('hidden'); });
  avatarDropdown?.addEventListener('click', (e) => { e.stopPropagation(); });

  document.querySelectorAll('.avatar-dd-item').forEach(item => {
    item.addEventListener('click', async (e) => {
      e.stopPropagation();
      avatarDropdown.classList.add('hidden');
      const action = item.dataset.action;
      if (action === 'create-account') {
        loginOverlay.classList.remove('hidden');
        document.getElementById('login-username').value = '';
        document.getElementById('login-password').value = '';
        document.getElementById('login-confirm').value = '';
        document.getElementById('login-error').textContent = '';
        const h2 = document.querySelector('.login-header h2');
        if (h2 && h2.textContent !== 'Create Account') document.getElementById('login-toggle-btn')?.click();
      } else if (action === 'login-another') {
        const token = window.__token || localStorage.getItem('mc-token');
        if (token) await fetch('/api/auth/logout', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({token}) });
        localStorage.removeItem('mc-token');
        localStorage.removeItem('active_server_id');
        const h2 = document.querySelector('.login-header h2');
        if (h2 && h2.textContent === 'Create Account') document.getElementById('login-toggle-btn')?.click();
        loginOverlay.classList.remove('hidden');
        document.getElementById('login-username').value = '';
        document.getElementById('login-password').value = '';
        document.getElementById('login-confirm').value = '';
        document.getElementById('login-error').textContent = '';
      } else if (action === 'logout') {
        const token = window.__token || localStorage.getItem('mc-token');
        if (token) await fetch('/api/auth/logout', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({token}) });
        localStorage.removeItem('mc-token');
        localStorage.removeItem('active_server_id');
        location.reload();
      }
    });
  });

  // ===== Auth =====
  function applyWallpaper(wp) {
    const content = document.getElementById('content');
    if (!content) return;
    if (wp) {
      content.style.backgroundImage = `url(/uploads/wallpapers/${wp})`;
      content.classList.add('has-wallpaper');
    } else {
      content.style.backgroundImage = '';
      content.classList.remove('has-wallpaper');
    }
  }

  function initUserUI(user, token) {
    window.__token = token;
    window.__user = user;
    loginOverlay.classList.add('hidden');

    const pfp = document.getElementById('nav-pfp');
    if (pfp) pfp.src = user.pfp ? `/uploads/pfps/${user.pfp}` : 'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 32 32%22%3E%3Ccircle cx=%2216%22 cy=%2216%22 r=%2216%22 fill=%22%23313244%22/%3E%3Ctext x=%2216%22 y=%2221%22 text-anchor=%22middle%22 fill=%22%23a6adc8%22 font-size=%2214%22 font-weight=%22600%22%3E' + encodeURIComponent((user.username || '?')[0].toUpperCase()) + '%3C/text%3E%3C/svg%3E';

    applyWallpaper(user.wallpaper);

    const un = document.getElementById('nav-username');
    if (un) un.textContent = user.username;
    const su = document.getElementById('settings-username');
    if (su) su.textContent = user.username;
    const sr = document.getElementById('settings-role');
    if (sr && user.role) sr.textContent = user.role.charAt(0).toUpperCase() + user.role.slice(1);

    const adminTab = document.querySelector('.tab-item-admin');
    if (adminTab) adminTab.classList.toggle('hidden', user.role !== 'owner' && user.role !== 'admin');

    if (user.permissions) {
      document.querySelectorAll('.tab-item').forEach(item => {
        const view = item.dataset.view;
        if (view && view !== 'settings' && user.permissions[view] === false) item.classList.add('hidden');
      });
    }
  }

  async function checkAuth() {
    const token = localStorage.getItem('mc-token');
    if (token) {
      try {
        const res = await fetch(`/api/me?token=${token}`);
        if (res.ok) {
          const user = await res.json();
          initUserUI(user, token);
          afterLogin();
          return;
        }
      } catch {}
      localStorage.removeItem('mc-token');
    }
    try {
      const res = await fetch('/api/auth/cookie-login', { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        localStorage.setItem('mc-token', data.token);
        initUserUI(data, data.token);
        afterLogin();
      }
    } catch {}
  }

  function afterLogin() {
    const sid = localStorage.getItem('active_server_id');
    if (!sid) {
      showServerSelector();
    } else {
      const sname = localStorage.getItem('active_server_name') || 'Server';
      document.getElementById('nav-server-name').textContent = sname;
      document.getElementById('settings-active-server').textContent = sname;
    }
  }

  window.addEventListener('auth-login', (e) => {
    initUserUI(e.detail, e.detail.token);
    afterLogin();
  });

  checkAuth();

  // ===== Logout =====
  document.getElementById('settings-logout')?.addEventListener('click', async () => {
    const token = window.__token || localStorage.getItem('mc-token');
    if (token) await fetch('/api/auth/logout', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({token}) });
    localStorage.removeItem('mc-token');
    localStorage.removeItem('active_server_id');
    location.reload();
  });

  // ===== Server Selector =====
  async function showServerSelector() {
    const overlay = document.getElementById('server-select-overlay');
    overlay.classList.remove('hidden');
    const list = document.getElementById('server-select-list');
    const token = window.__token;
    if (!token) return;
    try {
      const res = await fetch(`/api/servers?token=${token}`);
      const servers = await res.json();
      if (!servers.length) {
        list.innerHTML = '<div style="text-align:center;padding:24px;color:var(--surface2)">No servers configured. Go to Servers tab to add one.</div><div style="text-align:center;margin-top:8px"><button class="btn btn-sm btn-primary" onclick="switchView(\'servers\');document.getElementById(\'server-select-overlay\').classList.add(\'hidden\')">Manage Servers</button></div>';
        return;
      }
      list.innerHTML = servers.map(s => `
        <div class="server-card" data-id="${s.id}">
          <div class="server-card-info">
            <span class="server-card-name">${escHtml(s.name)}</span>
            <span class="server-card-path">${escHtml(s.path)}</span>
            <span class="server-card-ram">${s.ram_mb} MB RAM</span>
          </div>
        </div>
      `).join('');
      list.querySelectorAll('.server-card').forEach(card => {
        card.addEventListener('click', () => {
          const id = parseInt(card.dataset.id);
          const name = card.querySelector('.server-card-name').textContent;
          selectServer(id, name);
        });
      });
    } catch { list.innerHTML = '<div style="text-align:center;padding:24px;color:var(--red)">Failed to load servers</div>'; }
  }

  window.selectServer = function(id, name) {
    localStorage.setItem('active_server_id', id);
    localStorage.setItem('active_server_name', name);
    document.getElementById('server-select-overlay').classList.add('hidden');
    document.getElementById('nav-server-name').textContent = name;
    document.getElementById('settings-active-server').textContent = name;
    if (typeof destroyConsole === 'function') destroyConsole();
    if (typeof initConsole === 'function') initConsole();
    if (typeof connectMetrics === 'function') connectMetrics();
    if (typeof fetchStatus === 'function') fetchStatus();
    showToast('Switched to ' + name, 'success');
  };

  // ===== Servers Management =====
  window.loadServers = async function() {
    const token = window.__token;
    if (!token) return;
    const list = document.getElementById('servers-list');
    try {
      const res = await fetch(`/api/servers?token=${token}`);
      const servers = await res.json();
      if (!servers.length) {
        list.innerHTML = '<div class="servers-empty">No servers configured.</div>';
        return;
      }
      const isAdmin = window.__user?.role === 'owner' || window.__user?.role === 'admin';
      const activeId = window.getServerId();
      list.innerHTML = servers.map(s => {
        const isActive = s.id === activeId;
        return `
          <div class="server-card${isActive ? ' server-card-active' : ''}" data-id="${s.id}">
            <div class="server-card-info">
              <span class="server-card-name">${escHtml(s.name)} ${isActive ? '(\u2713 active)' : ''}</span>
              <span class="server-card-path">${escHtml(s.path)}</span>
              <span class="server-card-ram">${s.ram_mb} MB | ${escHtml(s.starter_file)}</span>
            </div>
            <div class="server-card-actions">
              ${!isActive ? `<button class="btn btn-sm btn-primary sv-switch" data-id="${s.id}" data-name="${escHtml(s.name)}">Switch</button>` : ''}
              ${isAdmin ? `<button class="btn btn-sm btn-danger sv-delete" data-id="${s.id}">Delete</button>` : ''}
            </div>
          </div>
        `;
      }).join('');

      list.querySelectorAll('.sv-switch').forEach(btn => {
        btn.addEventListener('click', () => {
          window.selectServer(parseInt(btn.dataset.id), btn.dataset.name);
          loadServers();
        });
      });

      list.querySelectorAll('.sv-delete').forEach(btn => {
        btn.addEventListener('click', async () => {
          if (!confirm('Delete this server?')) return;
          const id = parseInt(btn.dataset.id);
          await fetch(`/api/servers/${id}?token=${token}`, { method: 'DELETE' });
          if (id === window.getServerId()) {
            localStorage.removeItem('active_server_id');
            localStorage.removeItem('active_server_name');
            showServerSelector();
          }
          loadServers();
        });
      });
    } catch {
      list.innerHTML = '<div class="servers-empty">Failed to load</div>';
    }
  };

  // Add server form
  const addBtn = document.getElementById('server-add-btn');
  const addSection = document.getElementById('server-add-section');
  addBtn?.addEventListener('click', () => {
    addSection.style.display = addSection.style.display === 'none' ? 'block' : 'none';
  });

  document.getElementById('sv-cancel-btn')?.addEventListener('click', () => {
    addSection.style.display = 'none';
  });

  document.getElementById('sv-save-btn')?.addEventListener('click', async () => {
    const name = document.getElementById('sv-name').value.trim();
    const path = document.getElementById('sv-path').value.trim();
    const starter = document.getElementById('sv-starter').value.trim() || 'run.sh';
    const ram = parseInt(document.getElementById('sv-ram').value) || 4096;
    if (!name || !path) { showToast('Name and path required', 'error'); return; }
    const token = window.__token;
    try {
      const res = await fetch(`/api/servers?token=${token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, path, starter_file: starter, ram_mb: ram }),
      });
      if (res.ok) {
        showToast('Server added!', 'success');
        addSection.style.display = 'none';
        document.getElementById('sv-name').value = '';
        document.getElementById('sv-path').value = '';
        document.getElementById('sv-starter').value = 'run.sh';
        document.getElementById('sv-ram').value = '4096';
        loadServers();
      } else {
        const err = await res.json();
        showToast(err.detail || 'Failed to add', 'error');
      }
    } catch { showToast('Connection error', 'error'); }
  });

  // ===== RAM Slider =====
  const ramSlider = document.getElementById('sv-ram');
  const ramDisplay = document.getElementById('sv-ram-display');
  function updateRamDisplay() {
    const gb = (parseInt(ramSlider.value) / 1024).toFixed(1);
    ramDisplay.textContent = gb + ' GB';
  }
  if (ramSlider) {
    ramSlider.addEventListener('input', updateRamDisplay);
    updateRamDisplay();
  }

  // ===== File Browser =====
  let fbSelectedPath = null;

  async function loadFbDir(path) {
    const list = document.getElementById('fb-list');
    const pathEl = document.getElementById('fb-current-path');
    const token = window.__token;
    if (!token) return;
    try {
      const res = await fetch(`/api/fs/list?token=${token}&path=${encodeURIComponent(path)}`);
      if (!res.ok) { list.innerHTML = '<div style="padding:12px;color:var(--red)">Cannot access</div>'; return; }
      const data = await res.json();
      pathEl.textContent = data.path;
      let html = '';
      if (data.parent) {
        html += `<div class="fb-item fb-back" data-path="${escHtml(data.parent)}"><span class="fb-icon">\u2190</span><span class="fb-name">.. (up)</span></div>`;
      }
      for (const item of data.items) {
        html += `<div class="fb-item" data-path="${escHtml(item.path)}"><span class="fb-icon">\uD83D\uDCC1</span><span class="fb-name">${escHtml(item.name)}</span></div>`;
      }
      list.innerHTML = html;
      list.querySelectorAll('.fb-item').forEach(el => {
        el.addEventListener('click', () => {
          if (el.classList.contains('fb-back')) {
            loadFbDir(el.dataset.path);
          } else {
            list.querySelectorAll('.fb-item').forEach(i => i.classList.remove('active'));
            el.classList.add('active');
            fbSelectedPath = el.dataset.path;
            document.getElementById('fb-select-btn').disabled = false;
          }
        });
        el.addEventListener('dblclick', () => {
          if (!el.classList.contains('fb-back')) {
            loadFbDir(el.dataset.path);
          }
        });
      });
    } catch { list.innerHTML = '<div style="padding:12px;color:var(--red)">Error loading</div>'; }
  }

  document.getElementById('sv-browse-btn')?.addEventListener('click', () => {
    fbSelectedPath = null;
    document.getElementById('fb-select-btn').disabled = true;
    document.getElementById('fb-overlay').classList.remove('hidden');
    loadFbDir('/home');
  });

  document.getElementById('fb-cancel-btn')?.addEventListener('click', () => {
    document.getElementById('fb-overlay').classList.add('hidden');
  });

  document.getElementById('fb-select-btn')?.addEventListener('click', () => {
    if (fbSelectedPath) {
      document.getElementById('sv-path').value = fbSelectedPath;
      document.getElementById('fb-overlay').classList.add('hidden');
    }
  });

  // ===== My Images PFP =====
  window.loadMyImages = async function() {
    const token = window.__token;
    if (!token) return;
    const grid = document.getElementById('myimages-grid');
    if (!grid) return;
    try {
      const res = await fetch(`/api/images?token=${token}`);
      if (!res.ok) { grid.innerHTML = '<span class="myimages-empty">Failed to load</span>'; return; }
      const data = await res.json();
      if (!data.images.length) { grid.innerHTML = '<span class="myimages-empty">No images uploaded.</span>'; return; }
      grid.innerHTML = data.images.map(img => `
        <div class="myimages-item">
          <img src="${img.url}" alt="${escHtml(img.filename)}" loading="lazy">
          <button class="myimages-pfp-btn" data-filename="${escHtml(img.filename)}">Set as PFP</button>
        </div>
      `).join('');
      grid.querySelectorAll('.myimages-pfp-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
          const filename = btn.dataset.filename;
          btn.disabled = true; btn.textContent = '...';
          try {
            const res = await fetch(`/api/images/${encodeURIComponent(filename)}/set-pfp?token=${token}`, { method: 'POST' });
            if (res.ok) {
              const d = await res.json();
              document.getElementById('nav-pfp').src = `/uploads/pfps/${d.filename}`;
              if (typeof showToast === 'function') showToast('PFP updated!', 'success');
            } else { if (typeof showToast === 'function') showToast('Failed', 'error'); }
          } catch { if (typeof showToast === 'function') showToast('Error', 'error'); }
          btn.disabled = false; btn.textContent = 'Set as PFP';
        });
      });
    } catch { grid.innerHTML = '<span class="myimages-empty">Error</span>'; }
  };

  document.getElementById('myimages-upload-btn')?.addEventListener('click', () => {
    document.getElementById('myimages-input')?.click();
  });

  document.getElementById('myimages-input')?.addEventListener('change', async () => {
    const file = document.getElementById('myimages-input').files?.[0];
    if (!file) return;
    const token = window.__token;
    if (!token) return;
    const form = new FormData();
    form.append('token', token);
    form.append('file', file);
    const btn = document.getElementById('myimages-upload-btn');
    if (btn) { btn.disabled = true; btn.textContent = 'Uploading...'; }
    try {
      const res = await fetch('/api/upload/image', { method: 'POST', body: form });
      if (res.ok) { showToast('Image uploaded!', 'success'); loadMyImages(); }
      else { showToast('Upload failed', 'error'); }
    } catch { showToast('Upload error', 'error'); }
    if (btn) { btn.disabled = false; btn.textContent = 'Upload Image'; }
    document.getElementById('myimages-input').value = '';
  });

  // ===== Status strip =====
  function connectStatusStrip() {
    const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
    let reconnectTimer;
    function connect() {
      const sid = window.getServerId();
      const ws = new WebSocket(`${proto}//${location.host}/ws/metrics?server_id=${sid}`);
      ws.onmessage = (e) => {
        try {
          const msg = JSON.parse(e.data);
          if (msg.type !== 'metrics') return;
          const s = msg.data, p = msg.process, r = msg.running;
          document.getElementById('strip-cpu').textContent = (s.cpu?.percent ?? 0).toFixed(1) + '%';
          const used = ((s.memory?.used || 0) / 1024**3).toFixed(1);
          const total = ((s.memory?.total || 1) / 1024**3).toFixed(1);
          document.getElementById('strip-ram').textContent = used + '/' + total + ' GB';
          document.getElementById('strip-mc-cpu').textContent = r && p ? (p.cpu_percent ?? 0).toFixed(1) + '%' : 'OFF';
          document.getElementById('strip-mc-ram').textContent = r && p ? (p.memory_rss / 1024**3).toFixed(2) + ' GB' : '0 GB';
          const dot = document.getElementById('strip-dot');
          if (dot) dot.className = 'strip-dot' + (r ? ' online' : '');
          document.getElementById('strip-status').textContent = r ? 'Online' : 'Offline';
        } catch {}
      };
      ws.onclose = () => { reconnectTimer = setTimeout(connect, 3000); };
    }
    connect();
  }
  connectStatusStrip();
  if (typeof initConsole === 'function') initConsole();

  // ===== Admin tabs =====
  document.querySelectorAll('.admin-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.admin-tab').forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.admin-tab-content').forEach(c => c.classList.remove('active'));
      tab.classList.add('active');
      const content = document.querySelector(`.admin-tab-content[data-adtab="${tab.dataset.adtab}"]`);
      if (content) content.classList.add('active');
      if (tab.dataset.adtab === 'plan') loadPlan();
    });
  });

  async function loadPlan() {
    const token = window.__token;
    if (!token) return;
    const el = document.getElementById('plan-content');
    if (!el) return;
    try {
      const res = await fetch(`/api/admin/plan?token=${token}`);
      if (!res.ok) { el.textContent = 'Failed to load plan'; return; }
      const data = await res.json();
      el.innerHTML = renderMarkdown(data.content || '# No plan');
    } catch { el.textContent = 'Error loading plan'; }
  }

  function renderMarkdown(text) {
    const lines = text.split('\n');
    let html = '';
    for (const line of lines) {
      if (line.startsWith('# ')) html += `<h1 class="plan-h1">${esc(line.slice(2))}</h1>`;
      else if (line.startsWith('## ')) html += `<h2 class="plan-h2">${esc(line.slice(3))}</h2>`;
      else if (line.startsWith('### ')) html += `<h3 class="plan-h3">${esc(line.slice(4))}</h3>`;
      else if (line.startsWith('- [x]')) html += `<div class="plan-done">${esc(line.slice(5))}</div>`;
      else if (line.startsWith('- [ ]')) html += `<div class="plan-todo">${esc(line.slice(5))}</div>`;
      else if (line.startsWith('- ')) html += `<div class="plan-li">\u2022 ${esc(line.slice(2))}</div>`;
      else if (line.trim() === '') html += '<br>';
      else html += `<div class="plan-text">${esc(line)}</div>`;
    }
    return html;
  }

  // ===== Admin Panel =====
  window.loadAdminPanel = async function() {
    const token = window.__token;
    if (!token) return;
    try {
      const res = await fetch(`/api/admin/users?token=${token}`);
      if (!res.ok) return;
      const users = await res.json();
      const tbody = document.getElementById('admin-tbody');
      tbody.innerHTML = '';
      for (const u of users) {
        const tr = document.createElement('tr');
        const perms = u.permissions || {};
        const created = u.created_at ? new Date(u.created_at + 'Z').toLocaleDateString() : '\u2014';
        tr.innerHTML = `
          <td class="admin-username-cell">${esc(u.username)}</td>
          <td>${esc(u.role)}</td>
          <td>${created}</td>
          <td class="admin-perms-cell">
            <label class="admin-perm-chk"><input type="checkbox" class="perm-cb" data-user="${esc(u.username)}" data-perm="dashboard" ${perms.dashboard?'checked':''}> Dash</label>
            <label class="admin-perm-chk"><input type="checkbox" class="perm-cb" data-user="${esc(u.username)}" data-perm="files" ${perms.files?'checked':''}> Files</label>
            <label class="admin-perm-chk"><input type="checkbox" class="perm-cb" data-user="${esc(u.username)}" data-perm="backups" ${perms.backups?'checked':''}> Backups</label>
            <label class="admin-perm-chk"><input type="checkbox" class="perm-cb" data-user="${esc(u.username)}" data-perm="settings" ${perms.settings?'checked':''}> Settings</label>
          </td>
          <td class="admin-actions-cell">
            <button class="btn btn-sm btn-primary admin-edit-btn" data-user="${esc(u.username)}">Edit</button>
            <button class="btn btn-sm btn-danger admin-del-btn" data-user="${esc(u.username)}">Delete</button>
          </td>`;
        tbody.appendChild(tr);
      }

      tbody.querySelectorAll('.perm-cb').forEach(cb => {
        cb.addEventListener('change', async () => {
          const username = cb.dataset.user;
          const row = cb.closest('tr');
          const perms = {};
          row.querySelectorAll('.perm-cb').forEach(c => { perms[c.dataset.perm] = c.checked; });
          await fetch(`/api/admin/users/${encodeURIComponent(username)}/permissions?token=${token}`, {
            method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ permissions: perms }),
          });
        });
      });

      tbody.querySelectorAll('.admin-del-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
          if (!confirm('Delete user ' + btn.dataset.user + '?')) return;
          const res = await fetch(`/api/admin/users/${encodeURIComponent(btn.dataset.user)}?token=${token}`, { method: 'DELETE' });
          if (res.ok) loadAdminPanel();
        });
      });

      tbody.querySelectorAll('.admin-edit-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          const username = btn.dataset.user;
          const row = btn.closest('tr');
          const isEditing = row.classList.contains('admin-editing');
          if (isEditing) {
            const newUsername = row.querySelector('.admin-edit-username')?.value;
            const newPassword = row.querySelector('.admin-edit-password')?.value;
            const newRole = row.querySelector('.admin-edit-role')?.value;
            const updates = {};
            if (newUsername && newUsername !== username) updates.new_username = newUsername;
            if (newPassword) updates.password = newPassword;
            if (newRole) updates.role = newRole;
            if (Object.keys(updates).length === 0) { row.classList.remove('admin-editing'); btn.textContent = 'Edit'; return; }
            fetch(`/api/admin/users/${encodeURIComponent(username)}?token=${token}`, {
              method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(updates),
            }).then(r => { if (r.ok) loadAdminPanel(); });
          } else {
            const roleCell = row.cells[1];
            const currentRole = roleCell.textContent.trim();
            row.classList.add('admin-editing');
            const usernameCell = row.querySelector('.admin-username-cell');
            usernameCell.innerHTML = `<input class="admin-edit-username" value="${esc(username)}" maxlength="24">`;
            roleCell.innerHTML = `<select class="admin-edit-role"><option value="user" ${currentRole==='user'?'selected':''}>user</option><option value="owner" ${currentRole==='owner'?'selected':''}>owner</option></select>`;
            const actionsCell = row.querySelector('.admin-actions-cell');
            const pwInput = document.createElement('input');
            pwInput.type = 'password'; pwInput.className = 'admin-edit-password'; pwInput.placeholder = 'new pwd';
            pwInput.style.width = '100px';
            actionsCell.insertBefore(pwInput, actionsCell.firstChild);
            btn.textContent = 'Save';
          }
        });
      });
    } catch {}
  };

  function esc(s) { const d = document.createElement('div'); d.textContent = s; return d.innerHTML; }
});
