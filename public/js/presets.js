// Mirrors functions/_lib/themes.js. Swatches: background, surface, ink, accent.
export const PRESETS = [
  { key: 'thai-classic', th: 'ไทยประเพณี', sw: ['#f6f0e2', '#c9a75a', '#2b1b12', '#9d2b25'] },
  { key: 'thai-contemporary', th: 'ไทยร่วมสมัย', sw: ['#f2ebe2', '#ddd0c2', '#2a2420', '#a64b25'] },
  { key: 'white-cube', th: 'นานาชาติ / White cube', sw: ['#fafaf8', '#e4e2dc', '#1b1b1a', '#9a3b12'] },
  { key: 'monochrome', th: 'เอกรงค์', sw: ['#ffffff', '#d0d0d0', '#000000', '#000000'] },
  { key: 'pop', th: 'ป๊อปสีสด', sw: ['#fff7e6', '#2649e8', '#1d1035', '#cc1256'] },
  { key: 'craft', th: 'เวิร์กช็อป / งานคราฟต์', sw: ['#efe6d5', '#d6c7ad', '#34291f', '#4f7a58'] },
  { key: 'heritage', th: 'เพาะช่างเฮอริเทจ', sw: ['#14070a', '#8f6d1f', '#f2e6d2', '#d4af37'] }
];
export const presetName = (key) => (PRESETS.find((p) => p.key === key) || { th: key }).th;
