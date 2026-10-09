const MAX_INPUT_BYTES = 15 * 1024 * 1024;

/** 把照片縮小並轉成 JPEG，避免手機原圖太大、上傳太慢 */
export const resizeImage = async (file: File, maxSize = 1200, quality = 0.85): Promise<Blob> => {
  if (!file.type.startsWith('image/')) throw new Error('請選擇圖片檔');
  if (file.size > MAX_INPUT_BYTES) throw new Error('圖片太大，請選擇 15MB 以下的照片');
  const url = URL.createObjectURL(file);
  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const element = new Image();
      element.onload = () => resolve(element);
      element.onerror = () => reject(new Error('無法讀取這張圖片'));
      element.src = url;
    });
    const scale = Math.min(1, maxSize / Math.max(image.naturalWidth, image.naturalHeight));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
    const context = canvas.getContext('2d');
    if (!context) throw new Error('瀏覽器無法處理圖片');
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    return await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('圖片轉換失敗'))), 'image/jpeg', quality);
    });
  } finally {
    URL.revokeObjectURL(url);
  }
};

export const blobToBase64 = (blob: Blob): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const data = String(reader.result || '').split(',')[1];
      if (data) resolve(data);
      else reject(new Error('圖片讀取失敗'));
    };
    reader.onerror = () => reject(new Error('圖片讀取失敗'));
    reader.readAsDataURL(blob);
  });
