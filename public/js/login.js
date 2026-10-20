import { api } from './core.js';

const $ = (id) => document.getElementById(id);

async function goHome() {
  const me = await api('/api/auth/me');
  const next = new URLSearchParams(location.search).get('next');
  if (next && next.startsWith('/') && !next.startsWith('//')) { location.href = next; return; }
  if (me.user.role === 'admin') location.href = '/admin';
  else if (me.exhibitions.length === 1) location.href = `/manage/${encodeURIComponent(me.exhibitions[0].slug)}`;
  else location.href = '/admin';
}

function showChange(prefill) {
  $('login').hidden = true;
  $('change').hidden = false;
  if (prefill) $('cur').value = prefill;
  $('next').focus();
}

$('login').addEventListener('submit', async (e) => {
  e.preventDefault();
  $('err').textContent = '';
  try {
    const d = await api('/api/auth/login', { method: 'POST', body: { email: $('email').value, password: $('password').value } });
    if (d.user.mustChangePassword) showChange($('password').value);
    else await goHome();
  } catch (err) {
    $('err').textContent = err.message;
  }
});

$('change').addEventListener('submit', async (e) => {
  e.preventDefault();
  $('err2').textContent = '';
  if ($('next').value !== $('next2').value) { $('err2').textContent = 'รหัสผ่านใหม่ทั้งสองช่องไม่ตรงกัน'; return; }
  try {
    await api('/api/auth/password', { method: 'POST', body: { current: $('cur').value, next: $('next').value } });
    await goHome();
  } catch (err) {
    $('err2').textContent = err.message;
  }
});

// Already signed in?
api('/api/auth/me').then((me) => {
  if (!me.user) return;
  if (me.user.mustChangePassword) showChange('');
  else goHome();
}).catch(() => {});
