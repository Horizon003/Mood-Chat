/* ============================================================
   Cloudinary — unsigned uploads from the browser
   ============================================================ */
import { CLOUDINARY_CONFIG } from "./config.js";

/**
 * Upload a file/blob to Cloudinary.
 * @param {File|Blob} file
 * @param {Object} opts { folder, resourceType, onProgress }
 * @returns {Promise<{url, secureUrl, publicId, width, height, format, resourceType, duration}>}
 */
export function uploadToCloudinary(file, opts = {}) {
  const { folder = "moodchat", resourceType = "auto", onProgress } = opts;

  return new Promise((resolve, reject) => {
    const url = `https://api.cloudinary.com/v1_1/${CLOUDINARY_CONFIG.cloudName}/${resourceType}/upload`;
    const form = new FormData();
    form.append("file", file);
    form.append("upload_preset", CLOUDINARY_CONFIG.uploadPreset);
    if (folder) form.append("folder", folder);

    const xhr = new XMLHttpRequest();
    xhr.open("POST", url, true);

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && onProgress) {
        onProgress(Math.round((e.loaded / e.total) * 100));
      }
    };

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const r = JSON.parse(xhr.responseText);
          resolve({
            url: r.url,
            secureUrl: r.secure_url,
            publicId: r.public_id,
            width: r.width,
            height: r.height,
            format: r.format,
            resourceType: r.resource_type,
            duration: r.duration || null,
            bytes: r.bytes,
          });
        } catch (err) {
          reject(new Error("Cloudinary parse error"));
        }
      } else {
        let msg = "Upload failed";
        try { msg = JSON.parse(xhr.responseText).error.message; } catch (_) {}
        reject(new Error(msg));
      }
    };

    xhr.onerror = () => reject(new Error("Network error during upload"));
    xhr.send(form);
  });
}

/** Build a transformed thumbnail URL */
export function cldThumb(secureUrl, w = 400) {
  if (!secureUrl) return secureUrl;
  return secureUrl.replace("/upload/", `/upload/c_limit,w_${w},q_auto,f_auto/`);
}

/** dataURL -> Blob (for doodles/canvas) */
export function dataUrlToBlob(dataUrl) {
  const [head, body] = dataUrl.split(",");
  const mime = head.match(/:(.*?);/)[1];
  const bin = atob(body);
  const arr = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
  return new Blob([arr], { type: mime });
}
