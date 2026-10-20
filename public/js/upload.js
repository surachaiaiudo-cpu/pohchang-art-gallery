// Direct browser -> Cloudinary upload with a short-lived signature from our server.
// Files over the Cloudinary free-plan limits (10 MB, 25 MP) are resized/recompressed here first,
// so artists can hand in camera originals without preparing them.
const TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const SAFE_PIXELS = 16e6;   // iPhone Safari cannot draw canvases much larger than this

export function checkImageFile(file) {
  if (!file) return 'กรุณาเลือกไฟล์รูป';
  if (!TYPES.includes(file.type)) return 'รองรับเฉพาะไฟล์ JPG, PNG หรือ WebP';
  if (file.size > 80 * 1024 * 1024) return 'ไฟล์ใหญ่เกิน 80 MB กรุณาลดขนาดก่อนส่ง';
  return '';
}

function loadImage(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => resolve({ img, url });
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('เปิดไฟล์ภาพไม่ได้')); };
    img.src = url;
  });
}

const toBlob = (canvas, q) => new Promise((r) => canvas.toBlob(r, 'image/jpeg', q));

// Returns the original file when it already fits, otherwise a high-quality JPEG that does.
export async function fitForUpload(file, maxBytes = 10 * 1024 * 1024, maxPixels = 25e6) {
  const { img, url } = await loadImage(file);
  try {
    const w = img.naturalWidth, h = img.naturalHeight;
    if (file.size <= maxBytes && w * h <= maxPixels) return { file, width: w, height: h, resized: false };
    const scale = Math.min(1, Math.sqrt(Math.min(maxPixels * 0.96, SAFE_PIXELS) / (w * h)));
    const cw = Math.round(w * scale), ch = Math.round(h * scale);
    const canvas = document.createElement('canvas');
    canvas.width = cw; canvas.height = ch;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#fff';               // PNG transparency becomes white, not black
    ctx.fillRect(0, 0, cw, ch);
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, 0, 0, cw, ch);
    let q = 0.92, blob = await toBlob(canvas, q);
    while (blob && blob.size > maxBytes * 0.97 && q > 0.6) { q -= 0.06; blob = await toBlob(canvas, q); }
    if (!blob || blob.size > maxBytes) throw new Error('ย่อไฟล์ให้เล็กกว่า 10 MB ไม่ได้ กรุณาลดขนาดภาพก่อนส่ง');
    const name = (file.name || 'image').replace(/\.[^.]+$/, '') + '.jpg';
    return { file: new File([blob], name, { type: 'image/jpeg' }), width: cw, height: ch, resized: true };
  } finally {
    URL.revokeObjectURL(url);
  }
}

// auth: { cloudName, uploadPreset, folder } OR { cloudName, apiKey, timestamp, signature, folder, allowed_formats } OR { fake: true, folder }
// Resolves with the fields our server needs to verify the upload.
export function uploadImage(file, auth, onProgress = () => {}) {
  if (auth.fake) {
    return new Promise((resolve) => {
      let p = 0;
      const t = setInterval(() => {
        p += 25; onProgress(Math.min(p, 100));
        if (p >= 100) {
          clearInterval(t);
          const id = `${auth.folder}/fake${Math.random().toString(36).slice(2, 10)}`;
          resolve({ public_id: id, version: '1', signature: 'fake', format: 'jpg', bytes: file.size, width: 1600, height: 1200,
            url: `/api/dev/placeholder?seed=${encodeURIComponent(id)}` });
        }
      }, 120);
    });
  }
  return new Promise((resolve, reject) => {
    const form = new FormData();
    form.append('file', file);
    if (auth.uploadPreset) {
      form.append('upload_preset', auth.uploadPreset);
      if (auth.folder) form.append('folder', auth.folder);
    } else {
      form.append('api_key', auth.apiKey);
      form.append('timestamp', String(auth.timestamp));
      form.append('signature', auth.signature);
      form.append('folder', auth.folder);
      form.append('allowed_formats', auth.allowed_formats);
    }
    const xhr = new XMLHttpRequest();
    xhr.open('POST', `https://api.cloudinary.com/v1_1/${encodeURIComponent(auth.cloudName)}/image/upload`);
    xhr.upload.onprogress = (e) => { if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100)); };
    xhr.onload = () => {
      let d = {};
      try { d = JSON.parse(xhr.responseText); } catch { /* ignore */ }
      if (xhr.status >= 200 && xhr.status < 300 && d.public_id) {
        resolve({ public_id: d.public_id, version: String(d.version), signature: d.signature || '', format: d.format,
          bytes: d.bytes, width: d.width, height: d.height, url: d.secure_url });
      } else {
        reject(new Error((d.error && d.error.message) ? `อัปโหลดไม่สำเร็จ: ${d.error.message}` : `อัปโหลดไม่สำเร็จ (${xhr.status})`));
      }
    };
    xhr.onerror = () => reject(new Error('อัปโหลดไม่สำเร็จ กรุณาตรวจสอบอินเทอร์เน็ต'));
    xhr.send(form);
  });
}
