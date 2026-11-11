// Photo cropping and logo fitting arithmetic (src/data/images.ts), and where image addresses point

import { describe, expect, it } from 'vitest';
import { clampOffset, cropSource, fitInside, imageUrl, isUploaded, placement, uploadName } from '../src/data/images.ts';

const frame = { width: 300, height: 400 };

describe('images', () => {
  it('finds built-in photos under the base path and uploaded ones at their own address', () => {
    expect(imageUrl('profiles/mark-reese.jpg', '/')).toBe('/profiles/mark-reese.jpg');
    const uploaded = 'https://firebasestorage.googleapis.com/v0/b/x/o/envs%2Flive%2Fuploads%2Fu%2Fphoto.jpg?alt=media&token=t';
    expect(imageUrl(uploaded, '/')).toBe(uploaded);
    expect(isUploaded('http://127.0.0.1:9199/v0/b/x/o/a')).toBe(true); // the emulator's
    expect(imageUrl(null, '/')).toBeNull();
  });

  it('crops a landscape photo to the middle of the portrait frame', () => {
    // 1200×900 covers a 300×400 frame at 400/900 = 0.444: 533 wide, so 233 to spare
    const v = { image: { width: 1200, height: 900 }, frame, zoom: 1, offset: { x: 0, y: 0 } };
    const src = cropSource(v);
    expect(src.height).toBeCloseTo(900);
    expect(src.width).toBeCloseTo(675); // 3:4 of the full height
    expect(src.x).toBeCloseTo((1200 - 675) / 2);
    expect(src.y).toBeCloseTo(0);
  });

  it('keeps the image covering the frame however far it is dragged', () => {
    const v = { image: { width: 1200, height: 900 }, frame, zoom: 1, offset: { x: 1000, y: 50 } };
    expect(clampOffset(v).x).toBeCloseTo((1200 * (400 / 900) - 300) / 2);
    expect(clampOffset(v).y).toBe(0); // no room up or down at this zoom
    const p = placement(v);
    expect(p.left).toBeCloseTo(0); // dragged all the way right: the image's left edge at the frame's
    expect(cropSource(v).x).toBeCloseTo(0);
  });

  it('zooms in on the middle, and lets the zoomed image move', () => {
    const v = { image: { width: 900, height: 1200 }, frame, zoom: 2, offset: { x: 0, y: 0 } };
    const src = cropSource(v);
    expect(src.width).toBeCloseTo(450);
    expect(src.height).toBeCloseTo(600);
    expect(src.x).toBeCloseTo(225);
    expect(src.y).toBeCloseTo(300);
    const moved = cropSource({ ...v, offset: { x: -150, y: 0 } }); // dragged left: shows more of the right
    expect(moved.x).toBeCloseTo(450); // 150 frame pixels at 2/3 scale is 225 image pixels
  });

  it('fits a wide logo inside its square without cropping', () => {
    expect(fitInside({ width: 1000, height: 500 }, 512)).toEqual({ x: 0, y: 128, width: 512, height: 256 });
    expect(fitInside({ width: 64, height: 128 }, 512)).toEqual({ x: 128, y: 0, width: 256, height: 512 });
  });

  it('names each upload by kind, owner and time', () => {
    expect(uploadName('photo', 'mark-reese', 1731350000000)).toBe('photo-mark-reese-1731350000000.jpg');
    expect(uploadName('logo', 'founders 2026-columbia Team Palmetto', 1)).toBe('logo-founders-2026-columbia-team-palmetto-1.png');
    expect(uploadName('logo', '***', 1)).toBe('logo-image-1.png');
  });
});
