import { api, esc, applyTheme, toast, icons, slugFromPath } from './core.js';
import { imageProblem, uploadImage, fitForUpload } from './upload.js';
import { t, pick, fmtDate, fmtTime, catName, subName, applyStatic, mountSwitcher, localError, lang, locale } from './i18n.js';
import { countryOptions, flagUrl, canShowFlagEmoji } from './countries.js';

applyStatic();
mountSwitcher(document.getElementById('lang'));

const slug = slugFromPath(1);
const base = `/e/${encodeURIComponent(slug)}`;
let ex = null;
let ticket = '';
let useTurnstile = false;
const uploads = {};      // target key -> { busy, file: Cloudinary upload result }
let workSeq = 0;

const $ = (id) => document.getElementById(id);
const needsVideo = (cat, sub) => /วิดีโอ|วีดิทัศน์|video|录像|视频/i.test(`${cat} ${sub}`);
const req = '<span class="req">*</span>';

const checked = (name) => (document.querySelector(`input[name="${name}"]:checked`) || {}).value || '';

// Categories are chips (radio buttons): one tap, all options visible at once.
function categoryFields(k) {
  const cats = ex.categories || [];
  if (!cats.length) return '';
  return `<div class="field"><span class="label-text" id="${k}-cat-l">${esc(t('category'))} ${req}</span>
      <div class="chips" role="radiogroup" aria-labelledby="${k}-cat-l" id="${k}-category">
        ${cats.map((c) => `<label class="chip"><input type="radio" name="${k}-cat" value="${esc(c.name)}" data-cat="${k}">${esc(catName(cats, c.name))}</label>`).join('')}
      </div></div>
    <div class="sub-box" id="${k}-sub-wrap" hidden>
      <div class="field" id="${k}-sub-field" hidden><span class="label-text" id="${k}-sub-l"></span>
        <div class="chips sub" role="radiogroup" aria-labelledby="${k}-sub-l" id="${k}-subcategory"></div></div>
      <div class="field" id="${k}-video-field" hidden><label for="${k}-video_url">${esc(t('videoUrl'))} ${req}</label>
        <input id="${k}-video_url" type="url" inputmode="url" maxlength="1000" placeholder="https://youtu.be/…">
        <span class="hint">${esc(t('videoHint'))}</span></div>
    </div>`;
}

function syncCategory(k) {
  if (!$(`${k}-category`)) return;
  const cats = ex.categories || [];
  const cat = checked(`${k}-cat`);
  const c = cats.find((x) => x.name === cat);
  const subs = c ? c.subs : [];
  const keep = checked(`${k}-sub`);
  $(`${k}-sub-field`).hidden = !subs.length;
  if (c) $(`${k}-sub-l`).innerHTML = `${esc(t('subtypeOf', { cat: catName(cats, c.name) }))} ${req}`;
  $(`${k}-subcategory`).innerHTML = subs.map((s) => `<label class="chip"><input type="radio" name="${k}-sub" value="${esc(s)}" data-sub="${k}"${s === keep ? ' checked' : ''}>${esc(subName(cats, c.name, s))}</label>`).join('');
  const video = needsVideo(cat, subs.includes(keep) ? keep : '');
  $(`${k}-video-field`).hidden = !video;
  $(`${k}-sub-wrap`).hidden = !subs.length && !video;
}

