// Drawing and uploading profile photos and team logos (Phase 2). Images are made small in the
// browser before they go up: a photo is cropped to 900×1200 and saved as a JPEG, a logo is fitted
// into 512×512 and saved as a PNG, which keeps a clear background. They go into the uploader's own
// folder (storage.rules); the caller saves the address on the profile or the team.

import type { FirebaseStorage } from 'firebase/storage';
import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import { cropSource, fitInside, LOGO_SIZE, PHOTO_SIZE, uploadName, type CropView } from './images';
import type { DataEnv } from './types';

// A picked file as an image the page can draw. Browsers turn phone photos the right way up, and
// iPhones hand over a JPEG when a HEIC photo is picked.
export function loadImage(file: Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("That file isn't an image this browser can open."));
    };
    img.src = url;
  });
}

function toBlob(canvas: HTMLCanvasElement, type: string, quality?: number): Promise<Blob> {
  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('The image could not be made.'))), type, quality));
}

// The photo as cropped in the cropper
export function drawPhoto(img: HTMLImageElement, view: Omit<CropView, 'image'>) {
  const canvas = document.createElement('canvas');
  canvas.width = PHOTO_SIZE.width;
  canvas.height = PHOTO_SIZE.height;
  const ctx = canvas.getContext('2d')!;
  ctx.imageSmoothingQuality = 'high';
  const src = cropSource({ ...view, image: { width: img.naturalWidth, height: img.naturalHeight } });
  ctx.drawImage(img, src.x, src.y, src.width, src.height, 0, 0, canvas.width, canvas.height);
  return toBlob(canvas, 'image/jpeg', 0.86);
}

// The logo, whole, centered in its square
export function drawLogo(img: HTMLImageElement) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = LOGO_SIZE;
  const ctx = canvas.getContext('2d')!;
  ctx.imageSmoothingQuality = 'high';
  const at = fitInside({ width: img.naturalWidth, height: img.naturalHeight }, LOGO_SIZE);
  ctx.drawImage(img, at.x, at.y, at.width, at.height);
  return toBlob(canvas, 'image/png');
}

// Uploads an image into the signed-in person's folder and returns its download address
export async function uploadImage(storage: FirebaseStorage, env: DataEnv, uid: string, kind: 'photo' | 'logo', slug: string, blob: Blob) {
  const file = ref(storage, `envs/${env}/uploads/${uid}/${uploadName(kind, slug, Date.now())}`);
  await uploadBytes(file, blob, { contentType: kind === 'photo' ? 'image/jpeg' : 'image/png', cacheControl: 'public, max-age=31536000, immutable' });
  return getDownloadURL(file);
}
