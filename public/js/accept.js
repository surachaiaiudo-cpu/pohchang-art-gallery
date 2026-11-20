// Acceptance page /accept/<slug>: find your name, check the details staff entered, fill in the 20th reply form, sign.
import { api, esc, applyTheme, toast, icons, slugFromPath } from './core.js';
import { imageProblem, uploadImage, fitForUpload } from './upload.js';
import { t, pick, fmtDate, applyStatic, mountSwitcher, localError, locale } from './i18n.js';
import { countryOptions, countryName } from './countries.js';

applyStatic();
mountSwitcher(document.getElementById('lang'));

const slug = slugFromPath(1);
const base = `/api/x/${encodeURIComponent(slug)}/accept`;
const $ = (id) => document.getElementById(id);
const checked = (name) => (document.querySelector(`input[name="${name}"]:checked`) || {}).value || '';
const MIN_PIXELS = 5e6;

let ex = null;
let artist = null;
let ticket = '';
let useTurnstile = false;
let photo = { busy: false, file: null };
let exSeq = 0;

// ---------------------------------------------------------------- anti-spam ticket (as on the submission form)
async function getTicket(token) {
  const d = await api(`${base}/ticket`, { method: 'POST', body: { turnstile: token || '' } });
  ticket = d.ticket;
}
async function ensureTicket() {
  if (ticket) return;
  if (useTurnstile) throw new Error(t('errHuman'));
  await getTicket('');
}
function setupTurnstile(siteKey) {
  window.onTurnstileLoad = () => {
    window.turnstile.render('#turnstile', {
      sitekey: siteKey,
      language: { th: 'th', en: 'en', zh: 'zh-cn' }[document.documentElement.lang.slice(0, 2)] || 'auto',
      callback: async (token) => { try { await getTicket(token); } catch (e) { toast(localError(e.message), 'error'); } }
    });
  };
  const s = document.createElement('script');
  s.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?onload=onTurnstileLoad&render=explicit';
  s.async = true;
  document.head.appendChild(s);
}

// ---------------------------------------------------------------- step 1: find the name
let searchTimer = null;
let searchSeq = 0;
async function search() {
  const q = $('q').value.trim();
  const seq = ++searchSeq;
  if (q.length < 2) { $('results').innerHTML = ''; return; }
  try {
    const d = await api(`${base}?q=${encodeURIComponent(q)}`);
    if (seq !== searchSeq) return;
    $('results').innerHTML = d.results.length
      ? d.results.map((a) => `<li><button type="button" class="ac-hit" data-id="${Number(a.id)}">
          <span><strong>${esc(a.name_en || a.name_th)}</strong>${a.name_en && a.name_th && a.name_th !== a.name_en ? ` <span class="muted">${esc(a.name_th)}</span>` : ''}
          <span class="small muted">${esc(countryName(a.nationality, locale))}</span>
          ${a.signed ? `<span class="ac-tag">✓ ${esc(t('acSignedTag'))}</span>` : ''}</span>
          <span class="btn btn-sm">${esc(t('acPick'))}</span></button></li>`).join('')
      : `<li class="muted">${esc(t('acNoMatch'))}</li>`;
  } catch (e) {
    if (seq === searchSeq) $('results').innerHTML = `<li class="error-text">${esc(localError(e.message))}</li>`;
  }
}

// ---------------------------------------------------------------- step 2: the form
function exRow(year = '', detail = '') {
  const k = `ex${++exSeq}`;
  return `<div class="ac-ex" data-key="${k}">
      <input type="text" class="ac-ex-year" id="${k}-year" maxlength="20" inputmode="numeric" placeholder="${esc(t('acYear'))}" aria-label="${esc(t('acYear'))}" value="${esc(year)}">
      <input type="text" id="${k}-detail" maxlength="500" placeholder="${esc(t('acExDetail'))}" aria-label="${esc(t('acExDetail'))}" value="${esc(detail)}">
    </div>`;
}

function resetPhoto() {
  photo = { busy: false, file: null };
  const has = !!(artist && artist.photo);
  $('photo').classList.toggle('has-image', has);
  $('photo').innerHTML = has
    ? `<img src="${esc(artist.photo)}" alt=""><span class="drop-text">${esc(t('acPhotoOnFile'))}</span>`
    : `${icons.upload}<span class="drop-text">${esc(t('tapPhoto'))}</span>`;
  $('photo-req').hidden = has;
}

