# Agent handoff — Poh-Chang online art gallery (new system)

Last updated: 2026-10-21 (Asia/Bangkok). Read this whole file before changing anything.
Owner-facing setup steps are in `README.md` (Thai); this file is for AI agents and developers.

## 1. What this is

One online art gallery ("หอศิลป์กลาง") that hosts many exhibitions ("นิทรรศการย่อย"), each at
`/e/<slug>` with its own look (theme), its own submission form, curator screening, expert-panel
review and badge. It replaces an older system of one Cloudflare project per event (section 11).

| | |
|---|---|
| Live site | https://pohchang-art-gallery.pages.dev |
| Repo | https://github.com/surachaiaiudo-cpu/pohchang-art-gallery (branch `main`, push = deploy) |
| Cloudflare | account "Surachai.ai.udo@gmail.com's Account" (id `1267c7588440871af7ee472d7bac2be5`), Pages project `pohchang-art-gallery`, D1 `art-gallery-platform` (id `c2c07697-40c2-4140-8a56-c3c8792059be`) |
| Images | Cloudinary cloud `uukpgvmz`, unsigned upload preset `20workshop` |
| Owner | Thai-speaking; organiser of the Poh-Chang art workshops |

## 2. Rules for working with the owner (important)

1. **Always ask before deciding anything yourself** ("ให้ถามข้อสงสัยก่อนจัดการเองเสมอ ห้ามตัดสินใจเอง").
   Present options with a recommendation and wait. This includes data changes on the live site,
   changing an exhibition's status, editing the old system, and design choices.
2. Reply to the owner in **Thai**.
3. Never type, request in chat, or commit secrets (passwords, API secrets, `APP_ENCRYPTION_KEY`).
   The owner enters them in the Cloudflare dashboard or the app's settings screens.
4. Never set `DEV_FAKE_STORAGE` or `DEV_ALLOW_HTTP_IMPORT` in production.
5. Do not change the old system (section 11) unless the owner asks for that specific change.
6. The owner also pushes to this repo (sometimes with another AI). Always `git pull` first.
7. A logged-in browser session may be the owner's admin session: read-only checks are fine,
   anything that writes needs the owner's go-ahead.

## 3. Current state (2026-10-20)

- Exhibition `pohchang-art-workshop` — "20th pohchang international art workshop": status open,
  accepting submissions, max 5 works per artist, closes **10 Nov 2026 09:03 (+07:00)**, 0 works so far.
  The owner was told this deadline is after the expert review start (9 Nov); not changed.
- Exhibition `queen-sirikit-art-exhibition`: imported from the old site (100 works, images still on the
  old Cloudinary account). Status is **open with no submission dates, so it accepts new submissions** —
  owner was asked whether to close it or archive it; no answer yet.
- Old event "18 Poh Chang art workshop" (152 works) is **not imported yet**; preview showed one row with
  shifted columns (artist name "Thailand", email in the nationality field) and "Kurdistan" ×2.
- Open questions to the owner (do not decide them yourself):
  1. Keep the dark `heritage` theme dark, or make it light? (they picked "colour + heading font", not "dark allowed")
  2. ~~Technique prefix~~ decided 2026-10-21: "Technique :" is hidden on display only (data kept). "size" prefix: not asked yet.
  3. What to do with the Sirikit exhibition's open submissions?
  4. Who runs the 18 Poh Chang import, with which slug/titles (proposed `poh-chang-18`)?
- Design canvas (Claude Design artifact, private to the owner): https://claude.ai/artifact/7VQCsWFiH7Rf4HKfjkchJw
  — home, exhibition, work, submission pages and the 7 themes. The live site implements it.

## 4. Architecture

Cloudflare Pages (static `public/`) + Pages Functions (`functions/`) + one D1 database + Cloudinary.
No build step, no framework: plain ES modules in the browser, plain JS in Functions. Free plans only.

