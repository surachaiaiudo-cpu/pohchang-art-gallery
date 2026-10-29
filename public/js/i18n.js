// Interface language for the public pages: Thai, English, Simplified Chinese.
// Choice order: ?lang= in the URL, the visitor's saved choice, the browser language, Thai.
// Content fields come in _th (the original/primary text), _en and _zh; pick() falls back
// between them so a missing translation never leaves a blank.

export const LANGS = [
  { code: 'th', label: 'ไทย', html: 'th' },
  { code: 'en', label: 'EN', html: 'en' },
  { code: 'zh', label: '中文', html: 'zh-Hans' }
];
const CODES = LANGS.map((l) => l.code);
const KEY = 'gallery.lang';

function detect() {
  try {
    const q = new URLSearchParams(location.search).get('lang');
    if (CODES.includes(q)) {
      try { localStorage.setItem(KEY, q); } catch { /* storage may be blocked */ }
      return q;
    }
  } catch { /* ignore */ }
  try {
    const saved = localStorage.getItem(KEY);
    if (CODES.includes(saved)) return saved;
  } catch { /* ignore */ }
  for (const l of navigator.languages || [navigator.language || '']) {
    const c = String(l).toLowerCase();
    if (c.startsWith('th')) return 'th';
    if (c.startsWith('zh')) return 'zh';
    if (c.startsWith('en')) return 'en';
  }
  return 'th';
}

export const lang = detect();
export const locale = LANGS.find((l) => l.code === lang).html;

const FALLBACK = { th: ['th', 'en', 'zh'], en: ['en', 'th', 'zh'], zh: ['zh', 'en', 'th'] };

// pick(work, 'title') -> work.title_zh || work.title_en || work.title_th (for zh), and so on.
export function pick(obj, base) {
  if (!obj) return '';
  for (const c of FALLBACK[lang]) {
    const v = obj[`${base}_${c}`];
    if (v) return v;
  }
  return '';
}

// Text in the visitor's language only when it differs from the main one (for a second line).
export function pickOther(obj, base) {
  const main = pick(obj, base);
  const alt = lang === 'th' ? obj[`${base}_en`] : obj[`${base}_th`];
  return alt && alt !== main ? alt : '';
}