function workBlock(n) {
  const k = `work${n}`;
  const input = (f, label, { ph = '', required = false, max = 300, lang = '' } = {}) =>
    `<div class="field"><label for="${k}-${f}">${esc(t(label))}${required ? ` ${req}` : ''}</label>
      <input id="${k}-${f}" type="text" maxlength="${max}"${ph ? ` placeholder="${esc(t(ph))}"` : ''}${lang ? ` lang="${lang}"` : ''}></div>`;
  const area = (f, label, lang = '') =>
    `<div class="field"><label for="${k}-${f}">${esc(t(label))}</label><textarea id="${k}-${f}" maxlength="4000"${lang ? ` lang="${lang}"` : ''}></textarea></div>`;
  return `<fieldset class="work-block" data-key="${k}">
    <legend><span class="step-no">2</span><span>${esc(t('workN'))} <span class="wnum"></span></span><span class="muted wof" style="margin-left:auto;font-family:var(--font-body);font-weight:500;font-size:.9rem"></span></legend>
    ${categoryFields(k)}
    <div class="field">
      <span class="label-text" id="${k}-img-label">${esc(t('image'))} ${req}</span>
      <div class="drop" data-kind="work" data-target="${k}" tabindex="0" role="button" aria-labelledby="${k}-img-label">
        ${icons.upload}<span class="drop-text">${esc(t('tapImage'))}</span>
      </div>
      <span class="hint">${esc(t('imageHint'))}</span>
    </div>
    <div class="grid-2">
      ${input('title_th', 'title', { required: true })}
      ${input('technique_th', 'techniqueReq', { required: true, ph: 'techniquePh' })}
      ${input('dimensions', 'size', { max: 120, ph: 'sizePh' })}
      ${input('year_created', 'year', { max: 20, ph: 'yearPh' })}
    </div>
    ${area('concept_th', 'concept')}
    <details class="translations">
      <summary>${esc(t('translations'))}</summary>
      <div class="grid-2">
        ${input('title_en', 'titleEn', { lang: 'en' })}
        ${input('title_zh', 'titleZh', { lang: 'zh-Hans' })}
        ${input('technique_en', 'techniqueEn', { lang: 'en' })}
        ${input('technique_zh', 'techniqueZh', { lang: 'zh-Hans' })}
      </div>
      ${area('concept_en', 'conceptEn', 'en')}
      ${area('concept_zh', 'conceptZh', 'zh-Hans')}
    </details>
    <p style="margin:0"><button type="button" class="btn btn-ghost remove-work">${esc(t('removeWork'))}</button></p>
  </fieldset>`;
}

function renumber() {
  const blocks = [...document.querySelectorAll('.work-block')];
  const max = Number(ex.max_works_per_artist);
  blocks.forEach((b, i) => {
    b.querySelector('.wnum').textContent = i + 1;
    b.querySelector('.wof').textContent = t('nOfMax', { n: i + 1, max });
  });
  blocks.forEach((b) => { b.querySelector('.remove-work').hidden = blocks.length === 1; });
  $('add-work').hidden = blocks.length >= max;
  $('add-work').textContent = t('addWorkLeft', { n: max - blocks.length });
}

function addWork() {
  workSeq += 1;
  $('works').insertAdjacentHTML('beforeend', workBlock(workSeq));
  renumber();
}

async function getTicket(turnstileToken) {
  const d = await api(`/api/x/${encodeURIComponent(slug)}/ticket`, { method: 'POST', body: { turnstile: turnstileToken || '' } });
  ticket = d.ticket;
}

// A submission ticket is only requested when the artist actually starts (first upload or send),
// so people who just look at the form do not use up the per-network limit.
async function ensureTicket() {
  if (ticket) return;
  if (useTurnstile) throw new Error(t('errHuman'));
  await getTicket('');
}

function setupTurnstile(siteKey) {
  return new Promise((resolve) => {
    window.onTurnstileLoad = () => {
      window.turnstile.render('#turnstile', {
        sitekey: siteKey,
        language: { th: 'th', en: 'en', zh: 'zh-cn' }[document.documentElement.lang.slice(0, 2)] || 'auto',
        callback: async (token) => { try { await getTicket(token); resolve(); } catch (e) { toast(localError(e.message), 'error'); } }
      });
    };
    const s = document.createElement('script');
    s.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?onload=onTurnstileLoad&render=explicit';
    s.async = true;
    document.head.appendChild(s);
  });
}

let pickTarget = null;
function openPicker(drop) {
  if (uploads[drop.dataset.target]?.busy) return;
  pickTarget = drop;
  $('picker').value = '';
  $('picker').click();
}

const FILE_ERR = { noFile: 'errNoFile', type: 'errFileType', big: 'errFileBig' };

