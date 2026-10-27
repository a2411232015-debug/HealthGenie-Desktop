import React, { useEffect, useRef, useState } from 'react';
import { Bike, Home, Store } from 'lucide-react';
import { Coordinates } from '../utils/geo';

/**
 * 輕量地圖：直接使用 OpenStreetMap 圖磚（不需要金鑰），
 * 顯示店家、顧客與（模擬的）外送員位置，以及兩點之間的直線路線。
 */
const TILE = 256;
const PADDING = 44;

const project = ({ lat, lng }: Coordinates, zoom: number) => {
  const scale = TILE * 2 ** zoom;
  const sin = Math.min(Math.max(Math.sin((lat * Math.PI) / 180), -0.9999), 0.9999);
  return {
    x: ((lng + 180) / 360) * scale,
    y: (0.5 - Math.log((1 + sin) / (1 - sin)) / (4 * Math.PI)) * scale,
  };
};

const fitZoom = (points: Coordinates[], width: number, height: number): number => {
  if (points.length < 2) return 15;
  for (let zoom = 17; zoom >= 3; zoom -= 1) {
    const projected = points.map((point) => project(point, zoom));
    const xs = projected.map((point) => point.x);
    const ys = projected.map((point) => point.y);
    if (Math.max(...xs) - Math.min(...xs) <= width - PADDING * 2 && Math.max(...ys) - Math.min(...ys) <= height - PADDING * 2) return zoom;
  }
  return 3;
};

const MARKER_STYLE = {
  store: 'bg-teal-600',
  home: 'bg-orange-500',
  courier: 'bg-blue-600',
} as const;

const MarkerPin: React.FC<{ x: number; y: number; tone: keyof typeof MARKER_STYLE; label: string; pulse?: boolean }> = ({ x, y, tone, label, pulse }) => (
  <div className="absolute flex -translate-x-1/2 -translate-y-1/2 flex-col items-center" style={{ left: x, top: y }}>
    <span className={`relative flex h-9 w-9 items-center justify-center rounded-full border-2 border-white text-white shadow-lg ${MARKER_STYLE[tone]}`}>
      {pulse && <span className={`absolute inset-0 animate-ping rounded-full opacity-40 ${MARKER_STYLE[tone]}`} />}
      {tone === 'store' ? <Store className="relative h-4 w-4" /> : tone === 'home' ? <Home className="relative h-4 w-4" /> : <Bike className="relative h-4 w-4" />}
    </span>
    <span className="mt-1 whitespace-nowrap rounded-md bg-white/90 px-1.5 py-0.5 text-[11px] font-bold text-slate-700 shadow-sm">{label}</span>
  </div>
);

export const DeliveryMap: React.FC<{
  store: Coordinates | null;
  destination: Coordinates | null;
  courier?: Coordinates | null;
  courierLabel?: string;
  className?: string;
}> = ({ store, destination, courier = null, courierLabel = '外送員', className = 'h-56' }) => {
  const ref = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });

  useEffect(() => {
    const element = ref.current;
    if (!element) return undefined;
    const measure = () => setSize({ width: element.clientWidth, height: element.clientHeight });
    measure();
    if (typeof ResizeObserver === 'undefined') return undefined;
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const anchors = [store, destination].filter((point): point is Coordinates => Boolean(point));
  if (anchors.length === 0) return null;

  const { width, height } = size;
  const zoom = width > 0 ? fitZoom(anchors, width, height) : 15;
  const projected = anchors.map((point) => project(point, zoom));
  const center = {
    x: (Math.min(...projected.map((point) => point.x)) + Math.max(...projected.map((point) => point.x))) / 2,
    y: (Math.min(...projected.map((point) => point.y)) + Math.max(...projected.map((point) => point.y))) / 2,
  };
  const left = center.x - width / 2;
  const top = center.y - height / 2;
  const toScreen = (point: Coordinates) => {
    const p = project(point, zoom);
    return { x: p.x - left, y: p.y - top };
  };

  const count = 2 ** zoom;
  const tiles: { key: string; src: string; x: number; y: number }[] = [];
  if (width > 0) {
    for (let tx = Math.floor(left / TILE); tx <= Math.floor((left + width) / TILE); tx += 1) {
      for (let ty = Math.floor(top / TILE); ty <= Math.floor((top + height) / TILE); ty += 1) {
        if (ty < 0 || ty >= count) continue;
        const wrapped = ((tx % count) + count) % count;
        tiles.push({ key: `${zoom}-${tx}-${ty}`, src: `https://tile.openstreetmap.org/${zoom}/${wrapped}/${ty}.png`, x: tx * TILE - left, y: ty * TILE - top });
      }
    }
  }

  const storePoint = store ? toScreen(store) : null;
  const destinationPoint = destination ? toScreen(destination) : null;
  const courierPoint = courier ? toScreen(courier) : null;

  return (
    <div ref={ref} className={`relative w-full overflow-hidden rounded-2xl border border-slate-200 bg-slate-100 ${className}`} role="img" aria-label="外送地圖：店家、送達地點與外送員位置">
      {tiles.map((tile) => (
        <img key={tile.key} src={tile.src} alt="" draggable={false} loading="lazy" className="pointer-events-none absolute select-none" style={{ left: tile.x, top: tile.y, width: TILE, height: TILE }} onError={(event) => { event.currentTarget.style.visibility = 'hidden'; }} />
      ))}
      {storePoint && destinationPoint && (
        <svg className="pointer-events-none absolute inset-0 h-full w-full" aria-hidden="true">
          <line x1={storePoint.x} y1={storePoint.y} x2={destinationPoint.x} y2={destinationPoint.y} stroke="#0f766e" strokeWidth="4" strokeDasharray="8 8" strokeLinecap="round" opacity="0.8" />
        </svg>
      )}
      {storePoint && <MarkerPin x={storePoint.x} y={storePoint.y} tone="store" label="店家" />}
      {destinationPoint && <MarkerPin x={destinationPoint.x} y={destinationPoint.y} tone="home" label="送達地點" />}
      {courierPoint && <MarkerPin x={courierPoint.x} y={courierPoint.y} tone="courier" label={courierLabel} pulse />}
      <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer" className="absolute bottom-0 right-0 rounded-tl-md bg-white/85 px-1.5 py-0.5 text-[10px] text-slate-600 hover:underline">© OpenStreetMap contributors</a>
    </div>
  );
};