const D = {
  th: {
    siteName: 'หอศิลป์ออนไลน์', skip: 'ข้ามไปเนื้อหา', skipWorks: 'ข้ามไปที่ผลงาน', loading: 'กำลังโหลด…', language: 'ภาษา',
    navNow: 'กำลังจัดแสดง', navCall: 'เปิดรับผลงาน', navPast: 'นิทรรศการที่ผ่านมา', navStaff: 'สำหรับผู้จัด', mainMenu: 'เมนูหลัก',
    lobbyHeadline: 'หอศิลป์ที่เปิดทุกนิทรรศการไว้ในที่เดียว',
    lobbyLead: 'เลือกชมนิทรรศการที่กำลังจัดแสดง ส่งผลงานเข้าร่วมงานที่เปิดรับ หรือย้อนดูนิทรรศการที่ผ่านมา',
    nowTitle: 'กำลังจัดแสดงและเปิดรับผลงาน', pastTitle: 'นิทรรศการที่ผ่านมา',
    noNow: 'ยังไม่มีนิทรรศการที่กำลังจัด', noPast: 'ยังไม่มีนิทรรศการในคลัง',
    openCall: 'เปิดรับผลงาน', callEnded: 'ปิดรับผลงานแล้ว', callUpcoming: 'เปิดรับผลงาน {d}', nWorks: '{n} ผลงาน', nArtists: '{n} ศิลปิน', nEndorsed: 'ผ่านผู้ทรงคุณวุฒิ {n}',
    exNav: 'เมนูนิทรรศการ', works: 'ผลงาน', submit: 'ส่งผลงาน', submitCta: 'ส่งผลงานเข้าร่วม', untilDate: 'รับผลงานถึง {d}',
    filters: 'ตัวกรองผลงาน', show: 'แสดงผลงาน', all: 'ทั้งหมด', endorsedFilter: 'ผ่านผู้ทรงคุณวุฒิ',
    category: 'กลุ่มงาน', allCategories: 'ทุกกลุ่มงาน', allTechniques: 'ทุกเทคนิค', allCountries: 'ทุกประเทศ', noCountry: 'ไม่ระบุประเทศ', country: 'ประเทศ', clearFilters: 'ล้างตัวกรอง',
    techniqueDetail: 'รายละเอียดเทคนิค', techniqueDetailPh: 'เช่น บนผ้าใบ, ผสมทองคำเปลว', pickTechnique: '— เลือกเทคนิค —', errTechniquePick: 'กรุณาเลือกเทคนิคของผลงานชิ้นที่ {n}',
     search: 'ค้นหาชื่อผลงานหรือศิลปิน',
    noMatch: 'ไม่พบผลงานตามเงื่อนไข', noWorks: 'ยังไม่มีผลงานจัดแสดง', by: '{title} โดย {artist}',
    notFoundEx: 'ไม่พบนิทรรศการ', backGallery: 'กลับหอศิลป์', backGalleryArrow: '← กลับหอศิลป์',
    notFoundWork: 'ไม่พบผลงาน', backExhibition: 'กลับนิทรรศการ', zoom: 'ภาพขยาย',
    artist: 'ศิลปิน', technique: 'เทคนิค', size: 'ขนาด', year: 'ปีที่สร้าง', affiliation: 'สังกัด', concept: 'แนวคิด',
    watchVideo: 'ชมวิดีโอผลงาน', prev: 'ก่อนหน้า', next: 'ถัดไป', pager: 'ผลงานก่อนหน้าและถัดไป',
    // submit form
    submitTitle: 'ส่งผลงาน: {title}', backTo: '← {title}', maxWorks: 'ส่งได้ไม่เกิน <strong>{n}</strong> ผลงานต่อคน', closesAt: 'ปิดรับ <strong>{d}</strong>',
    categoriesLine: 'กลุ่มงาน: {list}', fileNote: 'ภาพผลงานเป็น JPG, PNG หรือ WebP ไฟล์ที่ใหญ่กว่า 10 MB ระบบจะย่อให้อัตโนมัติโดยคงความละเอียดสำหรับพิมพ์',
    artistInfo: 'ข้อมูลศิลปิน', fullName: 'ชื่อ-นามสกุล', nameEn: 'ชื่อ-นามสกุล (ภาษาอังกฤษ)', nameZh: 'ชื่อ-นามสกุล (ภาษาจีน)',
    academicTitle: 'ตำแหน่งทางวิชาการ / คำนำหน้า', academicPh: 'เช่น ผศ., อาจารย์', affiliationField: 'สังกัด / สถาบัน',
    email: 'อีเมล', emailHint: 'ใช้ติดต่อกลับ ไม่แสดงต่อสาธารณะ', phone: 'โทรศัพท์', notPublic: 'ไม่แสดงต่อสาธารณะ', nationality: 'สัญชาติ', pickCountry: '— เลือกสัญชาติ —', errNationality: 'กรุณาเลือกสัญชาติ',
    bio: 'ประวัติโดยย่อ', bioEn: 'ประวัติโดยย่อ (ภาษาอังกฤษ)', bioZh: 'ประวัติโดยย่อ (ภาษาจีน)',
    translations: 'ภาษาอังกฤษและภาษาจีน (ไม่บังคับ)', avatar: 'รูปศิลปิน (ไม่บังคับ)', tapPhoto: 'แตะเพื่อเลือกรูป',
    workN: 'ผลงานชิ้นที่', image: 'ภาพผลงาน', tapImage: 'แตะเพื่อเลือกไฟล์ภาพ (JPG, PNG หรือ WebP)',
    imageHint: 'ใช้ไฟล์ความละเอียดสูงสำหรับพิมพ์สูจิบัตร ด้านยาวอย่างน้อย 3,000 พิกเซล',
    pickCategory: '— เลือกกลุ่มงาน —', subtype: 'ประเภท', pickSubtype: '— เลือกประเภท —',
    videoUrl: 'ลิงก์วิดีโอ', videoHint: 'ใส่ลิงก์ YouTube, Vimeo หรือ Google Drive ที่เปิดให้ทุกคนดูได้ และอัปโหลดภาพนิ่งจากวิดีโอเป็นภาพผลงาน',
    title: 'ชื่อผลงาน', titleEn: 'ชื่อผลงาน (ภาษาอังกฤษ)', titleZh: 'ชื่อผลงาน (ภาษาจีน)',
    techniqueReq: 'เทคนิค', techniquePh: 'เช่น สีน้ำมันบนผ้าใบ', techniqueEn: 'เทคนิค (ภาษาอังกฤษ)', techniqueZh: 'เทคนิค (ภาษาจีน)',
    sizePh: 'เช่น 80 × 120 ซม.', yearPh: 'เช่น 2569', conceptEn: 'แนวคิด (ภาษาอังกฤษ)', conceptZh: 'แนวคิด (ภาษาจีน)',
    removeWork: 'ลบผลงานชิ้นนี้', addWork: '+ เพิ่มผลงานอีกชิ้น', consent: 'การยินยอม',
    consentText: 'ข้าพเจ้ายืนยันว่าเป็นเจ้าของผลงาน และยินยอมให้ผู้จัดเผยแพร่ภาพและข้อมูลผลงานในนิทรรศการออนไลน์และสูจิบัตร',
    send: 'ส่งผลงาน', sending: 'กำลังส่ง…', doneTitle: 'ส่งผลงานเรียบร้อย', backToEx: 'กลับหน้านิทรรศการ',
    doneText: 'ขอบคุณ {name} ระบบได้รับผลงาน {n} ชิ้นแล้ว ผลงานจะแสดงในนิทรรศการหลังภัณฑารักษ์ตรวจคัดเลือก',
    preparing: 'กำลังเตรียมไฟล์…', uploading: 'กำลังอัปโหลด…', uploadingResized: 'กำลังอัปโหลด (ย่อเป็น {w}×{h} px)…',
    uploaded: 'อัปโหลดแล้ว · แตะเพื่อเปลี่ยนรูป', uploadedResized: 'อัปโหลดแล้ว (ระบบย่อเหลือ {mb} MB) · แตะเพื่อเปลี่ยนรูป',
    uploadFailed: 'อัปโหลดไม่สำเร็จ แตะเพื่อลองใหม่', progress: 'ความคืบหน้า', chosenImage: 'ภาพที่เลือก',
    errHuman: 'กรุณายืนยันว่าไม่ใช่โปรแกรมอัตโนมัติก่อน', errName: 'กรุณากรอกชื่อ-นามสกุล', errEmail: 'กรุณากรอกอีเมลให้ถูกต้อง',
    errBusy: 'ผลงานชิ้นที่ {n} ยังอัปโหลดไม่เสร็จ', errImage: 'กรุณาอัปโหลดภาพผลงานชิ้นที่ {n}',
    errTitle: 'กรุณากรอกชื่อผลงานชิ้นที่ {n}', errTechnique: 'กรุณากรอกเทคนิคของผลงานชิ้นที่ {n}',
    errCategory: 'กรุณาเลือกกลุ่มงานของผลงานชิ้นที่ {n}', errSubtype: 'กรุณาเลือกประเภทของผลงานชิ้นที่ {n}',
    errVideo: 'กรุณาใส่ลิงก์วิดีโอ (https://…) ของผลงานชิ้นที่ {n}', errWait: 'รอให้อัปโหลดรูปเสร็จก่อน', errConsent: 'กรุณายืนยันการยินยอม',
    errFileType: 'รองรับเฉพาะไฟล์ JPG, PNG หรือ WebP', errFileBig: 'ไฟล์ใหญ่เกิน 80 MB กรุณาลดขนาดก่อนส่ง', errNoFile: 'กรุณาเลือกไฟล์รูป',
    closedReason: 'ขณะนี้ไม่เปิดรับผลงาน',
    // review
    reviewTitle: 'พิจารณาผลงาน', reviewer: 'ผู้ทรงคุณวุฒิ: {name}', onlyTodo: 'แสดงเฉพาะที่ยังไม่พิจารณา', allWorks: 'ผลงานทั้งหมด',
    reviewedCount: 'พิจารณาแล้ว {done} จาก {total} ผลงาน', workOf: 'ผลงานที่ {i} / {n}', conceptOfWork: 'แนวคิดของผลงาน',
    decision: 'ผลการพิจารณา', approve: 'อนุมัติ', reject: 'ไม่อนุมัติ', abstain: 'งดพิจารณา',
    abstainHint: '"งดพิจารณา" ใช้เมื่อมีส่วนได้ส่วนเสีย เช่น เป็นผลงานของลูกศิษย์หรือคนในครอบครัว',
    comment: 'ความเห็น (ไม่บังคับ)', saveComment: 'บันทึกความเห็น', commentSaved: 'บันทึกความเห็นแล้ว', pickFirst: 'กรุณาเลือกผลการพิจารณาก่อนบันทึกความเห็น',
    rule: 'ผลงานที่ได้รับอนุมัติ {k} ใน {n} เสียง จะได้ badge "{badge}"', editUntil: 'แก้ไขผลได้จนถึง <strong>{d}</strong>',
    notOpen: 'ขณะนี้ยังไม่เปิดหรือปิดการพิจารณาแล้ว ดูผลงานได้แต่บันทึกผลไม่ได้', noReviewWorks: 'ยังไม่มีผลงานให้พิจารณา',
    linkBroken: 'เปิดลิงก์ไม่ได้', askCurator: 'กรุณาติดต่อภัณฑารักษ์เพื่อขอลิงก์ใหม่',
    navHow: 'วิธีส่งผลงาน',
    howTitle: 'ส่งผลงานได้ใน 3 ขั้นตอน',
    howLead: 'ไม่ต้องสมัครสมาชิก รูปใหญ่ส่งได้เลย ระบบย่อไฟล์ให้อัตโนมัติ',
    step1t: 'เลือกนิทรรศการที่เปิดรับ',
    step1b: 'อ่านรายละเอียด กลุ่มงาน และวันปิดรับ เลือกภาษาที่ถนัดได้ทั้งไทย อังกฤษ และจีน',
    step2t: 'กรอกข้อมูลและอัปโหลดรูป',
    step2b: 'ข้อมูลศิลปิน สัญชาติ และผลงานตามจำนวนที่นิทรรศการกำหนด วิดีโออาร์ตใส่ลิงก์วิดีโอได้',
    step3t: 'คัดกรองและคัดเลือก',
    step3b: 'ภัณฑารักษ์คัดกรองขึ้นจัดแสดง แล้วผู้ทรงคุณวุฒิพิจารณา ผลงานที่ผ่านเกณฑ์ได้รับ badge',
    archiveLead: 'ชมผลงานย้อนหลังได้ตลอด',
    closesOn: 'ปิดรับ {d}',
    maxPer: 'ส่งได้สูงสุด',
    nCats: '{n} กลุ่ม',
    onView: 'กำลังจัดแสดง',
    viewExhibition: 'ดูนิทรรศการ',
    worksLabel: 'ผลงาน',
    sortBy: 'เรียงลำดับ',
    sortOrder: 'ตามลำดับนิทรรศการ',
    sortArtist: 'ชื่อศิลปิน',
    sortTitle: 'ชื่อผลงาน',
    copyright: 'ภาพผลงานสงวนลิขสิทธิ์โดยศิลปิน',
    figHint: 'แตะภาพเพื่อดูขนาดเต็ม · ใช้ปุ่มลูกศรซ้าย/ขวาเพื่อเลื่อนดูผลงาน',
    figHintTouch: 'แตะภาพเพื่อดูขนาดเต็ม · ใช้ปุ่ม ก่อนหน้า / ถัดไป ด้านล่างเพื่อดูผลงานอื่น',
    exhibitionLabel: 'นิทรรศการ',
    submitTo: 'ส่งผลงานเข้าร่วม',
    stepConfirm: 'ยืนยันและส่ง',
    nOfMax: '{n} จาก {max} ชิ้น',
    addWorkLeft: '+ เพิ่มผลงานอีกชิ้น (ส่งได้อีก {n} ชิ้น)',
    acceptingNow: 'กำลังเปิดรับผลงาน',
    closesLabel: 'ปิดรับ',
    atTime: 'เวลา {time} (เวลาประเทศไทย)',
    rulesTitle: 'กติกาโดยย่อ',
    ruleMax: 'ส่งได้ไม่เกิน {n} ผลงานต่อคน',
    ruleScreen: 'ผลงานขึ้นแสดงหลังภัณฑารักษ์คัดกรอง',
    ruleBadge: 'ผ่านผู้ทรงคุณวุฒิ {k} ใน {n} เสียง ได้รับ "{badge}"',
    subtypeOf: 'ประเภทของ {cat}',
    heroCta: 'ชมนิทรรศการ',
    heroPrev: 'ผลงานก่อนหน้า', heroNext: 'ผลงานถัดไป', heroGoto: 'ไปที่ผลงานที่ {n}', heroFrom: 'จากนิทรรศการ {name}',
    heroPos: 'ผลงานที่ {n} จาก {total}', heroSubmit: 'ส่งผลงาน', enterRoom: 'เข้าชมห้องนี้', posterOf: 'โปสเตอร์ {name}', callsTitle: 'เปิดรับผลงาน {n} รายการ',
    callsLead: 'ส่งได้โดยไม่ต้องสมัครสมาชิก ผลงานขึ้นแสดงหลังภัณฑารักษ์คัดกรอง', daysLeft: 'เหลือ {n} วัน', closesToday: 'ปิดรับวันนี้',
    callSubmit: 'ส่งผลงานเข้างานนี้', sentSoFar: 'ส่งแล้ว {n} ผลงาน', wallEmpty: 'ผนังนี้ยังว่าง ผลงานแรกจะขึ้นหลังภัณฑารักษ์คัดกรอง',
    footContact: 'ติดต่อ',
    footFollow: 'ติดตาม',
    footExhibitions: 'นิทรรศการ',
    footWebsite: 'เว็บไซต์หน่วยงาน',
    errGeneric: 'เกิดข้อผิดพลาด'
  },
  en: {
    siteName: 'Online Art Gallery', skip: 'Skip to content', skipWorks: 'Skip to the works', loading: 'Loading…', language: 'Language',
    navNow: 'On view', navCall: 'Open calls', navPast: 'Past exhibitions', navStaff: 'For organisers', mainMenu: 'Main menu',
    lobbyHeadline: 'Every exhibition, one gallery',
    lobbyLead: 'Visit the exhibitions on view, submit work to an open call, or look back at past shows.',
    nowTitle: 'On view and open for submissions', pastTitle: 'Past exhibitions',
    noNow: 'No exhibitions on view yet.', noPast: 'No past exhibitions yet.',
    openCall: 'Open call', callEnded: 'Submissions closed', callUpcoming: 'Open call from {d}', nWorks: '{n} works', nArtists: '{n} artists', nEndorsed: '{n} selected by the panel',
    exNav: 'Exhibition menu', works: 'Works', submit: 'Submit work', submitCta: 'Submit your work', untilDate: 'Submissions until {d}',
    filters: 'Filter works', show: 'Show', all: 'All', endorsedFilter: 'Selected by the panel',
    category: 'Category', allCategories: 'All categories', allTechniques: 'All techniques', allCountries: 'All countries', noCountry: 'Country not given', country: 'Country', clearFilters: 'Clear filters',
    techniqueDetail: 'Technique details', techniqueDetailPh: 'e.g. on canvas, with gold leaf', pickTechnique: '— Choose a technique —', errTechniquePick: 'Please choose the technique of work {n}.',
     search: 'Search titles or artists',
    noMatch: 'No works match your search.', noWorks: 'No works on view yet.', by: '{title} by {artist}',
    notFoundEx: 'Exhibition not found', backGallery: 'Back to the gallery', backGalleryArrow: '← Back to the gallery',
    notFoundWork: 'Work not found', backExhibition: 'Back to the exhibition', zoom: 'Enlarged image',
    artist: 'Artist', technique: 'Technique', size: 'Dimensions', year: 'Year', affiliation: 'Affiliation', concept: 'Concept',
    watchVideo: 'Watch the video', prev: 'Previous', next: 'Next', pager: 'Previous and next works',
    submitTitle: 'Submit work: {title}', backTo: '← {title}', maxWorks: 'Up to <strong>{n}</strong> works per artist', closesAt: 'Closes <strong>{d}</strong>',
    categoriesLine: 'Categories: {list}', fileNote: 'Images in JPG, PNG or WebP. Files over 10 MB are resized automatically while keeping print resolution.',
    artistInfo: 'About the artist', fullName: 'Full name (as it should appear)', nameEn: 'Name in English', nameZh: 'Name in Chinese',
    academicTitle: 'Academic title / prefix', academicPh: 'e.g. Asst. Prof., Dr.', affiliationField: 'Affiliation / institution',
    email: 'Email', emailHint: 'For contacting you only; never shown publicly.', phone: 'Phone', notPublic: 'Never shown publicly.', nationality: 'Nationality', pickCountry: '— Choose a country —', errNationality: 'Please choose your nationality.',
    bio: 'Short biography', bioEn: 'Short biography (English)', bioZh: 'Short biography (Chinese)',
    translations: 'English and Chinese versions (optional)', avatar: 'Artist photo (optional)', tapPhoto: 'Tap to choose a photo',
    workN: 'Work', image: 'Image of the work', tapImage: 'Tap to choose an image (JPG, PNG or WebP)',
    imageHint: 'Use a high-resolution file for the printed catalogue: at least 3,000 px on the long side.',
    pickCategory: '— Choose a category —', subtype: 'Type', pickSubtype: '— Choose a type —',
    videoUrl: 'Video link', videoHint: 'A YouTube, Vimeo or Google Drive link anyone can view. Upload a still from the video as the image of the work.',
    title: 'Title', titleEn: 'Title in English', titleZh: 'Title in Chinese',
    techniqueReq: 'Technique', techniquePh: 'e.g. oil on canvas', techniqueEn: 'Technique in English', techniqueZh: 'Technique in Chinese',
    sizePh: 'e.g. 80 × 120 cm', yearPh: 'e.g. 2026', conceptEn: 'Concept (English)', conceptZh: 'Concept (Chinese)',
    removeWork: 'Remove this work', addWork: '+ Add another work', consent: 'Consent',
    consentText: 'I confirm that I own this work and allow the organisers to publish its images and details in the online exhibition and the catalogue.',
    send: 'Submit', sending: 'Submitting…', doneTitle: 'Submission received', backToEx: 'Back to the exhibition',
    doneText: 'Thank you, {name}. We received {n} work(s). They will appear in the exhibition once the curators have reviewed them.',
    preparing: 'Preparing the file…', uploading: 'Uploading…', uploadingResized: 'Uploading (resized to {w}×{h} px)…',
    uploaded: 'Uploaded · tap to change', uploadedResized: 'Uploaded (resized to {mb} MB) · tap to change',
    uploadFailed: 'Upload failed. Tap to try again.', progress: 'Progress', chosenImage: 'Chosen image',
    errHuman: 'Please complete the verification first.', errName: 'Please enter your full name.', errEmail: 'Please enter a valid email address.',
    errBusy: 'Work {n} is still uploading.', errImage: 'Please upload the image for work {n}.',
    errTitle: 'Please enter the title of work {n}.', errTechnique: 'Please enter the technique of work {n}.',
    errCategory: 'Please choose a category for work {n}.', errSubtype: 'Please choose a type for work {n}.',
    errVideo: 'Please add a video link (https://…) for work {n}.', errWait: 'Please wait for the uploads to finish.', errConsent: 'Please confirm your consent.',
    errFileType: 'Only JPG, PNG or WebP files are accepted.', errFileBig: 'The file is over 80 MB. Please make it smaller first.', errNoFile: 'Please choose an image file.',
    closedReason: 'This exhibition is not accepting submissions right now.',
    reviewTitle: 'Review works', reviewer: 'Reviewer: {name}', onlyTodo: 'Show only works not yet reviewed', allWorks: 'All works',
    reviewedCount: 'Reviewed {done} of {total} works', workOf: 'Work {i} of {n}', conceptOfWork: 'Concept of the work',
    decision: 'Decision', approve: 'Approve', reject: 'Do not approve', abstain: 'Abstain',
    abstainHint: '"Abstain" is for conflicts of interest, e.g. a work by your student or a family member.',
    comment: 'Comment (optional)', saveComment: 'Save comment', commentSaved: 'Comment saved', pickFirst: 'Please choose a decision before saving a comment.',
    rule: 'Works approved by {k} of {n} reviewers receive the badge "{badge}"', editUntil: 'You can change your decisions until <strong>{d}</strong>',
    notOpen: 'Reviewing is not open (or has closed). You can view the works but not record decisions.', noReviewWorks: 'There are no works to review yet.',
    linkBroken: 'This link cannot be opened', askCurator: 'Please ask the curator for a new link.',
    navHow: 'How to submit',
    howTitle: 'Submit in three steps',
    howLead: 'No account needed. Large photos are fine: they are resized automatically.',
    step1t: 'Choose an open call',
    step1b: 'Read the details, categories and deadline, in Thai, English or Chinese.',
    step2t: 'Fill in the form and upload',
    step2b: 'Your details, nationality and works up to the exhibition limit. Video art takes a video link.',
    step3t: 'Screening and selection',
    step3b: 'Curators select works for display, then an expert panel reviews them; selected works receive a badge.',
    archiveLead: 'Browse past exhibitions any time',
    closesOn: 'Closes {d}',
    maxPer: 'Up to',
    nCats: '{n} categories',
    onView: 'On view',
    viewExhibition: 'View the exhibition',
    worksLabel: 'Works',
    sortBy: 'Sort by',
    sortOrder: 'Exhibition order',
    sortArtist: 'Artist name',
    sortTitle: 'Title',
    copyright: 'Images © the artists',
    figHint: 'Tap the image to enlarge · use the arrow keys to move between works',
    figHintTouch: 'Tap the image to enlarge · use Previous / Next below to see other works',
    exhibitionLabel: 'Exhibition',
    submitTo: 'Submit your work to',
    stepConfirm: 'Confirm and submit',
    nOfMax: '{n} of {max}',
    addWorkLeft: '+ Add another work ({n} left)',
    acceptingNow: 'Accepting submissions',
    closesLabel: 'Deadline',
    atTime: 'at {time} (Thailand time)',
    rulesTitle: 'In short',
    ruleMax: 'Up to {n} works per artist',
    ruleScreen: 'Works appear once the curators have screened them',
    ruleBadge: '{k} of {n} panel votes earn "{badge}"',
    subtypeOf: 'Type of {cat}',
    heroCta: 'View the exhibitions',
    heroPrev: 'Previous work', heroNext: 'Next work', heroGoto: 'Go to work {n}', heroFrom: 'From {name}',
    heroPos: 'Work {n} of {total}', heroSubmit: 'Submit work', enterRoom: 'Enter this room', posterOf: 'Poster for {name}', callsTitle: '{n} open calls',
    callsLead: 'No account needed. Works go on view once the curators have screened them.', daysLeft: '{n} days left', closesToday: 'Closes today',
    callSubmit: 'Submit to this call', sentSoFar: '{n} works sent so far', wallEmpty: 'This wall is still empty. The first works go up once the curators have screened them.',
    footContact: 'Contact',
    footFollow: 'Follow',
    footExhibitions: 'Exhibitions',
    footWebsite: 'Website',
    errGeneric: 'Something went wrong'
  },
  zh: {
    siteName: '线上美术馆', skip: '跳到正文', skipWorks: '跳到作品', loading: '加载中…', language: '语言',
    navNow: '正在展出', navCall: '作品征集', navPast: '往期展览', navStaff: '主办方入口', mainMenu: '主菜单',
    lobbyHeadline: '所有展览，汇聚一馆',
    lobbyLead: '浏览正在展出的展览，向征集中的展览投稿，或回顾往期展览。',
    nowTitle: '正在展出与作品征集', pastTitle: '往期展览',
    noNow: '目前暂无展览。', noPast: '暂无往期展览。',
    openCall: '征集中', callEnded: '征集已结束', callUpcoming: '{d} 开始征集', nWorks: '{n} 件作品', nArtists: '{n} 位艺术家', nEndorsed: '{n} 件经专家评审入选',
    exNav: '展览菜单', works: '作品', submit: '投稿', submitCta: '提交参展作品', untilDate: '征集截止 {d}',
    filters: '筛选作品', show: '显示', all: '全部', endorsedFilter: '经专家评审入选',
    category: '作品类别', allCategories: '全部类别', allTechniques: '全部媒材', allCountries: '全部国家/地区', noCountry: '未注明国家/地区', country: '国家/地区', clearFilters: '清除筛选',
    techniqueDetail: '媒材说明', techniqueDetailPh: '例如：布面、贴金箔', pickTechnique: '— 选择媒材 —', errTechniquePick: '请选择第 {n} 件作品的媒材。',
     search: '搜索作品名称或艺术家',
    noMatch: '没有符合条件的作品。', noWorks: '暂无展出作品。', by: '{artist}《{title}》',
    notFoundEx: '未找到该展览', backGallery: '返回美术馆', backGalleryArrow: '← 返回美术馆',
    notFoundWork: '未找到该作品', backExhibition: '返回展览', zoom: '放大图片',
    artist: '艺术家', technique: '媒材', size: '尺寸', year: '创作年份', affiliation: '所属单位', concept: '创作理念',
    watchVideo: '观看作品视频', prev: '上一件', next: '下一件', pager: '上一件与下一件作品',
    submitTitle: '投稿：{title}', backTo: '← {title}', maxWorks: '每位艺术家最多提交 <strong>{n}</strong> 件作品', closesAt: '截止时间 <strong>{d}</strong>',
    categoriesLine: '作品类别：{list}', fileNote: '图片格式为 JPG、PNG 或 WebP。超过 10 MB 的文件会自动缩小，并保留印刷所需的清晰度。',
    artistInfo: '艺术家信息', fullName: '姓名（展出时使用）', nameEn: '英文姓名', nameZh: '中文姓名',
    academicTitle: '职称 / 称谓', academicPh: '例如：副教授、讲师', affiliationField: '所属单位 / 院校',
    email: '电子邮箱', emailHint: '仅用于联系，不会公开。', phone: '电话', notPublic: '不会公开。', nationality: '国籍', pickCountry: '— 请选择国籍 —', errNationality: '请选择国籍。',
    bio: '个人简介', bioEn: '个人简介（英文）', bioZh: '个人简介（中文）',
    translations: '英文与中文版本（选填）', avatar: '艺术家照片（选填）', tapPhoto: '点击选择照片',
    workN: '作品', image: '作品图片', tapImage: '点击选择图片（JPG、PNG 或 WebP）',
    imageHint: '请使用适合画册印刷的高清文件，长边至少 3,000 像素。',
    pickCategory: '— 请选择作品类别 —', subtype: '类型', pickSubtype: '— 请选择类型 —',
    videoUrl: '视频链接', videoHint: '请填写所有人可观看的 YouTube、Vimeo 或 Google Drive 链接，并上传一张视频截图作为作品图片。',
    title: '作品名称', titleEn: '作品名称（英文）', titleZh: '作品名称（中文）',
    techniqueReq: '媒材', techniquePh: '例如：布面油画', techniqueEn: '媒材（英文）', techniqueZh: '媒材（中文）',
    sizePh: '例如：80 × 120 厘米', yearPh: '例如：2026', conceptEn: '创作理念（英文）', conceptZh: '创作理念（中文）',
    removeWork: '删除此作品', addWork: '+ 再添加一件作品', consent: '授权声明',
    consentText: '本人确认为该作品的作者，并同意主办方在线上展览及画册中发布作品图片与信息。',
    send: '提交', sending: '提交中…', doneTitle: '投稿成功', backToEx: '返回展览页面',
    doneText: '感谢 {name}！我们已收到 {n} 件作品，经策展人审核后将在展览中展出。',
    preparing: '正在准备文件…', uploading: '上传中…', uploadingResized: '上传中（已缩小为 {w}×{h} 像素）…',
    uploaded: '已上传 · 点击可更换', uploadedResized: '已上传（已缩小为 {mb} MB）· 点击可更换',
    uploadFailed: '上传失败，点击重试', progress: '进度', chosenImage: '已选图片',
    errHuman: '请先完成人机验证。', errName: '请填写姓名。', errEmail: '请填写有效的电子邮箱。',
    errBusy: '第 {n} 件作品仍在上传中。', errImage: '请上传第 {n} 件作品的图片。',
    errTitle: '请填写第 {n} 件作品的名称。', errTechnique: '请填写第 {n} 件作品的媒材。',
    errCategory: '请为第 {n} 件作品选择类别。', errSubtype: '请为第 {n} 件作品选择类型。',
    errVideo: '请填写第 {n} 件作品的视频链接（https://…）。', errWait: '请等待图片上传完成。', errConsent: '请勾选授权声明。',
    errFileType: '仅支持 JPG、PNG 或 WebP 文件。', errFileBig: '文件超过 80 MB，请先缩小后再上传。', errNoFile: '请选择图片文件。',
    closedReason: '本展览目前不接受投稿。',
    reviewTitle: '作品评审', reviewer: '评审专家：{name}', onlyTodo: '只显示尚未评审的作品', allWorks: '全部作品',
    reviewedCount: '已评审 {done} / {total} 件作品', workOf: '第 {i} / {n} 件', conceptOfWork: '作品创作理念',
    decision: '评审结果', approve: '通过', reject: '不通过', abstain: '回避',
    abstainHint: '"回避"适用于存在利益关系的情况，例如作品作者为您的学生或家人。',
    comment: '评语（选填）', saveComment: '保存评语', commentSaved: '评语已保存', pickFirst: '请先选择评审结果，再保存评语。',
    rule: '获得 {n} 位专家中 {k} 票通过的作品，将获得"{badge}"标识', editUntil: '可修改评审结果至 <strong>{d}</strong>',
    notOpen: '评审尚未开始或已结束，可以浏览作品，但无法记录结果。', noReviewWorks: '暂无需要评审的作品。',
    linkBroken: '无法打开此链接', askCurator: '请联系策展人获取新的链接。',
    navHow: '投稿方式',
    howTitle: '三步完成投稿',
    howLead: '无需注册。大图可直接上传，系统会自动缩小。',
    step1t: '选择征集中的展览',
    step1b: '阅读展览介绍、作品类别与截止日期，可选择泰文、英文或中文。',
    step2t: '填写信息并上传图片',
    step2b: '填写艺术家信息、国籍及作品（不超过展览规定数量），录像艺术可附视频链接。',
    step3t: '筛选与评审',
    step3b: '策展人筛选展出作品，再由专家评审，入选作品获得标识。',
    archiveLead: '随时回顾往期展览',
    closesOn: '截止 {d}',
    maxPer: '每人最多',
    nCats: '{n} 类',
    onView: '正在展出',
    viewExhibition: '参观展览',
    worksLabel: '作品',
    sortBy: '排序',
    sortOrder: '展览顺序',
    sortArtist: '艺术家姓名',
    sortTitle: '作品名称',
    copyright: '作品图片版权归艺术家所有',
    figHint: '点击图片放大 · 使用左右方向键切换作品',
    figHintTouch: '点击图片放大 · 使用下方的“上一件 / 下一件”查看其他作品',
    exhibitionLabel: '展览',
    submitTo: '投稿参展',
    stepConfirm: '确认并提交',
    nOfMax: '第 {n} / {max} 件',
    addWorkLeft: '+ 再添加一件作品（还可提交 {n} 件）',
    acceptingNow: '正在征集作品',
    closesLabel: '截止日期',
    atTime: '{time}（泰国时间）',
    rulesTitle: '投稿须知',
    ruleMax: '每位艺术家最多 {n} 件作品',
    ruleScreen: '作品经策展人筛选后展出',
    ruleBadge: '获得 {n} 位专家中 {k} 票通过，将获"{badge}"标识',
    subtypeOf: '{cat}的类型',
    heroCta: '参观展览',
    heroPrev: '上一件作品', heroNext: '下一件作品', heroGoto: '查看第 {n} 件作品', heroFrom: '来自展览：{name}',
    heroPos: '第 {n} 件，共 {total} 件', heroSubmit: '投稿', enterRoom: '进入展厅', posterOf: '{name} 海报', callsTitle: '{n} 项作品征集',
    callsLead: '无需注册即可投稿，作品经策展人审核后展出。', daysLeft: '还剩 {n} 天', closesToday: '今天截止',
    callSubmit: '向此征集投稿', sentSoFar: '已收到 {n} 件作品', wallEmpty: '这面墙还空着，作品经策展人审核后即会展出。',
    footContact: '联系我们',
    footFollow: '关注我们',
    footExhibitions: '展览',
    footWebsite: '官方网站',
    errGeneric: '出现错误'
  }
};

