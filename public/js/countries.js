// Nationality is stored as an ISO 3166-1 alpha-2 code (TH, CN, ...), never as free text, so
// "ไทย", "Thai" and "thailand" cannot end up as three different answers. Names are shown in
// the page language by the browser (Intl.DisplayNames). Shared by the pages and the server.
export const COUNTRY_CODES = `
AD AE AF AG AI AL AM AO AR AS AT AU AW AX AZ BA BB BD BE BF BG BH BI BJ BL BM BN BO BQ BR BS BT BW BY BZ
CA CC CD CF CG CH CI CK CL CM CN CO CR CU CV CW CX CY CZ DE DJ DK DM DO DZ EC EE EG EH ER ES ET
FI FJ FK FM FO FR GA GB GD GE GF GG GH GI GL GM GN GP GQ GR GT GU GW GY HK HN HR HT HU
ID IE IL IM IN IQ IR IS IT JE JM JO JP KE KG KH KI KM KN KP KR KW KY KZ LA LB LC LI LK LR LS LT LU LV LY
MA MC MD ME MF MG MH MK ML MM MN MO MP MQ MR MS MT MU MV MW MX MY MZ NA NC NE NF NG NI NL NO NP NR NU NZ
OM PA PE PF PG PH PK PL PM PN PR PS PT PW PY QA RE RO RS RU RW SA SB SC SD SE SG SH SI SJ SK SL SM SN SO SR SS ST SV SX SY SZ
TC TD TG TH TJ TK TL TM TN TO TR TT TV TW TZ UA UG US UY UZ VA VC VE VG VI VN VU WF WS YE YT ZA ZM ZW
`.trim().split(/\s+/);

// Shown first in the list.
export const PINNED = ['TH', 'CN'];

const valid = new Set(COUNTRY_CODES);
export const isCountryCode = (v) => typeof v === 'string' && valid.has(v);

const cache = {};
// Country name in the given language ('th' | 'en' | 'zh-Hans' ...). Old free-text values pass through.
export function countryName(code, locale = 'th') {
  if (!isCountryCode(code)) return code || '';
  try {
    cache[locale] = cache[locale] || new Intl.DisplayNames([locale], { type: 'region' });
    return cache[locale].of(code) || code;
  } catch {
    return code;
  }
}

// <option> list: pinned countries, then everything else sorted by name in that language.
export function countryOptions(locale, selected = '', escape = (s) => s, { emoji = false } = {}) {
  const name = (c) => countryName(c, locale);
  const rest = COUNTRY_CODES.filter((c) => !PINNED.includes(c)).sort((a, b) => name(a).localeCompare(name(b), locale));
  const opt = (c) => `<option value="${c}"${c === selected ? ' selected' : ''}>${emoji ? `${flagEmoji(c)} ` : ''}${escape(name(c))}</option>`;
  return `${PINNED.map(opt).join('')}<option disabled>──────────</option>${rest.map(opt).join('')}`;
}

// Free text typed before the list existed -> code (used once by the database upgrade).
export const COUNTRY_ALIASES = {
  TH: ['thailand', 'thai', 'ไทย', 'ประเทศไทย', 'สัญชาติไทย', 'th', 'tha', '泰国'],
  CN: ['china', 'chinese', 'จีน', 'ประเทศจีน', 'สัญชาติจีน', 'cn', 'chn', 'prc', "people's republic of china", '中国', '中國'],
  JP: ['japan', 'japanese', 'ญี่ปุ่น', 'jp', '日本'],
  KR: ['korea', 'south korea', 'korean', 'เกาหลี', 'เกาหลีใต้', 'kr', '韩国'],
  TW: ['taiwan', 'taiwanese', 'ไต้หวัน', 'tw', '台湾', '台灣'],
  LA: ['laos', 'lao', 'ลาว', 'สปป.ลาว', 'la'],
  KH: ['cambodia', 'cambodian', 'กัมพูชา', 'เขมร', 'kh'],
  MM: ['myanmar', 'burma', 'burmese', 'เมียนมา', 'พม่า', 'mm'],
  VN: ['vietnam', 'viet nam', 'vietnamese', 'เวียดนาม', 'vn'],
  MY: ['malaysia', 'malaysian', 'มาเลเซีย', 'my'],
  SG: ['singapore', 'singaporean', 'สิงคโปร์', 'sg'],
  ID: ['indonesia', 'indonesian', 'อินโดนีเซีย', 'id'],
  PH: ['philippines', 'filipino', 'ฟิลิปปินส์', 'ph'],
  IN: ['india', 'indian', 'อินเดีย', 'in'],
  US: ['usa', 'united states', 'american', 'อเมริกา', 'สหรัฐอเมริกา', 'us'],
  GB: ['uk', 'united kingdom', 'england', 'british', 'อังกฤษ', 'สหราชอาณาจักร', 'gb']
};

// Flag images: public/flags/<code>.svg (from the MIT-licensed flag-icons project, 4:3).
export const flagUrl = (code) => (isCountryCode(code) ? `/flags/${code.toLowerCase()}.svg` : '');

// <img> of the flag; alt carries the country name when the flag is shown without it.
export function flagImg(code, { alt = '', cls = 'flag' } = {}, escape = (s) => s) {
  const url = flagUrl(code);
  return url ? `<img class="${cls}" src="${url}" alt="${escape(alt)}" width="20" height="15" loading="lazy" decoding="async">` : '';
}

// Flag emoji (🇹🇭) for places that only take text, like <option>. Windows shows letters
// instead of flags, so it is only used where the system can draw them.
export const flagEmoji = (code) => (isCountryCode(code)
  ? String.fromCodePoint(...[...code].map((ch) => 0x1F1E6 + ch.charCodeAt(0) - 65)) : '');

let emojiOk;
export function canShowFlagEmoji() {
  if (emojiOk !== undefined) return emojiOk;
  emojiOk = false;
  try {
    const c = document.createElement('canvas');
    c.width = c.height = 20;
    const ctx = c.getContext('2d', { willReadFrequently: true });
    ctx.font = '16px sans-serif';
    ctx.textBaseline = 'top';
    ctx.fillText(flagEmoji('TH'), 0, 0);
    const d = ctx.getImageData(0, 0, 20, 20).data;
    // A real flag has colour; the letter fallback is grey/black.
    for (let i = 0; i < d.length; i += 4) {
      if (d[i + 3] > 0 && (Math.abs(d[i] - d[i + 1]) > 40 || Math.abs(d[i + 1] - d[i + 2]) > 40)) { emojiOk = true; break; }
    }
  } catch { /* no canvas */ }
  return emojiOk;
}