async function handleFile(drop, file) {
  const key = drop.dataset.target;
  const problem = imageProblem(file);
  if (problem) { toast(t(FILE_ERR[problem]), 'error'); return; }
  try { await ensureTicket(); } catch (e) { toast(localError(e.message), 'error'); return; }
  const preview = URL.createObjectURL(file);
  uploads[key] = { busy: true, file: null };
  drop.classList.add('has-image');
  drop.innerHTML = `<img src="${preview}" alt="${esc(t('chosenImage'))}"><div class="progress" aria-label="${esc(t('progress'))}"><span></span></div><span class="drop-text">${esc(t('preparing'))}</span>`;
  const bar = drop.querySelector('.progress > span');
  const label = drop.querySelector('.drop-text');
  try {
    const { upload } = await api(`/api/x/${encodeURIComponent(slug)}/upload-auth`, { method: 'POST', body: { ticket, kind: drop.dataset.kind } });
    const fitted = await fitForUpload(file, upload.maxBytes, upload.maxPixels);
    label.textContent = fitted.resized ? t('uploadingResized', { w: fitted.width, h: fitted.height }) : t('uploading');
    const res = await uploadImage(fitted.file, upload, (p) => { bar.style.width = `${p}%`; });
    uploads[key] = { busy: false, file: res };
    label.textContent = fitted.resized ? t('uploadedResized', { mb: (fitted.file.size / 1048576).toFixed(1) }) : t('uploaded');
  } catch (e) {
    uploads[key] = { busy: false, file: null };
    drop.classList.remove('has-image');
    drop.innerHTML = `${icons.upload}<span class="drop-text">${esc(t('uploadFailed'))}</span>`;
    toast(localError(e.message), 'error');
    if (e.data && e.data.ticketExpired) ticket = '';
  }
}

function collect() {
  const val = (id) => ($(id) ? $(id).value.trim() : '');
  const artist = {
    name_th: val('name_th'), name_en: val('name_en'), name_zh: val('name_zh'), academic_title_th: val('academic_title_th'),
    email: val('email'), phone: val('phone'), nationality: val('nationality'), affiliation: val('affiliation'),
    bio_th: val('bio_th'), bio_en: val('bio_en'), bio_zh: val('bio_zh'), avatar_file: uploads.avatar?.file || undefined
  };
  const works = [...document.querySelectorAll('.work-block')].map((b) => {
    const k = b.dataset.key;
    const f = (name) => val(`${k}-${name}`);
    return {
      category: checked(`${k}-cat`), subcategory: checked(`${k}-sub`), video_url: f('video_url'),
      title_th: f('title_th'), title_en: f('title_en'), title_zh: f('title_zh'),
      technique_th: f('technique_th'), technique_en: f('technique_en'), technique_zh: f('technique_zh'),
      dimensions: f('dimensions'), year_created: f('year_created'),
      concept_th: f('concept_th'), concept_en: f('concept_en'), concept_zh: f('concept_zh'),
      file: uploads[k]?.file || null
    };
  });
  return { artist, works };
}

function validate({ artist, works }) {
  if (!artist.name_th) return ['name_th', t('errName')];
  if (!artist.nationality) return ['nationality', t('errNationality')];
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(artist.email)) return ['email', t('errEmail')];
  const blocks = [...document.querySelectorAll('.work-block')];
  const cats = ex.categories || [];
  for (let i = 0; i < works.length; i++) {
    const k = blocks[i].dataset.key, n = i + 1;
    const cat = cats.find((c) => c.name === works[i].category);
    if (cats.length && !cat) return [`${k}-category`, t('errCategory', { n })];
    if (cat && cat.subs.length && !works[i].subcategory) return [`${k}-subcategory`, t('errSubtype', { n })];
    if (needsVideo(works[i].category, works[i].subcategory) && !/^https:\/\/\S+$/.test(works[i].video_url)) {
      return [`${k}-video_url`, t('errVideo', { n })];
    }
    if (uploads[k]?.busy) return [null, t('errBusy', { n })];
    if (!works[i].file) return [null, t('errImage', { n })];
    if (!works[i].title_th) return [`${k}-title_th`, t('errTitle', { n })];
    if (!works[i].technique_th) return [`${k}-technique_th`, t('errTechnique', { n })];
  }
  if (Object.values(uploads).some((u) => u.busy)) return [null, t('errWait')];
  if (!$('consent').checked) return ['consent', t('errConsent')];
  return null;
}

async function onSubmit(e) {
  e.preventDefault();
  const data = collect();
  const problem = validate(data);
  $('form-error').textContent = problem ? problem[1] : '';
  if (problem) {
    if (problem[0]) {
      const el = $(problem[0]);
      const target = el && (el.matches('input, select, textarea') ? el : el.querySelector('input, select, textarea'));
      if (target) { target.focus(); target.scrollIntoView({ block: 'center', behavior: 'smooth' }); }
    }
    return;
  }
  $('send').disabled = true;
  $('send').textContent = t('sending');
  try {
    await ensureTicket();
    const d = await api(`/api/x/${encodeURIComponent(slug)}/submit`, { method: 'POST', body: { ticket, consent: true, ...data } });
    $('form').hidden = true;
    $('intro').hidden = true;
    $('done').hidden = false;
    $('done-text').textContent = t('doneText', { name: d.name, n: d.received });
    $('done-back').href = base;
    window.scrollTo(0, 0);
  } catch (err) {
    $('form-error').textContent = localError(err.message);
    if (err.data && err.data.ticketExpired) ticket = '';
  } finally {
    $('send').disabled = false;
    $('send').textContent = t('send');
  }
}

