document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('login-form');
  const errorEl = document.getElementById('login-error');
  const overlay = document.getElementById('login-overlay');
  const submitBtn = document.getElementById('login-submit');
  const toggleBtn = document.getElementById('login-toggle-btn');
  const toggleText = document.getElementById('login-toggle-text');
  const confirmField = document.getElementById('login-confirm-field');
  const headerTitle = document.querySelector('.login-header h2');
  const headerDesc = document.querySelector('.login-header p');
  const usernameInput = document.getElementById('login-username');
  const passwordInput = document.getElementById('login-password');
  const confirmInput = document.getElementById('login-confirm');

  let isRegister = false;

  toggleBtn.addEventListener('click', () => {
    isRegister = !isRegister;
    errorEl.textContent = '';
    if (isRegister) {
      headerTitle.textContent = 'Create Account';
      headerDesc.textContent = 'Register a new account';
      submitBtn.textContent = 'Create Account';
      confirmField.classList.remove('hidden');
      toggleText.textContent = 'Already have an account?';
      toggleBtn.textContent = 'Sign In';
      usernameInput.placeholder = 'choose a username';
      passwordInput.placeholder = 'choose a password';
    } else {
      headerTitle.textContent = 'MC Panel';
      headerDesc.textContent = 'Sign in to manage your server';
      submitBtn.textContent = 'Sign In';
      confirmField.classList.add('hidden');
      toggleText.textContent = 'No account?';
      toggleBtn.textContent = 'Create Account';
      usernameInput.placeholder = 'username';
      passwordInput.placeholder = 'password';
    }
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    errorEl.textContent = '';
    const username = usernameInput.value.trim();
    const password = passwordInput.value;
    const remember = document.getElementById('login-remember')?.checked || false;

    if (!username || !password) { errorEl.textContent = 'Fill in all fields'; return; }

    if (isRegister) {
      const confirm = confirmInput.value;
      if (password !== confirm) { errorEl.textContent = 'Passwords do not match'; return; }
      if (password.length < 3) { errorEl.textContent = 'Password must be at least 3 characters'; return; }
      if (username.length < 2 || username.length > 24) { errorEl.textContent = 'Username must be 2–24 characters'; return; }
      try {
        const res = await fetch('/api/auth/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username, password }),
        });
        if (res.status === 409) { errorEl.textContent = 'Username already taken'; return; }
        if (!res.ok) { errorEl.textContent = 'Registration failed'; return; }
        const data = await res.json();
        localStorage.setItem('mc-token', data.token);
        overlay.classList.add('hidden');
        window.dispatchEvent(new CustomEvent('auth-login', { detail: data }));
      } catch {
        errorEl.textContent = 'Connection error';
      }
    } else {
      try {
        const res = await fetch('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username, password, remember }),
        });
        if (!res.ok) { errorEl.textContent = 'Invalid username or password'; return; }
        const data = await res.json();
        localStorage.setItem('mc-token', data.token);
        overlay.classList.add('hidden');
        window.dispatchEvent(new CustomEvent('auth-login', { detail: data }));
      } catch {
        errorEl.textContent = 'Connection error';
      }
    }
  });
});
