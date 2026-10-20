# หอศิลป์ออนไลน์ (ระบบใหม่)

ระบบเดียวสำหรับทุกนิทรรศการ: Cloudflare Pages + Functions + D1 ฐานเดียว แยกนิทรรศการด้วย slug
รูปของแต่ละนิทรรศการเก็บในบัญชี ImageKit ฟรีของนิทรรศการนั้น (1 บัญชีต่อ 1 งาน)

| หน้า | URL |
| --- | --- |
| หอศิลป์กลาง | `/` |
| นิทรรศการ | `/e/<slug>` |
| ผลงาน | `/e/<slug>/work/<id>` |
| ส่งผลงาน | `/e/<slug>/submit` |
| เข้าสู่ระบบผู้จัด | `/login` |
| ผู้ดูแลหอศิลป์ | `/admin` |
| ผู้ดูแลนิทรรศการ | `/manage/<slug>` |
| ผู้ทรงคุณวุฒิ (ลิงก์เฉพาะตัว) | `/review/<token>` |

ขั้นตอนการคัดเลือกมี 2 ระยะ:
1. ภัณฑารักษ์คัดกรองผลงานที่ส่งเข้ามา ผลงานที่ผ่านจะขึ้นแสดงในนิทรรศการทันที
2. ผู้ทรงคุณวุฒิพิจารณาผ่านลิงก์เฉพาะตัว ผลงานที่ได้อนุมัติครบเกณฑ์ (ค่าเริ่มต้น 3 ใน 5) จะได้ badge
   "ผ่านการคัดเลือกจากผู้ทรงคุณวุฒิ" อัตโนมัติ ส่วนผลงานที่ไม่ได้ badge ยังแสดงตามปกติ

## ติดตั้งครั้งแรก (ทำครั้งเดียว)

ต้องใช้บัญชี Cloudflare เดิม (`Surachai.ai.udo@gmail.com's Account`)

1. **สร้างฐานข้อมูล D1**
   ```bash
   npm install
   npx wrangler login
   npx wrangler d1 create art-gallery-platform
   ```
   นำ `database_id` ที่ได้ไปแทน `REPLACE_WITH_D1_DATABASE_ID` ใน `wrangler.toml` แล้วสร้างตาราง:
   ```bash
   npm run db:init:remote
   ```

2. **สร้าง Pages project** ใน Cloudflare Dashboard → Workers & Pages → Create → Pages → Connect to Git
   - Repository: `surachaiaiudo-cpu/pohchang-art-gallery`, branch `main`
   - Root directory: เว้นว่าง (ใช้รากของ repo)
   - Build command: เว้นว่าง, Build output directory: `public`
   - ชื่อโปรเจกต์ เช่น `art-gallery-platform` (URL จะเป็น `https://art-gallery-platform.pages.dev`)
   - D1 binding อ่านจาก `wrangler.toml` อัตโนมัติ (ชื่อ `DB`)

3. **ตั้ง secret** (Settings → Variables and Secrets → ชนิด Secret) หรือใช้คำสั่ง:
   ```bash
   npx wrangler pages secret put APP_ENCRYPTION_KEY --project-name art-gallery-platform
   npx wrangler pages secret put BOOTSTRAP_ADMIN_EMAIL --project-name art-gallery-platform
   npx wrangler pages secret put BOOTSTRAP_ADMIN_PASSWORD --project-name art-gallery-platform
   ```
   - `APP_ENCRYPTION_KEY` ข้อความสุ่มยาวอย่างน้อย 32 ตัวอักษร ใช้เข้ารหัส Private key ของ ImageKit
     **ห้ามเปลี่ยนภายหลัง** ถ้าเปลี่ยน ต้องใส่กุญแจ ImageKit ของทุกนิทรรศการใหม่
   - `BOOTSTRAP_ADMIN_EMAIL` / `BOOTSTRAP_ADMIN_PASSWORD` ใช้สร้างบัญชีผู้ดูแลหอศิลป์คนแรก
     ใช้ได้เฉพาะตอนที่ยังไม่มีผู้ใช้ในระบบเลย และระบบจะบังคับให้เปลี่ยนรหัสผ่านทันที
   - ไม่บังคับ: `TURNSTILE_SECRET_KEY` (secret) และ `TURNSTILE_SITE_KEY` (variable) เพื่อเปิดระบบกันสแปมในฟอร์มส่งผลงาน
   - **ห้ามตั้ง `DEV_FAKE_IMAGEKIT` บนระบบจริง** ค่านี้ใช้ทดสอบในเครื่องเท่านั้น

4. Deploy (push ขึ้น `main` หรือกด Retry deployment) แล้วเข้า `/login` ด้วยอีเมลและรหัสจากข้อ 3