```
functions/
  _middleware.js        same-origin check on /api writes, runs DB upgrades, security headers + CSP
  _lib/
    migrate.js          schema upgrades applied automatically on the first /api request per isolate
    auth.js             users, PBKDF2 passwords, session cookie `gsid`, bootstrap admin
    exhibitions.js      lookup by slug (+ slug redirects), requireManager, submissionWindow, publicExhibition
    storage.js          Cloudinary: signed or unsigned upload auth, upload verification, delete, usage
    review.js           tally() for the expert panel + recompute()
    categories.js       per-exhibition category lists ("ไทย | English | 中文" labels, sub-types)
    techniques.js       per-exhibition technique groups, default 15, guessTechnique() for old free text
    import-old.js       reading the old event sites and mapping their rows
    country-names.js    generated en/th/zh country name -> ISO code table (for the importer)
    validate.js http.js crypto.js ratelimit.js ticket.js reviewer.js public.js themes.js
  api/                  file-based routes (see section 7)
public/
  index.html exhibition.html work.html submit.html review.html   public pages (3 languages)
  login.html admin.html manage.html                              back office (Thai only)
  css/themes.css   7 theme presets as CSS variables      css/base.css  public layout
  css/app.css      back office + reviewer page
  js/i18n.js       th/en/zh dictionary, language choice, pick() fallbacks, dates
  js/countries.js  ISO country list, names via Intl.DisplayNames, flags   (also imported by Functions)
  js/core.js       api(), esc(), Cloudinary img()/srcset, theme + font loading
  flags/*.svg      242 flag images (flag-icons, MIT, licence included)
  _redirects       /e/:slug, /e/:slug/work/:id, /e/:slug/submit, /manage/:slug, /review/:token rewrites
  _headers         CSS/JS revalidate every load; flags cached 7 days
schema/0001..0007  SQL history (0001 creates everything; later files are also applied by migrate.js; 0006 lives only in migrate.js)
tests/*.test.js    node:test unit tests (`npm test`)
```

## 5. Data model (D1)

- `users` (role `admin` | `staff`), `sessions`, `rate_limits`, `audit_log`
- `exhibitions`: slug, titles/subtitles/statements in `_th` `_en` `_zh`, status `draft|open|closed|archived` (= ร่าง / เปิด / ซ่อน / ปิด, see 6.3),
  submission dates, `max_works_per_artist`, `theme_preset`, `layout` (grid|masonry|salon),
  `theme_overrides` (JSON: accent, headingFont, ornament), hero image, Cloudinary settings
  (`cloudinary_cloud_name`, `cloudinary_upload_preset`, `cloudinary_api_key`, `cloudinary_api_secret_enc`),
  review settings (`review_open`, `review_deadline`, `review_threshold` default 3, `review_panel_size` default 5,
  `review_blind`), badge labels `_th` `_en` `_zh`, `categories` (text, see 6.5), `techniques` (text, see 6.5b)
- `slug_redirects` (old slug -> exhibition), `exhibition_members` (staff <-> exhibition)
- `artists` (per exhibition; `_th` is the primary/original name, `_en` `_zh` optional; `email`, `phone`
  private; `nationality` = ISO code)
- `works`: titles/technique/concept in `_th` `_en` `_zh` (technique text = free detail), `category`, `subcategory`,
  `technique_group` (chosen group, Thai label; '' = not confirmed), `video_url`, image fields,
  `status` `submitted|shown|rejected`, `review_result`, `badge_override`, `endorsed`, `display_order`, soft delete
- `reviewers` (token stored as SHA-256 hash), `votes` (approve|reject|abstain + comment)

Schema changes: add `schema/000N_*.sql` **and** a step in `functions/_lib/migrate.js` (with a cheap `needed()`
check). Production upgrades itself on deploy; nobody runs SQL by hand.

## 6. How the main features work

