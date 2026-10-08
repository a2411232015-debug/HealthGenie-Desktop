export interface Coordinates {
  lat: number;
  lng: number;
}

export const distanceKm = (a: Coordinates, b: Coordinates): number => {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
};

export const formatDistance = (km: number): string => (km < 1 ? `${Math.round(km * 1000)} 公尺` : `${km.toFixed(1)} 公里`);

const LOCATION_KEY = 'healthgenie_location';

export const getSavedLocation = (): Coordinates | null => {
  try {
    const saved = JSON.parse(sessionStorage.getItem(LOCATION_KEY) || 'null');
    return saved && Number.isFinite(saved.lat) && Number.isFinite(saved.lng) ? saved : null;
  } catch {
    return null;
  }
};

export const requestLocation = (): Promise<Coordinates> =>
  new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('這個瀏覽器不支援定位'));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const coords = { lat: position.coords.latitude, lng: position.coords.longitude };
        try { sessionStorage.setItem(LOCATION_KEY, JSON.stringify(coords)); } catch { /* 無痕模式可能無法儲存 */ }
        resolve(coords);
      },
      (error) => reject(new Error(error.code === error.PERMISSION_DENIED ? '你沒有允許定位，可以到瀏覽器設定開啟' : '無法取得目前位置')),
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 5 * 60 * 1000 },
    );
  });
