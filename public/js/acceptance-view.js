// "แบบตอบรับ" dialog for the back office (roster page and coordinator page): the artist's reply form,
// what the artist corrected (ศิลปินแก้ข้อมูล) and who filled it in.
import { api, esc } from './core.js';
import { countryName } from './countries.js';

const TITLE = { mr: 'Mr.', miss: 'Miss', mrs: 'Mrs.' };
const TYPE = {
  painting: 'จิตรกรรม (Painting)', sculpture: 'ประติมากรรม (Sculpture)', printmaking: 'ภาพพิมพ์ (Print Making)',
  thai_art: 'ศิลปะไทย (Thai Art)', ceramics: 'เซรามิก (Ceramics)', digital_video: 'ดิจิทัล / วิดีโออาร์ต',
  mixed_other: 'สื่อผสม / อื่นๆ'
};
export const FILLED_BY = { self: 'ศิลปินกรอกเอง', coordinator: 'ผู้ประสานงานกรอกให้', friend: 'ผู้อื่นกรอกให้' };
const FIELD = { name_th: 'ชื่อ (ภาษาของศิลปิน)', name_en: 'ชื่อภาษาอังกฤษ', email: 'อีเมล', phone: 'โทรศัพท์',
  nationality: 'สัญชาติ', affiliation: 'สังกัด / ที่ทำงาน', avatar_url: 'รูปศิลปิน' };
const when = (s) => (s ? new Date(`${s.replace(' ', 'T')}Z`).toLocaleString('th-TH', { dateStyle: 'medium', timeStyle: 'short' }) : '');
const show = (k, v) => (k === 'nationality' ? countryName(v, 'th') || v : v) || '(ว่าง)';

function row(label, value) {
  return value ? `<tr><th scope="row">${esc(label)}</th><td>${value}</td></tr>` : '';
}

function body(a, r) {
  if (!r) return '<p class="muted">ยังไม่ได้ลงนามตอบรับ</p>';
  const d = r.data || {};
  const f = d.food || {};
  const food = [f.vegetarian && 'มังสวิรัติ', f.halal && 'ฮาลาล', f.allergy && `แพ้: ${f.allergy}`, f.other && `อื่นๆ: ${f.other}`].filter(Boolean);
  const exh = (d.exhibitions || []).map((x) => `<li>${esc(x.year)}${x.year && x.detail ? ' — ' : ''}${esc(x.detail)}</li>`).join('');
  const changes = (r.changes || []).map((c) => `<li><b>${esc(FIELD[c.field] || c.field)}</b>: ${esc(show(c.field, c.from))} → <b>${esc(show(c.field, c.to))}</b>
      <span class="small muted">${esc(when(c.at))}</span></li>`).join('');
  return `
    <p class="small">ลงนามโดยพิมพ์ชื่อ <b>“${esc(r.signed_name)}”</b> · ${esc(FILLED_BY[r.filled_by] || r.filled_by)}
      · ครั้งแรก ${esc(when(r.created_at))}${r.times > 1 ? ` · ส่ง ${r.times} ครั้ง ล่าสุด ${esc(when(r.updated_at))}` : ''}</p>
    ${changes ? `<div class="ac-changes"><h3>ศิลปินแก้ข้อมูล</h3><ul>${changes}</ul>
      <p class="hint">ระบบใช้ค่าที่ศิลปินแก้แล้ว (ค่าเดิมที่ทีมงานกรอกเก็บไว้ในรายการนี้)</p></div>` : '<p class="small muted">ศิลปินไม่ได้แก้ข้อมูลที่ทีมงานกรอกไว้</p>'}
    <table class="ac-table"><tbody>
      ${row('คำนำหน้า', esc(TITLE[d.title] || ''))}
      ${row('ชื่อ', `${esc(a.name_en)}${a.name_th && a.name_th !== a.name_en ? ` / ${esc(a.name_th)}` : ''}`)}
      ${row('สัญชาติ', esc(countryName(a.nationality, 'th') || a.nationality))}
      ${row('อายุ', d.age ? esc(String(d.age)) : '')}
      ${row('การศึกษาสูงสุด', [d.edu_institution, d.edu_field, d.edu_degree].filter(Boolean).map(esc).join(' · '))}
      ${row('สังกัด / ที่ทำงาน', esc(a.affiliation))}
      ${row('อีเมล', a.email ? `<a href="mailto:${esc(a.email)}">${esc(a.email)}</a>` : '')}
      ${row('โทรศัพท์', esc(a.phone))}
      ${row('สถานที่ติดต่อ', d.contact_address ? esc(d.contact_address).replace(/\n/g, '<br>') : '')}
      ${row('ผลงานสำหรับสูจิบัตร', d.work ? `${d.work.image_url ? `<a href="${esc(d.work.image_url)}" target="_blank" rel="noopener"><img src="${esc(d.work.image_url)}" alt="" class="ac-photo"></a><br>` : ''}
        <b>${esc(d.work.title)}</b>, ${esc(d.work.year)}<br>${esc(d.work.technique)} · ${esc(d.work.dimensions)}${d.work.width ? ` <span class="small muted">(${Number(d.work.width)}×${Number(d.work.height)} px)</span>` : ''}
        ${d.work.concept ? `<div class="small">${esc(d.work.concept).replace(/\n/g, '<br>')}</div>` : ''}` : '')}
      ${row('นิทรรศการที่สำคัญ', exh ? `<ul>${exh}</ul>` : '')}
      ${row('ประเภทผลงาน', esc((d.types || []).map((x) => TYPE[x] || x).join(', ') + (d.type_other ? ` (${d.type_other})` : '')))}
      ${row('Peer review', d.peer_review === 'yes' ? '<b>YES</b> ต้องการ' : d.peer_review === 'no' ? 'NO ไม่ต้องการ' : '')}
      ${row('อาหาร', esc(food.join(' · ') || 'ไม่มีข้อจำกัด'))}
      ${row('ผู้ติดตาม', d.followers ? `${esc(String(d.followers))} คน (ยินยอมชำระ 15,000 บาท/คน)` : 'ไม่มี')}
      ${row('รูปศิลปิน', a.avatar_url ? `<a href="${esc(a.avatar_url)}" target="_blank" rel="noopener"><img src="${esc(a.avatar_url)}" alt="" class="ac-photo"></a>` : '')}
    </tbody></table>`;
}

let dlg = null;
export async function showReply(slug, id) {
  if (!dlg) {
    dlg = document.createElement('dialog');
    dlg.className = 'ac-dialog';
    dlg.addEventListener('click', (e) => { if (e.target === dlg || e.target.closest('[data-close]')) dlg.close(); });
    document.body.appendChild(dlg);
  }
  dlg.innerHTML = '<p class="muted">กำลังโหลด…</p>';
  dlg.showModal();
  try {
    const { artist: a, reply: r } = await api(`/api/coord/${encodeURIComponent(slug)}/acceptance/${Number(id)}`);
    dlg.innerHTML = `<div class="row" style="justify-content:space-between;align-items:flex-start">
        <h2 style="margin:0">แบบตอบรับ · ${esc(a.name_en || a.name_th)}</h2>
        <button class="btn btn-ghost btn-sm" type="button" data-close>ปิด</button></div>${body(a, r)}`;
  } catch (e) {
    dlg.innerHTML = `<p class="error-text">${esc(e.message)}</p><button class="btn btn-ghost btn-sm" type="button" data-close>ปิด</button>`;
  }
}