### 6.1 Submission (public, no account)
`/e/<slug>/submit` → on first upload or send the page asks `POST /api/x/:slug/ticket` (HMAC ticket, 2 h, bound
to IP + slug; Turnstile when configured) → `POST /api/x/:slug/upload-auth` → browser resizes to ≤10 MB / 25 MP
(`public/js/upload.js`) and uploads straight to Cloudinary → `POST /api/x/:slug/submit` with the Cloudinary
response. The server verifies each file: signed mode checks Cloudinary's response signature; unsigned-preset mode
HEADs the delivery URL and takes the real size, and refuses a public_id in another exhibition's folder.
Required: name, nationality (ISO list), email, consent; per work: image, title, technique group (from the
exhibition's list; the technique text is then optional detail), category (+ sub-type,
+ video link for video art). Emails/phones never leave the back office.
Rate limits per IP per hour: ticket 150, upload 240, submit 60; per exhibition uploads 1500/h.
Layout (2026-10-29): on screens ≤960px the title comes first, then the deadline card and the rules (folded,
`details.aside-rules`), then the form; the category card is hidden there (the form's chips show the list).

### 6.2 Screening and expert panel
Curators (staff assigned to the exhibition, or admins) screen works in `/manage/<slug>` (shown / rejected).
Shown works appear publicly at once. Reviewers get personal links `/review/<token>`; `tally()` in
`functions/_lib/review.js`: endorsed when approvals ≥ threshold; `needs_curator` when too many abstain to reach
it; `not_endorsed` when it can no longer be reached. A curator `badge_override` wins. Badge label per exhibition.

### 6.3 Exhibition status and submissions (owner's model, 2026-10-21)
Stored values are from the first schema (its CHECK cannot change in place); meanings now:
`draft` = **ร่าง** (preparing, imports, not public) · `open` = **เปิด** (on view, lobby "on view") ·
`archived` = **ปิด** (lobby "past exhibitions") · `closed` = **ซ่อน** (hidden, was shown). Public = `open`/`archived`
(`PUBLIC_STATUSES` in `functions/_lib/exhibitions.js`). Staff may set ร่าง/เปิด/ซ่อน; ปิด is admin-only.
**On view and open call are separate (owner, 2026-10-25)** — two switches on an `open` exhibition, set in
`/manage/<slug>` settings and the admin drawer: `on_view` = **จัดแสดง** (lobby section "กำลังจัดแสดง" `#now`) and
`accepting` = **เปิดรับผลงาน** (lobby section "เปิดรับผลงาน" `#call`, only while the call is actually open; upcoming
or ended calls are not listed there). Both may be on; lobby order is on view → open call → past.
Submissions: `submissionWindow(ex)` needs status `open`, `accepting = 1`, a
`submission_closes_at` in the future (no closing date = no call), `submission_opens_at` past or empty, storage set.
Migration `0013_view_and_call` (0011/0012 are taken by the `catalog` branch) added the columns: open exhibitions got
`accepting = 1`, and `on_view = 1` when they had shown works. New exhibitions start with both off.
It returns `phase` none|upcoming|open|ended; public pages show "ปิดรับผลงานแล้ว" / "เปิดรับผลงาน <date>".
Migration `0009_status_model` (marker row in `site_settings`) turned old `closed` (on view, no submissions) into `open`.
**Preview deployments share the production D1**: visiting a preview runs its migrations on the real data.

### 6.4 Languages
Public pages + submission + reviewer page in Thai / English / Chinese. Choice: `?lang=th|en|zh`, then saved choice,
then browser language. `pick(obj, 'title')` falls back zh→en→th, en→th→zh. Every key must exist in all three
dictionaries (a test checks). Server error messages are Thai; `localError()` prefixes them in other languages.
Back office stays Thai.

### 6.5 Categories
`exhibitions.categories` text, one category per line, sub-types after `:`, labels after `|`:
`Mixed media technique | Mixed media technique | 综合材料技法: 2D | 2D | 平面 (2D), วิดีโออาร์ต | Video art | 录像艺术`.
Works store the first label. Default list (6 groups) in `categories.js`. A sub-type containing วิดีโอ/video
requires a video link. Empty text = no categories.

### 6.5b Techniques and the exhibition filters (owner's decisions, 2026-10-21)
`exhibitions.techniques`: one group per line, `ไทย | English | 中文` (default 15 in `techniques.js`: oil, acrylic,
watercolour, tempera, pastel, drawing, printmaking, modelling/casting, carving, ceramic, digital, photography, video,
mixed media, other). Curators edit it in the exhibition settings. Artists pick **one** group per work (`technique_group`)
and may type detail in `technique_th/en/zh`. Old works (imported, or sent before 0008) have only free text:
`GET /api/manage/:slug/works` adds `technique_guess` (keyword rules; two or more different media → mixed media); the
manage page shows "ยังไม่ยืนยันเทคนิค", per-card confirm and a bulk "ยืนยันเทคนิคตามคำแนะนำ"
(`POST /api/manage/:slug/techniques`). A guess is never public until confirmed. Display: `techniqueLabel()` in
`i18n.js` (group in the visitor's language + detail when it adds something; "Technique :" prefix hidden).
Exhibition page filters: category, technique (groups with works, counts), country (countries with works, flag + count,
plus "ไม่ระบุประเทศ" for blank/unrecognised nationality), sort, search; state is kept in the URL
(`?cat=&tech=&country=&q=&sort=&show=endorsed`) so a filtered view can be shared. On phones the filter bar is not sticky.

### 6.6 Nationality and flags
Stored as ISO 3166-1 alpha-2. Names come from `Intl.DisplayNames` in the page language. Flags are local SVGs.
Old free text was converted by migration 0006 / the importer; unknown text is kept for curators to fix.

### 6.7 Themes and design
"Gallery wall + museum labels": works hang on `--wall` with a label (catalogue No., title, flag + artist,
category, technique, size). Seven presets in `themes.css` (keys unchanged since launch): white-cube, thai-classic,
thai-contemporary, monochrome, pop, craft, heritage (dark). Each sets colours + heading font; body font is
IBM Plex Sans Thai everywhere. The home page (lobby) shows **only the exhibitions** (owner's request, 2026-10-21):
one full-width "room" per exhibition (cover = hero image, else first work; title over it; open-call pill, deadline,
work count; left edge in the exhibition's accent), grouped "on view" / "past". Header: gallery name, organiser
link, language switch. White + vermilion (`#b4321f`) chrome. Each room has a preview strip: 6 works picked at random in the
browser from a pool of up to 24 that `/api/exhibitions` returns (`samples`: id, url, title, artist name; no contact data), 3-4 in view by screen width, moving one tile
every 4 s; it pauses off screen, on hover/focus, in hidden tabs, and does not move with prefers-reduced-motion.
**Room cards (2026-10-21): 7 styles, one per theme** — white-cube = gallery wall, thai-classic = gilded Thai
frame (art left, centred text, gold seal pill), thai-contemporary = indigo diagonal poster, monochrome = catalogue
page with No. NN, pop = dotted sticker poster (art left, tilted, work-count sticker), craft = taped photo/polaroids,
heritage = night gallery (dark, spotlight, gold glow). `exhibitions.card_style` ('' = follow theme; migration 0010),
set by admins (`/admin` drawer) and the exhibition's staff (manage settings). The room takes `data-card` and
`data-theme` = that style, so colours/heading font are the style's. CSS: base.css "Lobby room cards"; labels and
fonts: `CARD_STYLES` in public/js/presets.js. Works stay whole; on phones art above text.
Strips (2026-10-21): soft right-edge fade, the arriving tile comes out of a blur, hovered tile lifts while others dim,
tiles rise in one by one when first scrolled to.
Above the rooms: a hero beside the gallery name and a short intro: **8 works, 4 s each**, chosen fairly (exhibitions in
random order, one work from each in turn; owner's choice 2026-10-21). Wipe reveal + settle from slight zoom + one light
sweep; museum label (no. / title / artist / "จากนิทรรศการ …" linking to `/e/:slug`); time bars (clickable), arrows,
swipe, arrow keys; pauses on hover/focus/hidden tab; pointer parallax; no autoplay with reduced motion. Owner wants
changes previewed on a branch first (Cloudflare builds `<branch>.pohchang-art-gallery.pages.dev`) before `main`. **works are never cropped** anywhere in the lobby (owner's request, 2026-10-21: portraits
lost their heads): the hero work, the room cover and strip tiles are shown whole (`contain`) in front of a dark,
blurred copy of the same image (400 px version + CSS blur);
below: a dark footer (organiser, address, contact, social links, exhibition list, organiser link, language switch).
Hero text and footer details are **edited by admins at `/admin` → "ตั้งค่าหอศิลป์"** in th/en/zh (`site_settings` table,
`GET /api/site`, `GET/PUT /api/admin/site`, `functions/_lib/site.js`); empty fields are hidden. Never invent these
details: the owner fills them in. Per-exhibition overrides: accent colour, heading font, ornament level, layout.

**Design B (owner's choice 2026-10-29, from the design canvas https://claude.ai/artifact/3nS9AKUFchQGMEs8ofpoCh):**
the lobby is one system, not the 7 card styles: a wall (#efeeea) with ONE work hung whole + its label + prev/next
("ผลงานที่ n จาก 8"; fair pick of 8, 4 s, paused on hover/focus/hidden tab, still with reduced motion), the site name
(or hero_title) edge to edge underneath (`fitName()` in lobby.js), rooms as stretches of wall with up to 4 whole works,
open calls on one accent field with whole days left. Styles in `public/css/lobby.css`. Each room and each open call is a band
in its exhibition's own look (owner, 2026-10-29: exhibitions must look different): `data-theme` = `cardStyle(e)` (the
lobby card style set in /admin, else the theme) plus its accent/heading-font overrides; band = `--bg`, wall = `--wall`,
name in `--font-head`, 6px `--accent` bar on top. A room whose exhibition has a poster (`hero_url`)
shows the poster large as its main picture, with up to 3 works beside the name (owner, 2026-10-29); the exhibition page
shows the poster whole and large beside the title. The old card layouts (`.room[data-card]` in base.css) are unused. Exhibition page: title on the theme's `--wall` with one summary line
(`nArtists` key), hero image whole, filled filters, label number in the text face (base.css "Design B" block).

**Design review fixes (2026-10-29, taste-skill review, PR "Design review fixes (group A)"):** masonry keeps reading
order across rows (exhibition.js `masonry()`: each work goes into the shortest column, estimated from
image_width/height; re-laid out when the column count changes; never CSS `columns`, which put No. 001 beside
No. 049); lobby room names over 26 characters get `.room-title.long` (one size smaller, two lines max) and a room
with no picture has no minimum height; the work page hint on touch screens is `figHintTouch` (Previous / Next, not
arrow keys); no public text under 13px. Review notes and the owner's open "group B" questions (mono catalogue
numbers, ornaments, eyebrows, number of typefaces) are in the claude.ai project doc `claude/taste-review-2026-10-29.md`.

### 6.8 Importing old events
`/admin` → "นำเข้างานจากระบบเดิม": preview (`step: preview`), then create a DRAFT exhibition and import in chunks of
40 (`step: create`, `step: chunk` with a double-send guard). Reads only the old site's public
`/api/submissions` and `/api/config`; images keep their old Cloudinary URLs (`image_file_id` empty so nothing is
ever deleted from old accounts); emails kept private, phones not imported.

### 6.10 Printed wall captions (ป้าย caption, owner's request 2026-10-26; live on `main` since 12d9e20)
`/manage/<slug>/captions` (link "พิมพ์ป้าย caption" on the manage page). Captions **9 × 5.5 cm, 10 per A4 portrait**
(2 × 5, grid at 15 mm left / 11 mm top), thin solid cut line round each caption; printed with the browser
(`window.print()`, `@page A4 margin 0` — tell users to print at 100 % / actual size).
**Layout (owner, 2026-10-26):** split left/right **30 : 70** (27 mm | 63 mm) with a thin vertical line; left = the
exhibition's **logo** (shown whole), right = details in this order: artist, country, title, technique (own line),
size · year (one line, owner 2026-10-26). Every field can be switched off; affiliation and flag are options, off by default. Languages chosen each
time (main + extras; an extra-language line is skipped when that text is empty).
Logo: uploaded once per exhibition on the captions page (`PUT /api/manage/:slug/caption-logo`, upload kind `logo` →
Cloudinary folder `<slug>/site`), stored in `exhibitions.caption_logo_url` / `caption_logo_file_id` (migration
`0014_caption_logo`; 0011/0012 belong to `catalog`, 0013 is on main).
**Design (owner, 2026-10-26, third round), saved with the exhibition** in `exhibitions.caption_settings` (JSON,
migration `0015_caption_settings`, `PUT /api/manage/:slug/caption-settings`, cleaned by `normalizeCaptionSettings()`
which the server and page share): languages, fields, **font size per field in pt** (artist / country / title /
technique·size·year; extra-language lines 80 %), **logo position** top / middle / bottom, **gradient templates**
built from the exhibition's theme colours (`THEME_COLORS` mirrors themes.css; accent override respected) — plain,
logo strip accent, logo strip deep→accent, soft whole, wall→white, rich whole, two theme colours — or **custom**
(area whole / logo / details, two colours, direction, text colour auto/dark/white). A template id follows the theme if
the theme changes later; custom stores its colours. Text colour "auto" is judged on the gradient's darkest end.
**Size unit** (setting `unit`: cm / mm / m / in, default cm): `withUnit()` appends it, in the caption's main language
(ซม. / cm / 厘米 …), only when the size text has numbers and no unit (x × * between numbers do not count as a unit).
**Background pictures** (owner, 2026-10-26): one for the logo part, one for the details part, uploaded on the page
(`PUT /api/manage/:slug/caption-bg { part: 'logo'|'body', file }`, columns `caption_bg_logo_url/_file_id`,
`caption_bg_body_url/_file_id`, migration `0016_caption_bg`). Shown full-cover (`object-fit: cover`) over the
colour/gradient with strength 10–100 % (settings `imgLogo`, `imgBody`). They are `<img>` elements, so they print even
with "background graphics" off; text colour on a picture is the user's choice (auto only judges the gradient).
Print-run choices (status filter, category, order, start slot, selection) stay in localStorage.
Also: automatic text shrink down to 65 % with a red frame on captions that still overflow. Users must turn on
"Background graphics" in the print dialog when a background is used. Text logic: `public/js/caption-text.js` (tested in `tests/captions.test.js`).

## 7. API (all JSON; writes require same-origin)

| Route | Who | Purpose |
|---|---|---|
| `GET /api/exhibitions` | public | lobby list (status open/archived) with counts and cover |
| `GET /api/x/:slug`, `GET /api/x/:slug/works/:id` | public | exhibition + shown works; one work with prev/next |
| `POST /api/x/:slug/ticket`, `upload-auth`, `submit` | public | submission flow (6.1) |
| `GET /api/config` | public | site name, Turnstile site key |
| `GET /api/site`, `GET/PUT /api/admin/site` | public / admin | home hero text + footer details |
| `POST /api/auth/login`, `logout`, `GET me`, `POST password` | users | session auth, forced first password change |
| `/api/admin/users[/id]`, `/api/admin/exhibitions[/id]` | admin | users, create exhibition, slug/status/staff |
| `POST /api/admin/import` | admin | old-event import (6.8) |
| `/api/manage/:slug` (+ `works`, `works/:id`, `techniques`, `reviewers`, `reviewers/:id`, `results`, `storage`, `hero`, `upload-auth`) | staff of that exhibition | settings, screening, panel, results, Cloudinary |
| `GET/POST /api/review/:token[/vote]` | reviewer link | review works, vote |
| `GET /api/dev/placeholder` | dev only | fake image when `DEV_FAKE_STORAGE=1` |

## 8. Security model (keep it)

PBKDF2-SHA256 100k (Workers cap); 5 failed logins → 15 min lock; bootstrap admin only while `users` is empty;
HttpOnly SameSite=Lax cookie; same-origin check on every `/api` write; every manage query filters by
`exhibition_id`; Cloudinary API secret AES-GCM-encrypted with `APP_ENCRYPTION_KEY` and never returned; output
always escaped with `esc()` (no raw HTML from data); CSP in `_middleware.js` (images only from self, data:, blob:,
res.cloudinary.com); reviewer tokens hashed; public responses never include email/phone/votes.

## 9. Develop, test, deploy

```bash
npm install
cp .dev.vars.example .dev.vars          # fake storage, local bootstrap admin
npm run db:init:local                   # or start with 0001 only and let migrate.js upgrade it
npm run dev                             # http://localhost:8790
npm test                                # 23 unit tests
```
- Deploy = push to `main` (Cloudflare Git integration). Check the "Cloudflare Pages" check run on the commit
  (`gh api repos/surachaiaiudo-cpu/pohchang-art-gallery/commits/<sha>/check-runs`).
  "Retry deployment" in the dashboard rebuilds the OLD commit: push a new commit instead.
- After changing CSS, bump `?v=` on the `<link>` tags of the pages that use it (current: v=7 on public pages).
- End-to-end checks were done with Playwright against `wrangler pages dev` (fake storage, a stand-in old site for
  imports, a Thai `locale` because the UI follows the browser language). Chromium: `/opt/pw-browsers/chromium`.
- Limits to respect: D1 max 100 bound parameters per statement (chunk at 90); free Workers ~50 D1 queries per
  request (bulk work goes in chunks or `json_each`); Cloudinary free 10 MB / 25 MP per image, 25 credits/month.

## 10. Backlog (not started)

Catalogue designer / PDF, catalogue library, 3D gallery, Excel import, account-wide Cloudinary quota check,
copying old-event images into the new Cloudinary account, English/Chinese back office.

## 11. Old system (still live, do not break it)

Repo https://github.com/surachaiaiudoartexhibition/artexhibition — one Pages project + D1 per event, Git-connected.
Sites: https://sirikit.pages.dev (100 works), https://18pohchangartworkshop.pages.dev (152 works), master portal
https://artexhibition.pages.dev. Its own `AGENT_HANDOFF.md` has the rules (never re-create D1/Pages, never run
`sync-all` on the full dataset). Artist emails are public in its API **by the organiser's decision**; the owner chose
on 2026-10-20 to keep it that way.
