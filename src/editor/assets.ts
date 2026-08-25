/**
 * 媒體暫存區。
 *
 * ⚠️ 只活在這一次的瀏覽器分頁裡：檔案存成 object URL，重新整理就沒了。
 *
 * 這是刻意的。真正的上傳、儲存與 CDN 是客戶自己的 API，不在這次的範圍。
 * 這一層的價值在於「介面是對的」——元件拿到的是一個 assetId，
 * 換成真的上傳只要改這個檔案裡的 putImage / urlOf，元件一行都不用動。
 */

const urls = new Map<string, string>();
let seq = 0;

export type UploadedImage = {
  assetId: string;
  /** 從 naturalWidth / naturalHeight 讀到的真實長寬比。 */
  aspectRatio: number;
};

export const urlOf = (assetId: string | null): string | undefined =>
  assetId ? urls.get(assetId) : undefined;

/**
 * 收下一張圖，回傳 id 與真實比例。
 *
 * 比例一定要在這裡讀：md 匯入只有檔名，讀不到尺寸，分頁只能用估的，
 * 於是版面高度會跟實際差一截。這裡是唯一拿得到真實尺寸的地方。
 */
export function putImage(file: File): Promise<UploadedImage> {
  return new Promise((resolve, reject) => {
    const assetId = `asset-${(seq += 1)}`;
    const url = URL.createObjectURL(file);
    urls.set(assetId, url);

    const probe = new Image();
    probe.onload = () => {
      const ratio = probe.naturalHeight > 0 ? probe.naturalWidth / probe.naturalHeight : 1.5;
      resolve({ assetId, aspectRatio: ratio });
    };
    probe.onerror = () => {
      urls.delete(assetId);
      URL.revokeObjectURL(url);
      reject(new Error('讀不到這張圖'));
    };
    probe.src = url;
  });
}

/** 讓使用者挑一個檔案。取消時回傳 null。 */
export function pickFile(accept: string): Promise<File | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = accept;
    // 使用者按取消時 change 不會觸發，靠 cancel 事件收尾，
    // 否則這個 Promise 永遠不會結束
    input.oncancel = () => resolve(null);
    input.onchange = () => resolve(input.files?.[0] ?? null);
    input.click();
  });
}

/** YouTube 網址 → 影片 id。認得 watch、youtu.be、embed 三種寫法。 */
export function youtubeId(ref: string): string | null {
  if (/^[\w-]{11}$/.test(ref)) return ref;
  const m = ref.match(/(?:youtu\.be\/|v=|embed\/)([\w-]{11})/);
  return m ? m[1] : null;
}