async function openArtist(id) {
  try {
    const d = await api(`${base}/${Number(id)}`);
    artist = d.artist;
  } catch (e) { toast(localError(e.message), 'error'); return; }
  $('form').reset();
  $('who').textContent = artist.name_en || artist.name_th;
  $('again').hidden = !artist.signed_at;
  if (artist.signed_at) $('again').textContent = t('acAgain', { d: fmtDate(`${artist.signed_at.replace(' ', 'T')}Z`) });
  $('name_en').value = artist.name_en || '';
  $('name_th').value = artist.name_th && artist.name_th !== artist.name_en ? artist.name_th : '';
  $('nationality').value = artist.nationality || '';
  $('affiliation').value = artist.affiliation || '';
  $('email-hint').textContent = artist.email_hint ? t('acKeep', { v: artist.email_hint }) : '';
  $('phone-hint').textContent = artist.phone_hint ? t('acKeep', { v: artist.phone_hint }) : '';
  $('email-req').hidden = !!artist.email_hint;
  $('exhibitions').innerHTML = exRow() + exRow() + exRow();
  $('type-other-wrap').hidden = true;
  $('followers-agree-wrap').hidden = true;
  $('form-error').textContent = '';
  resetPhoto();
  $('find').hidden = true;
  $('form').hidden = false;
  window.scrollTo(0, 0);
}

let pickTarget = false;
function openPicker() {
  if (photo.busy) return;
  pickTarget = true;
  $('picker').value = '';
  $('picker').click();
}

const pixelsOf = (file) => new Promise((resolve) => {
  const url = URL.createObjectURL(file);
  const img = new Image();
  img.onload = () => { resolve(img.naturalWidth * img.naturalHeight); URL.revokeObjectURL(url); };
  img.onerror = () => { resolve(0); URL.revokeObjectURL(url); };
  img.src = url;
});

async function handleFile(file) {
  const problem = imageProblem(file);
  if (problem) { toast(t({ noFile: 'errNoFile', type: 'errFileType', big: 'errFileBig' }[problem]), 'error'); return; }
  const px = await pixelsOf(file);
  if (px && px < MIN_PIXELS) { toast(t('acPhotoSmall', { mp: (px / 1e6).toFixed(1) }), 'error'); return; }
  try { await ensureTicket(); } catch (e) { toast(localError(e.message), 'error'); return; }
  const drop = $('photo');
  const preview = URL.createObjectURL(file);
  photo = { busy: true, file: null };
  drop.classList.add('has-image');
  drop.innerHTML = `<img src="${preview}" alt="${esc(t('chosenImage'))}"><div class="progress" aria-label="${esc(t('progress'))}"><span></span></div><span class="drop-text">${esc(t('preparing'))}</span>`;
  const bar = drop.querySelector('.progress > span');
  const label = drop.querySelector('.drop-text');
  try {
    const { upload } = await api(`${base}/upload-auth`, { method: 'POST', body: { ticket } });
    const fitted = await fitForUpload(file, upload.maxBytes, upload.maxPixels);
    label.textContent = fitted.resized ? t('uploadingResized', { w: fitted.width, h: fitted.height }) : t('uploading');
    const res = await uploadImage(fitted.file, upload, (p) => { bar.style.width = `${p}%`; });
    photo = { busy: false, file: res };
    label.textContent = t('uploaded');
  } catch (e) {
    resetPhoto();
    toast(localError(e.message), 'error');
    if (e.data && e.data.ticketExpired) ticket = '';
  }
}

function collect() {
  const val = (id) => $(id).value.trim();
  return {
    title: checked('title'),
    name_en: val('name_en'), name_th: val('name_th'), nationality: val('nationality'), age: val('age'),
    edu_institution: val('edu_institution'), edu_field: val('edu_field'), edu_degree: val('edu_degree'),
    affiliation: val('affiliation'), email: val('email'), phone: val('phone'), contact_address: val('contact_address'),
    exhibitions: [...document.querySelectorAll('.ac-ex')].map((r) => ({ year: val(`${r.dataset.key}-year`), detail: val(`${r.dataset.key}-detail`) })),
    types: [...document.querySelectorAll('input[name="types"]:checked')].map((x) => x.value),
    type_other: val('type_other'),
    peer_review: checked('peer'),
    food: { vegetarian: $('food_veg').checked, halal: $('food_halal').checked, allergy: val('food_allergy'), other: val('food_other') },
    followers: val('followers') || '0', followers_agree: $('followers_agree').checked,
    agree_conditions: $('agree_conditions').checked,
    filled_by: checked('filled_by') || 'self',
    signed_name: val('signed_name'),
    agree_accept: $('agree_accept').checked,
    photo_file: photo.file || undefined
  };
}

