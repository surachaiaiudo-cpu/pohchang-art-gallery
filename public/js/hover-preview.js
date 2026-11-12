// Large picture beside a thumbnail while the mouse rests on it (owner, 2026-11-12: screening page).
// Mouse/trackpad only: touch screens keep their usual tap behaviour. The preview never takes clicks,
// so the card underneath works as before.
const canHover = () => window.matchMedia('(hover: hover) and (pointer: fine)').matches;
const GAP = 14;
const DELAY = 180;

// container: element holding the thumbnails; selector: the thumbnail; info(el) -> { small, large, lines: [] } or null
export function hoverPreview(container, selector, info) {
  const box = document.createElement('div');
  box.className = 'hover-preview';
  box.setAttribute('aria-hidden', 'true');
  box.innerHTML = '<div class="hp-img"><img alt=""></div><div class="hp-cap"></div>';
  document.body.appendChild(box);
  const im = box.querySelector('img');
  const cap = box.querySelector('.hp-cap');
  let timer = null;
  let current = null;

  const hide = () => {
    clearTimeout(timer);
    current = null;
    box.classList.remove('show');
  };

  // Beside the thumbnail on the side with more room, vertically centred on it, kept inside the window.
  function place(el, ratio) {
    const r = el.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const right = vw - r.right - GAP * 2;
    const left = r.left - GAP * 2;
    const side = right >= left ? 'right' : 'left';
    const maxW = Math.max(240, Math.min(side === 'right' ? right : left, 900));
    const maxH = Math.min(vh * 0.8, 820) - 60; // room for the caption
    let w = maxW;
    let h = w / ratio;
    if (h > maxH) { h = maxH; w = h * ratio; }
    box.style.width = `${Math.round(w)}px`;
    im.style.height = `${Math.round(h)}px`;
    const bh = box.offsetHeight;
    const top = Math.max(GAP, Math.min(vh - bh - GAP, r.top + r.height / 2 - bh / 2));
    const x = side === 'right' ? r.right + GAP : r.left - GAP - w;
    box.style.left = `${Math.round(Math.max(GAP, x))}px`;
    box.style.top = `${Math.round(top)}px`;
  }

  function show(el) {
    const d = info(el);
    if (!d || !d.large) return;
    current = el;
    const thumb = el.querySelector('img');
    const ratio = d.ratio || (thumb && thumb.naturalWidth ? thumb.naturalWidth / thumb.naturalHeight : 4 / 3);
    // The small picture is already loaded: show it at once, then the sharp one replaces it.
    im.src = d.small || d.large;
    if (d.large !== d.small) {
      const big = new Image();
      big.onload = () => { if (current === el) im.src = d.large; };
      big.src = d.large;
    }
    cap.innerHTML = '';
    for (const line of d.lines || []) {
      if (!line) continue;
      const div = document.createElement('div');
      div.textContent = line;
      cap.appendChild(div);
    }
    place(el, ratio > 0 ? ratio : 4 / 3);
    box.classList.add('show');
  }

  container.addEventListener('mouseover', (e) => {
    if (!canHover()) return;
    const el = e.target.closest(selector);
    if (!el || !container.contains(el) || el === current) return;
    clearTimeout(timer);
    timer = setTimeout(() => show(el), DELAY);
  });
  container.addEventListener('mouseout', (e) => {
    const el = e.target.closest(selector);
    if (el && !el.contains(e.relatedTarget)) hide();
  });
  container.addEventListener('mousedown', hide);
  window.addEventListener('scroll', hide, { passive: true });
  window.addEventListener('resize', hide);
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') hide(); });
  return { hide };
}
