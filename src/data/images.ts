// Profile photos and team logos (Phase 2): where an image's address points, and the arithmetic for
// cropping a photo to the portrait frame and fitting a logo in its square. No browser APIs here, so
// it's tested directly (tests/images.test.ts); src/data/uploads.ts draws and uploads.

// Photos are portraits, 3 wide by 4 tall, the shape the profile pages and the guide show
export const PHOTO_SIZE = { width: 900, height: 1200 };
// Logos keep their own shape inside a square, on a clear background
export const LOGO_SIZE = 512;
// The cropper's frame on screen, the same 3:4 shape
export const CROP_FRAME = { width: 240, height: 320 };

// An uploaded image is saved as its full download address; the photos from before Phase 2 are
// files the app carries ("profiles/mark-reese.jpg"), found under the site's base path
export const isUploaded = (path: string) => /^https?:\/\//.test(path);
export const imageUrl = (path: string | null | undefined, base: string) => (path ? (isUploaded(path) ? path : `${base}${path}`) : null);

// The cropper shows the image inside a frame, scaled by `zoom` beyond the smallest size that covers
// it, and moved by `offset` (in frame pixels) from centered
export interface CropView {
  image: { width: number; height: number };
  frame: { width: number; height: number };
  zoom: number; // 1 = just covers the frame
  offset: { x: number; y: number };
}

// How much the image is scaled to just cover the frame
export const coverScale = (v: Pick<CropView, 'image' | 'frame'>) => Math.max(v.frame.width / v.image.width, v.frame.height / v.image.height);

// The furthest the image can move each way before an edge shows inside the frame
function slack(v: CropView) {
  const scale = coverScale(v) * v.zoom;
  return { x: Math.max(0, (v.image.width * scale - v.frame.width) / 2), y: Math.max(0, (v.image.height * scale - v.frame.height) / 2) };
}

// The offset kept within that slack
export function clampOffset(v: CropView) {
  const s = slack(v);
  return { x: Math.min(s.x, Math.max(-s.x, v.offset.x)), y: Math.min(s.y, Math.max(-s.y, v.offset.y)) };
}

// Where the image sits in the frame: its top-left corner and drawn size, in frame pixels
export function placement(v: CropView) {
  const scale = coverScale(v) * v.zoom;
  const offset = clampOffset(v);
  const width = v.image.width * scale;
  const height = v.image.height * scale;
  return { left: (v.frame.width - width) / 2 + offset.x, top: (v.frame.height - height) / 2 + offset.y, width, height, scale };
}

// The part of the image inside the frame, in the image's own pixels, for drawing the crop
export function cropSource(v: CropView) {
  const { left, top, scale } = placement(v);
  return { x: -left / scale, y: -top / scale, width: v.frame.width / scale, height: v.frame.height / scale };
}

// A logo fitted inside a square of `box` pixels, centered, keeping its shape
export function fitInside(image: { width: number; height: number }, box: number) {
  const scale = Math.min(box / image.width, box / image.height);
  const width = image.width * scale;
  const height = image.height * scale;
  return { x: (box - width) / 2, y: (box - height) / 2, width, height };
}

// An upload's file name: what it is, whose or which team's, and when, so each upload has its own
// address and nothing cached under an old one goes stale ("photo-mark-reese-1731350000000.jpg")
export function uploadName(kind: 'photo' | 'logo', slug: string, at: number) {
  const safe = slug.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60) || 'image';
  return `${kind}-${safe}-${at}.${kind === 'photo' ? 'jpg' : 'png'}`;
}
