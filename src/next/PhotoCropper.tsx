import { useRef } from 'react';
import { clampOffset, CROP_FRAME as FRAME, placement, type CropView } from '../data/images';

// A picked photo inside the portrait frame: drag it (or use the arrow keys) to move it, and the
// slider to zoom. What shows in the frame is what's saved (drawPhoto in src/data/uploads.ts).
export default function PhotoCropper({
  img,
  zoom,
  offset,
  onChange,
}: {
  img: HTMLImageElement;
  zoom: number;
  offset: CropView['offset'];
  onChange: (zoom: number, offset: CropView['offset']) => void;
}) {
  const view: CropView = { image: { width: img.naturalWidth, height: img.naturalHeight }, frame: FRAME, zoom, offset };
  const at = placement(view);
  const drag = useRef<{ x: number; y: number; from: CropView['offset'] } | null>(null);
  const moveTo = (x: number, y: number) => onChange(zoom, clampOffset({ ...view, offset: { x, y } }));
  const STEPS: Record<string, [number, number]> = { ArrowLeft: [-10, 0], ArrowRight: [10, 0], ArrowUp: [0, -10], ArrowDown: [0, 10] };

  return (
    <div className="space-y-3">
      <div
        role="img"
        aria-label="The photo as it will be cropped. Drag it, or use the arrow keys, to move it in the frame."
        tabIndex={0}
        className="relative mx-auto overflow-hidden rounded-2xl bg-gray-100 touch-none select-none cursor-grab active:cursor-grabbing focus:outline-none focus-visible:ring-2 focus-visible:ring-green-600 focus-visible:ring-offset-2"
        style={{ width: FRAME.width, height: FRAME.height }}
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId);
          drag.current = { x: e.clientX, y: e.clientY, from: clampOffset(view) };
        }}
        onPointerMove={(e) => {
          const d = drag.current;
          if (d) moveTo(d.from.x + e.clientX - d.x, d.from.y + e.clientY - d.y);
        }}
        onPointerUp={() => (drag.current = null)}
        onPointerCancel={() => (drag.current = null)}
        onKeyDown={(e) => {
          const step = STEPS[e.key];
          if (!step) return;
          e.preventDefault();
          const from = clampOffset(view);
          moveTo(from.x + step[0], from.y + step[1]);
        }}
      >
        <img
          src={img.src}
          alt=""
          draggable={false}
          className="absolute max-w-none pointer-events-none"
          style={{ left: at.left, top: at.top, width: at.width, height: at.height }}
        />
      </div>
      <label className="mx-auto flex items-center gap-3 text-sm text-gray-600" style={{ width: FRAME.width }}>
        Zoom
        <input
          type="range"
          min={1}
          max={4}
          step={0.01}
          value={zoom}
          onChange={(e) => {
            const next = Number(e.target.value);
            onChange(next, clampOffset({ ...view, zoom: next }));
          }}
          className="flex-1 accent-green-600"
        />
      </label>
    </div>
  );
}