## เปิดนิทรรศการใหม่ (เช่น งานครั้งที่ 20)

1. **admin**: `/admin` → เปิดนิทรรศการใหม่ (ใส่ชื่อ + slug เช่น `poh-chang-20`)
2. **admin**: แท็บผู้ใช้ → เพิ่มผู้ดูแลนิทรรศการ เลือกงานที่ดูแล → ส่งรหัสผ่านชั่วคราวให้ผู้ดูแล
3. **สมัคร ImageKit ฟรี** ด้วยอีเมลของงาน (เช่น `surachai.ai.udo+pohchang20@gmail.com`)
   แล้วเปิดเมนู Developer options คัดลอก URL endpoint, Public key, Private key
4. **ผู้ดูแลนิทรรศการ**: `/manage/<slug>` → ตั้งค่านิทรรศการ
   - ใส่กุญแจ ImageKit (ระบบตรวจกุญแจกับ ImageKit ก่อนบันทึก)
   - กรอกชื่อ บทภัณฑารักษ์ วันเปิด-ปิดรับผลงาน จำนวนผลงานต่อคน
   - เลือกธีม การจัดวาง สีหลัก ภาพปก
   - เปลี่ยนสถานะเป็น "เปิด"
5. แชร์ลิงก์ `/e/<slug>/submit` ให้ศิลปิน
6. ระหว่างรับผลงาน: แท็บ "คัดกรองผลงาน" กด "จัดแสดง" หรือ "ไม่ผ่าน" ทีละชิ้นหรือเลือกหลายชิ้นพร้อมกัน
7. ก่อนวันพิจารณา: แท็บ "ผู้ทรงคุณวุฒิ"
   - ตั้งกติกา (จำนวนผู้ทรงคุณวุฒิ เกณฑ์ผ่าน วันปิด) แล้วติ๊ก "เปิดให้ผู้ทรงคุณวุฒิพิจารณา"
   - เพิ่มผู้ทรงคุณวุฒิทีละท่าน ระบบแสดงลิงก์ **ครั้งเดียว** ให้คัดลอกไปส่งทาง LINE หรืออีเมล
   - ถ้าลิงก์หาย กด "ออกลิงก์ใหม่" ลิงก์เดิมจะใช้ไม่ได้ทันที
8. ดูผลแบบสดที่แท็บ "ผลการพิจารณา" (ดาวน์โหลด CSV ได้) ผลงานที่ระบบระบุว่า
   "ให้ภัณฑารักษ์ตัดสิน" (เช่น งดพิจารณาหลายเสียง) ตัดสินได้ในหน้ารายละเอียดผลงาน

## พัฒนาในเครื่อง

```bash
npm install
cp .dev.vars.example .dev.vars      # มี DEV_FAKE_IMAGEKIT=1 สำหรับอัปโหลดจำลอง
npm run db:init:local
npm run dev                          # http://localhost:8790
npm test                             # ทดสอบการนับเสียง 3 ใน 5
```

## ความปลอดภัยโดยสรุป

- รหัสผ่านเก็บแบบ PBKDF2-SHA256 (100,000 รอบ) ใส่รหัสผิด 5 ครั้งล็อก 15 นาที
- session เป็น cookie HttpOnly, SameSite=Lax และทุกคำขอที่เขียนข้อมูลต้องมาจากหน้าเว็บของระบบเท่านั้น
- ผู้ดูแลนิทรรศการเข้าถึงได้เฉพาะงานที่ได้รับมอบหมาย ทุก query กรองด้วย `exhibition_id`
- ลิงก์ผู้ทรงคุณวุฒิเก็บเป็น hash ปิดหรือออกใหม่ได้ทันที
- Private key ของ ImageKit เข้ารหัส AES-GCM และไม่ถูกส่งกลับไปที่เบราว์เซอร์
- เบราว์เซอร์อัปโหลดรูปตรงไป ImageKit ด้วยลายเซ็นอายุ 30 นาที ที่ออกให้เฉพาะช่วงเปิดรับผลงาน
  และระบบตรวจว่าไฟล์อยู่ในโฟลเดอร์ของนิทรรศการนั้นจริงก่อนบันทึก
- ข้อความทุกช่องแสดงผลแบบ escape และมี Content-Security-Policy ป้องกันสคริปต์แปลกปลอม
- อีเมลและเบอร์โทรของศิลปินไม่แสดงต่อสาธารณะ

## ยังไม่ได้ทำในรอบนี้ (หลัง 9 พ.ย.)

ตัวออกแบบสูจิบัตรและ PDF, ห้องสมุดสูจิบัตร, แกลเลอรีสามมิติ, หน้าภาษาอังกฤษ,
นำเข้าผลงานจาก Excel และย้ายงานสิริกิติ์กับเพาะช่าง 18 เข้าระบบใหม่
