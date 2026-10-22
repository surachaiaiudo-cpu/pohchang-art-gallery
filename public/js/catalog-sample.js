// Made-up exhibition and works used to preview catalogue templates when no real exhibition is chosen.
// Images are drawn here as SVG (data: URLs are allowed by the site's image policy).
const svg = (body, w, h) => `data:image/svg+xml;charset=utf-8,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}">${body}</svg>`)}`;

const landscape = svg(`<defs><linearGradient id="s" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f3b46b"/><stop offset="1" stop-color="#c8553d"/></linearGradient></defs>
<rect width="1600" height="1100" fill="url(#s)"/><circle cx="1120" cy="420" r="120" fill="#fbe3a8"/>
<path d="M0 760 Q400 640 800 720 T1600 700 V1100 H0z" fill="#5a7d4f"/><path d="M0 860 Q500 780 900 850 T1600 830 V1100 H0z" fill="#3e5c3a"/>
<path d="M0 960 Q600 900 1000 960 T1600 950 V1100 H0z" fill="#2b4230"/>`, 1600, 1100);

const portrait = svg(`<rect width="1000" height="1400" fill="#1f3a4d"/><rect x="120" y="140" width="760" height="1120" fill="#e9dcc3"/>
<circle cx="500" cy="560" r="210" fill="#b4321f"/><rect x="300" y="860" width="400" height="260" fill="#1f3a4d"/>`, 1000, 1400);

const face = svg(`<rect width="400" height="400" fill="#d9d4c9"/><circle cx="200" cy="160" r="80" fill="#8c7b6b"/><path d="M60 400 Q200 230 340 400z" fill="#8c7b6b"/>`, 400, 400);

export const SAMPLE_EXHIBITION = {
  slug: 'example', title_th: 'นิทรรศการศิลปกรรมตัวอย่าง ครั้งที่ 1', title_en: 'Sample Art Exhibition No. 1', title_zh: '示例艺术展 第一届',
  subtitle_th: 'ผลงานศิลปินไทยและนานาชาติ', subtitle_en: 'Works by Thai and international artists', subtitle_zh: '泰国及国际艺术家作品',
  statement_th: 'นิทรรศการนี้รวบรวมผลงานที่ผ่านการคัดเลือกจากศิลปินหลายประเทศ\n\nข้อความนี้เป็นตัวอย่างสำหรับดูหน้าตาเทมเพลตเท่านั้น',
  statement_en: 'This exhibition brings together selected works by artists from many countries.\n\nThis text is only a sample for previewing the template.',
  statement_zh: '', venue: 'หอศิลป์ตัวอย่าง กรุงเทพฯ', starts_on: '2026-11-09', ends_on: '2026-11-30', hero_url: '',
  badge_label_th: 'ผ่านการคัดเลือกจากผู้ทรงคุณวุฒิ', badge_label_en: 'Selected by the Expert Panel', badge_label_zh: '经专家评审入选',
  categories: [{ name: 'จิตรกรรม', en: 'Painting', zh: '绘画', subs: [], subLabels: {} }],
  techniques: [{ name: 'สีอะคริลิก', en: 'Acrylic', zh: '丙烯' }, { name: 'สีน้ำมัน', en: 'Oil', zh: '油画' }]
};

const base = {
  category: 'จิตรกรรม', subcategory: '', display_order: 0, endorsed: 1, price: '45,000 บาท', zone: '', video_url: '',
  academic_title_th: '', academic_title_en: '', affiliation: 'มหาวิทยาลัยเทคโนโลยีราชมงคลรัตนโกสินทร์'
};
export const SAMPLE_WORKS = [
  { ...base, id: 1, artist_id: 1, title_th: 'ทุ่งนายามเย็น', title_en: 'Rice Field at Dusk', title_zh: '黄昏稻田',
    technique_group: 'สีอะคริลิก', technique_th: 'สีอะคริลิกบนผ้าใบ', technique_en: 'Acrylic on canvas', technique_zh: '布面丙烯',
    dimensions: '120 x 90 cm', year_created: '2026', image_url: landscape, image_width: 1600, image_height: 1100,
    artist_name_th: 'สมชาย ใจดี', artist_name_en: 'Somchai Jaidee', artist_name_zh: '', nationality: 'TH', avatar_url: face,
    concept_th: 'แสงสุดท้ายของวันบนผืนนาบ้านเกิด ความทรงจำที่เปลี่ยนไปตามฤดูกาล', concept_en: 'The last light of the day over the rice fields of home: memories that change with the seasons.', concept_zh: '',
    bio_th: 'ศิลปินจิตรกรรมภูมิทัศน์ จัดแสดงงานในประเทศและต่างประเทศ', bio_en: 'Landscape painter who has exhibited in Thailand and abroad.', bio_zh: '' },
  { ...base, id: 2, artist_id: 2, endorsed: 0, title_th: 'ดวงอาทิตย์สีแดง', title_en: 'Red Sun', title_zh: '红日',
    technique_group: 'สีน้ำมัน', technique_th: '', technique_en: 'Oil on canvas', technique_zh: '',
    dimensions: '100 x 140 cm', year_created: '2025', image_url: portrait, image_width: 1000, image_height: 1400,
    artist_name_th: 'หลี่ เหม่ย', artist_name_en: 'Li Mei', artist_name_zh: '李梅', nationality: 'CN', avatar_url: face,
    concept_th: '', concept_en: 'A study of colour and silence.', concept_zh: '色彩与寂静的研究。', bio_th: '', bio_en: '', bio_zh: '', price: '' }
];

export const SAMPLE_REVIEWERS = [
  { name: 'ศาสตราจารย์ ตัวอย่าง หนึ่ง', title: 'ศิลปินแห่งชาติ' },
  { name: 'รองศาสตราจารย์ ตัวอย่าง สอง', title: 'ผู้ทรงคุณวุฒิด้านจิตรกรรม' }
];
