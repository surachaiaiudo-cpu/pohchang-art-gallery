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
