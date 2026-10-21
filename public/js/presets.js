// Mirrors functions/_lib/themes.js. Swatches: background, surface, ink, accent.
export const PRESETS = [
  { key: 'white-cube', th: 'นานาชาติ / White cube', sw: ['#ffffff', '#f4f3f0', '#141414', '#b4321f'] },
  { key: 'thai-classic', th: 'ไทยประเพณี', sw: ['#fbf8f2', '#f0e8d8', '#2b1b12', '#8e2a1e'] },
  { key: 'thai-contemporary', th: 'ไทยร่วมสมัย', sw: ['#ffffff', '#eeeae4', '#1f1b18', '#27406b'] },
  { key: 'monochrome', th: 'เอกรงค์', sw: ['#ffffff', '#f2f2f2', '#000000', '#000000'] },
  { key: 'pop', th: 'ป๊อปสีสด', sw: ['#ffffff', '#fff1d6', '#1d1035', '#d1135a'] },
  { key: 'craft', th: 'เวิร์กช็อป / งานคราฟต์', sw: ['#faf7f1', '#ece4d4', '#34291f', '#3f6e4a'] },
  { key: 'heritage', th: 'เพาะช่างเฮอริเทจ', sw: ['#120a0b', '#22161a', '#f2e6d2', '#d4af37'] }
];
export const presetName = (key) => (PRESETS.find((p) => p.key === key) || { th: key }).th;

// Home page card styles, one per theme (base.css, "Lobby room cards"). '' = follow the theme.
export const CARD_STYLES = [
  { key: 'white-cube', th: 'ผนังแกลเลอรี (White cube)', font: 'Anuphan' },
  { key: 'thai-classic', th: 'กรอบทองลายไทย (ไทยประเพณี)', font: 'Noto Serif Thai' },
  { key: 'thai-contemporary', th: 'โปสเตอร์ผ่าแนวทแยง (ไทยร่วมสมัย)', font: 'Chonburi' },
  { key: 'monochrome', th: 'หน้าแคตตาล็อก (เอกรงค์)', font: 'Taviraj' },
  { key: 'pop', th: 'โปสเตอร์สติกเกอร์ (ป๊อปสีสด)', font: 'Kanit' },
  { key: 'craft', th: 'โต๊ะเวิร์กช็อป (งานคราฟต์)', font: 'Mitr' },
  { key: 'heritage', th: 'หอศิลป์ยามค่ำ (เพาะช่างเฮอริเทจ)', font: 'Noto Serif Thai' }
];
export const cardStyle = (e) => (CARD_STYLES.some((c) => c.key === e.card_style) ? e.card_style
  : CARD_STYLES.some((c) => c.key === e.theme_preset) ? e.theme_preset : 'white-cube');
export const cardOptions = (selected, themeKey) => [
  `<option value=""${selected ? '' : ' selected'}>ตามธีม${themeKey ? ` — ${(CARD_STYLES.find((c) => c.key === themeKey) || { th: '' }).th}` : ''}</option>`,
  ...CARD_STYLES.map((c) => `<option value="${c.key}"${c.key === selected ? ' selected' : ''}>${c.th}</option>`)
].join('');