export function t(key, vars = {}) {
  const s = D[lang][key] ?? D.th[key] ?? key;
  return s.replace(/\{(\w+)\}/g, (_, k) => (vars[k] ?? ''));
}

// Server messages are written in Thai; in another language show a short local lead-in with them.
export function localError(message) {
  if (lang === 'th' || !/[฀-๿]/.test(message || '')) return message;
  return `${t('errGeneric')}: ${message}`;
}

const MONTHS = {
  th: ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'],
  en: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
};

// Clock time in Bangkok: "09:03 น." / "09:03".
export function fmtTime(value) {
  const d = new Date(value || '');
  if (Number.isNaN(d.getTime())) return '';
  const b = new Date(d.getTime() + 7 * 3600000);
  const hm = `${String(b.getUTCHours()).padStart(2, '0')}:${String(b.getUTCMinutes()).padStart(2, '0')}`;
  return lang === 'th' ? `${hm} น.` : hm;
}

// Date in Bangkok time: "9 พ.ย. 2569", "9 Nov 2026", "2026年11月9日".
export function fmtDate(value, withTime = false) {
  if (!value) return '';
  const d = new Date(value.length === 10 ? `${value}T00:00:00+07:00` : value);
  if (Number.isNaN(d.getTime())) return '';
  const b = new Date(d.getTime() + 7 * 3600000);
  const day = b.getUTCDate(), m = b.getUTCMonth(), y = b.getUTCFullYear();
  const hm = `${String(b.getUTCHours()).padStart(2, '0')}:${String(b.getUTCMinutes()).padStart(2, '0')}`;
  if (lang === 'zh') return `${y}年${m + 1}月${day}日${withTime ? ` ${hm}` : ''}`;
  if (lang === 'en') return `${day} ${MONTHS.en[m]} ${y}${withTime ? `, ${hm}` : ''}`;
  return `${day} ${MONTHS.th[m]} ${y + 543}${withTime ? ` ${hm} น.` : ''}`;
}

