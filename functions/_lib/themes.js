// Theme presets (the look is in public/css/themes.css under [data-theme="<key>"]).
export const PRESETS = {
  'thai-classic':      { th: 'ไทยประเพณี',        en: 'Thai Classic' },
  'thai-contemporary': { th: 'ไทยร่วมสมัย',        en: 'Thai Contemporary' },
  'white-cube':        { th: 'นานาชาติ / White cube', en: 'White Cube' },
  'monochrome':        { th: 'เอกรงค์',            en: 'Monochrome' },
  'pop':               { th: 'ป๊อปสีสด',           en: 'Pop' },
  'craft':             { th: 'เวิร์กช็อป / งานคราฟต์', en: 'Workshop Craft' },
  'heritage':          { th: 'เพาะช่างเฮอริเทจ',    en: 'Poh-Chang Heritage' }
};

export const HEADING_FONTS = ['', 'Noto Serif Thai', 'Chonburi', 'Taviraj', 'Kanit', 'Mitr', 'Charm', 'Srisakdi', 'IBM Plex Sans Thai'];
export const ORNAMENTS = ['none', 'light', 'full'];
// Home page card style: '' = the same as the theme, else one of the preset keys.
export const CARD_STYLES = ['', ...Object.keys(PRESETS)];