async function main() {
  try {
    const [{ exhibition }, cfg] = await Promise.all([api(`/api/x/${encodeURIComponent(slug)}`), api('/api/config')]);
    ex = exhibition;
    applyTheme(ex);
    const title = pick(ex, 'title');
    document.title = `${t('submit')} — ${title}`;
    $('back').href = base;
    $('back').innerHTML = `${icons.arrowLeft}<span>${esc(title)}</span>`;
    $('title').textContent = title;
    if (!ex.submission.open) {
      $('intro').innerHTML = `<div class="notice">${esc(lang === 'th' ? ex.submission.reason : t('closedReason'))}</div><a class="btn btn-ghost" href="${base}">${esc(t('backToEx'))}</a>`;
      return;
    }
    const cats = ex.categories || [];
    const catList = cats.map((c) => (c.subs.length
      ? `${catName(cats, c.name)} (${c.subs.map((s) => subName(cats, c.name, s)).join(', ')})`
      : catName(cats, c.name))).join(' · ');
    $('intro').innerHTML = '';
    $('aside').innerHTML = `
      <div class="aside-card aside-dark">
        <span class="status-pill" style="justify-self:start">${esc(t('acceptingNow'))}</span>
        ${ex.submission_closes_at ? `<span class="soft">${esc(t('closesLabel'))}</span>
          <span class="big">${esc(fmtDate(ex.submission_closes_at))}</span>
          <span class="soft">${esc(t('atTime', { time: fmtTime(ex.submission_closes_at) }))}</span>` : ''}
      </div>
      <div class="aside-card">
        <h2>${esc(t('rulesTitle'))}</h2>
        <ul>
          <li>${esc(t('ruleMax', { n: Number(ex.max_works_per_artist) }))}</li>
          <li>${esc(t('fileNote'))}</li>
          <li>${esc(t('ruleScreen'))}</li>
          ${ex.review_panel_size ? `<li>${esc(t('ruleBadge', { k: ex.review_threshold, n: ex.review_panel_size, badge: pick(ex, 'badge_label') }))}</li>` : ''}
        </ul>
      </div>
      ${cats.length ? `<div class="aside-card"><h2>${esc(t('category'))}</h2><span>${esc(catList)}</span></div>` : ''}`;
    $('aside').hidden = false;
    // Flags inside the list where the system draws flag emoji; otherwise a flag image beside it.
    const emoji = canShowFlagEmoji();
    $('nationality').innerHTML = `<option value="">${esc(t('pickCountry'))}</option>${countryOptions(locale, '', esc, { emoji })}`;
    $('nationality').addEventListener('change', (e) => {
      const url = emoji ? '' : flagUrl(e.target.value);
      $('nat-flag').hidden = !url;
      $('nat-wrap').classList.toggle('has-flag', !!url);
      if (url) $('nat-flag').src = url;
    });
    $('form').hidden = false;
    addWork();
    useTurnstile = !!cfg.turnstileSiteKey;
    if (useTurnstile) setupTurnstile(cfg.turnstileSiteKey);
  } catch (e) {
    $('intro').innerHTML = `<p class="error-text">${esc(localError(e.message))}</p>`;
  }
}

document.addEventListener('click', (e) => {
  const drop = e.target.closest('.drop');
  if (drop) { openPicker(drop); return; }
  if (e.target.closest('.remove-work')) {
    const b = e.target.closest('.work-block');
    delete uploads[b.dataset.key];
    b.remove();
    renumber();
  }
});
document.addEventListener('keydown', (e) => {
  const drop = e.target.closest && e.target.closest('.drop');
  if (drop && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); openPicker(drop); }
});
document.addEventListener('change', (e) => {
  const k = e.target.dataset && (e.target.dataset.cat || e.target.dataset.sub);
  if (k) syncCategory(k);
});
$('picker').addEventListener('change', (e) => { if (pickTarget && e.target.files[0]) handleFile(pickTarget, e.target.files[0]); });
$('add-work').addEventListener('click', addWork);
$('form').addEventListener('submit', onSubmit);
main();