// Category labels: works store the first (Thai) label; show the visitor's language when given.
export function catName(cats, name) {
  const c = (cats || []).find((x) => x.name === name);
  if (!c || lang === 'th') return name;
  return c[lang] || c.en || name;
}
export function subName(cats, name, sub) {
  const c = (cats || []).find((x) => x.name === name);
  const l = c && c.subLabels ? c.subLabels[sub] : null;
  if (!l || lang === 'th') return sub;
  return l[lang] || l.en || sub;
}
// Technique groups: same idea, one level.
export function techName(list, name) {
  const x = (list || []).find((y) => y.name === name);
  if (!x || lang === 'th') return name;
  return x[lang] || x.en || name;
}
// "Technique : " came with the old system's data; it is hidden, not removed.
export const cleanTechnique = (s) => String(s || '').replace(/^\s*technique\s*:\s*/i, '').trim();
// What a visitor reads for the technique: the group, plus the artist's own wording when it adds
// something ("สีอะคริลิก · บนผ้าใบ"); old text that already names the group is shown on its own.
// A visitor reading in English or Chinese gets the translated group rather than Thai-only detail.
export function techniqueLabel(list, w) {
  if (!w.technique_group) return cleanTechnique(pick(w, 'technique'));
  const label = techName(list, w.technique_group);
  const own = lang === 'th' ? w.technique_th : (w[`technique_${lang}`] || (lang === 'zh' ? w.technique_en : ''));
  const detail = cleanTechnique(own);
  if (!detail) return label;
  const item = (list || []).find((y) => y.name === w.technique_group) || {};
  const words = [label, w.technique_group, item.en || '', item.zh || ''].flatMap((x) => x.split(/[/()]/)).map((x) => x.trim().toLowerCase()).filter((x) => x.length > 1);
  return words.some((x) => detail.toLowerCase().includes(x)) ? detail : `${label} · ${detail}`;
}
export function catLabel(cats, w) {
  return [w.category ? catName(cats, w.category) : '', w.subcategory ? subName(cats, w.category, w.subcategory) : '']
    .filter(Boolean).join(' · ');
}

