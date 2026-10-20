// Direct browser -> ImageKit upload using a short-lived signature from our server.
const TYPES = ['image/jpeg', 'image/png', 'image/webp'];

export function checkImageFile(file, maxBytes = 25 * 1024 * 1024) {
  if (!file) return 'กรุณาเลือกไฟล์รูป';
  if (!TYPES.includes(file.type)) return 'รองรับเฉพาะไฟล์ JPG, PNG หรือ WebP';
  if (file.size > maxBytes) return `ไฟล์ใหญ่เกิน ${Math.round(maxBytes / 1048576)} MB (ไฟล์นี้ ${(file.size / 1048576).toFixed(1)} MB)`;
  return '';
}

function safeName(name) {
  const base = (name || 'image').replace(/\.[^.]+$/, '').normalize('NFKD').replace(/[^\w-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40);
  const ext = ((name || '').match(/\.(jpe?g|png|webp)$/i) || ['.jpg'])[0].toLowerCase();
  return `${base || 'image'}${ext}`;
}

// auth: { token, expire, signature, publicKey, folder, fake? }. Resolves { fileId, url }.
export function uploadImage(file, auth, onProgress = () => {}) {
  if (auth.fake) {
    // Local development: pretend the upload happened.
    return new Promise((resolve) => {
      let p = 0;
      const t = setInterval(() => {
        p += 25; onProgress(Math.min(p, 100));
        if (p >= 100) {
          clearInterval(t);
          const id = 'fake' + Math.random().toString(36).slice(2, 12) + Date.now().toString(36);
          resolve({ fileId: id, url: `/api/dev/placeholder?seed=${id}` });
        }
      }, 120);
    });
  }
  return new Promise((resolve, reject) => {
    const form = new FormData();
    form.append('file', file);
    form.append('fileName', safeName(file.name));
    form.append('publicKey', auth.publicKey);
    form.append('signature', auth.signature);
    form.append('expire', String(auth.expire));
    form.append('token', auth.token);
    form.append('folder', auth.folder);
    form.append('useUniqueFileName', 'true');
    const xhr = new XMLHttpRequest();
    xhr.open('POST', 'https://upload.imagekit.io/api/v1/files/upload');
    xhr.upload.onprogress = (e) => { if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100)); };
    xhr.onload = () => {
      let data = {};
      try { data = JSON.parse(xhr.responseText); } catch { /* ignore */ }
      if (xhr.status >= 200 && xhr.status < 300 && data.fileId) resolve({ fileId: data.fileId, url: data.url });
      else reject(new Error(data.message || `อัปโหลดไม่สำเร็จ (${xhr.status})`));
    };
    xhr.onerror = () => reject(new Error('อัปโหลดไม่สำเร็จ กรุณาตรวจสอบอินเทอร์เน็ต'));
    xhr.send(form);
  });
}
