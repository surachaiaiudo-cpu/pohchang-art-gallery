import * as v from './validate.js';
import { ROSTER_KEYS } from '../../public/js/roster-logic.js';

// Artist fields an admin / exhibition manager may type for an artist added by hand (channels 1 and 3).
export const ROSTER_ARTIST_TEXT = {
  name_th: { field: 'ชื่อศิลปิน', max: 200, required: true },
  name_en: { field: 'ชื่อศิลปินภาษาอังกฤษ', max: 200 },
  name_zh: { field: 'ชื่อศิลปินภาษาจีน', max: 200 },
  academic_title_th: { field: 'ตำแหน่งทางวิชาการ', max: 200 },
  phone: { field: 'โทรศัพท์', max: 40 },
  affiliation: { field: 'สังกัด', max: 300 }
};

export const channelOf = (x) => v.int(x, { field: 'ช่องทาง', min: 0, max: 4 });
export const rosterOf = (x) => v.oneOf(x, ROSTER_KEYS, { field: 'สถานะการคัดเลือก' });