// Applies data-i18n (text), data-i18n-html, data-i18n-ph (placeholder) and data-i18n-aria to static markup.
export function applyStatic(root = document) {
  document.documentElement.lang = LANGS.find((l) => l.code === lang).html;
  root.querySelectorAll('[data-i18n]').forEach((el) => { el.textContent = t(el.dataset.i18n); });
  root.querySelectorAll('[data-i18n-ph]').forEach((el) => { el.placeholder = t(el.dataset.i18nPh); });
  root.querySelectorAll('[data-i18n-aria]').forEach((el) => { el.setAttribute('aria-label', t(el.dataset.i18nAria)); });
}

// Language switcher; switching reloads the page with ?lang= so links stay shareable.
export function mountSwitcher(container) {
  if (!container) return;
  const wrap = document.createElement('div');
  wrap.className = 'lang-switch';
  wrap.setAttribute('role', 'group');
  wrap.setAttribute('aria-label', t('language'));
  wrap.innerHTML = LANGS.map((l) => `<a href="?lang=${l.code}" hreflang="${l.html}" lang="${l.html}" data-lang="${l.code}"
    ${l.code === lang ? 'aria-current="true"' : ''}>${l.label}</a>`).join('');
  wrap.addEventListener('click', (e) => {
    const a = e.target.closest('[data-lang]');
    if (!a) return;
    e.preventDefault();
    try { localStorage.setItem(KEY, a.dataset.lang); } catch { /* ignore */ }
    const u = new URL(location.href);
    u.searchParams.set('lang', a.dataset.lang);
    location.href = u.toString();
  });
  container.appendChild(wrap);
}