// [element to focus, message] or null
function validate(d) {
  if (!d.name_en) return ['name_en', t('acErrName')];
  if (!d.nationality) return ['nationality', t('acErrNat')];
  if (!d.email && !artist.email_hint) return ['email', t('acErrEmail')];
  if (d.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(d.email)) return ['email', t('errEmail')];
  if (photo.busy) return ['photo', t('uploading')];
  if (!d.photo_file && !artist.photo) return ['photo', t('acErrPhoto')];
  if (!d.types.length) return ['types', t('acErrTypes')];
  if (d.types.includes('mixed_other') && !d.type_other) return ['type_other', t('acErrTypeOther')];
  if (!d.peer_review) return ['peer', t('acErrPeer')];
  if (Number(d.followers) > 0 && !d.followers_agree) return ['followers_agree', t('acErrFollowers')];
  if (!d.agree_conditions) return ['agree_conditions', t('acErrNotes')];
  if (d.signed_name.length < 2) return ['signed_name', t('acErrSign')];
  if (!d.agree_accept) return ['agree_accept', t('acErrAccept')];
  return null;
}

async function send(e) {
  e.preventDefault();
  const data = collect();
  const problem = validate(data);
  $('form-error').textContent = problem ? problem[1] : '';
  if (problem) {
    const el = $(problem[0]);
    const target = el && (el.matches('input, select, textarea') ? el : el.querySelector('input, select, textarea') || el);
    if (target) { target.focus(); target.scrollIntoView({ block: 'center', behavior: 'smooth' }); }
    return;
  }
  $('send').disabled = true;
  $('send').textContent = t('sending');
  try {
    await ensureTicket();
    const d = await api(`${base}/${Number(artist.id)}`, { method: 'POST', body: { ticket, ...data } });
    $('form').hidden = true;
    $('done').hidden = false;
    $('done-text').textContent = `${t('acDoneText', { name: d.name })}${d.again ? ` ${t('acDoneAgain')}` : ''}`;
    window.scrollTo(0, 0);
  } catch (err) {
    $('form-error').textContent = localError(err.message);
    if (err.data && err.data.ticketExpired) ticket = '';
  } finally {
    $('send').disabled = false;
    $('send').textContent = t('acSend');
  }
}

function backToFind() {
  artist = null;
  $('form').hidden = true;
  $('done').hidden = true;
  $('find').hidden = false;
  $('q').value = '';
  $('results').innerHTML = '';
  $('q').focus();
}

// ---------------------------------------------------------------- wiring
$('q').addEventListener('input', () => { clearTimeout(searchTimer); searchTimer = setTimeout(search, 250); });
$('results').addEventListener('click', (e) => { const b = e.target.closest('.ac-hit'); if (b) openArtist(b.dataset.id); });
$('change').addEventListener('click', backToFind);
$('another').addEventListener('click', backToFind);
$('add-ex').addEventListener('click', () => {
  if (document.querySelectorAll('.ac-ex').length < 10) $('exhibitions').insertAdjacentHTML('beforeend', exRow());
});
$('photo').addEventListener('click', openPicker);
$('photo').addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openPicker(); } });
$('picker').addEventListener('change', (e) => { const f = e.target.files[0]; if (pickTarget && f) handleFile(f); pickTarget = false; });
$('types').addEventListener('change', () => {
  $('type-other-wrap').hidden = !document.querySelector('input[name="types"][value="mixed_other"]').checked;
});
$('followers').addEventListener('input', () => { $('followers-agree-wrap').hidden = !(Number($('followers').value) > 0); });
$('form').addEventListener('submit', send);

async function main() {
  try {
    const [d, cfg] = await Promise.all([api(base), api('/api/config')]);
    ex = d.exhibition;
    applyTheme(ex);
    const title = pick(ex, 'title');
    $('ex-name').textContent = title;
    $('ex-title').textContent = title;
    document.title = `${t('acTitle')} · ${title}`;
    if (!ex.open) {
      $('intro').innerHTML = `<div class="notice">${esc(ex.closed ? t('acClosed') : t('acNotOpen'))}</div>`;
      return;
    }
    $('intro').innerHTML = ex.closes_on ? `<p class="ac-deadline">${esc(t('acReplyBy', { d: fmtDate(ex.closes_on) }))}</p>` : '';
    $('nationality').innerHTML = `<option value="">${esc(t('pickCountry'))}</option>${countryOptions(locale, '', esc)}`;
    $('find').hidden = false;
    useTurnstile = !!cfg.turnstileSiteKey;
    if (useTurnstile) setupTurnstile(cfg.turnstileSiteKey);
  } catch (e) {
    $('intro').innerHTML = `<p class="error-text">${esc(localError(e.message))}</p>`;
  }
}
main();
