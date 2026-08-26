import { newId } from './ids';
import type { IconName } from '../assets/icons.generated';
import type { PopupItem, PopupKind } from './types';

/**
 * Pop-up 是元件的屬性，不是第十種元件。
 *
 * 行為規則只有一條，而且沒有例外：**有掛補充就開檢視器**，
 * 檢視器裡每一項的行動鈕依它自己的 kind 決定。
 *
 * 特別注意「不依數量變化」：只掛一項時也是開檢視器，不是直接播放、
 * 不是直接開連結。舊系統就是這樣——一項直接開、兩項才跳清單——
 * 結果老師沒辦法預測學生點下去會發生什麼，只好每一課都自己先點一遍。
 */

export const POPUP_KIND: Record<PopupKind, { label: string; icon: IconName; action: string }> = {
  text: { label: '文字說明', icon: 'file-text', action: '閱讀' },
  image: { label: '圖片', icon: 'image', action: '看大圖' },
  video: { label: '影片', icon: 'video', action: '播放' },
  audio: { label: '聲音', icon: 'music', action: '播放' },
  web: { label: '網頁', icon: 'globe', action: '開啟' },
  jump: { label: '跳到某一段', icon: 'arrow-up-right', action: '前往' },
};

export const POPUP_KINDS = Object.keys(POPUP_KIND) as PopupKind[];

/** 新增一項時的空白值。標題留空，由老師填。 */
export function newPopup(kind: PopupKind): PopupItem {
  const id = newId('pop');
  switch (kind) {
    case 'text':
      return { id, kind, title: '', body: '' };
    case 'image':
      return { id, kind, title: '', assetId: null };
    case 'video':
      return { id, kind, title: '', source: 'youtube', ref: '' };
    case 'audio':
      return { id, kind, title: '', assetId: null };
    case 'web':
      // embeddable 恆為 false：能不能嵌入要看對方的 X-Frame-Options，
      // 那是伺服器端的檢查，屬於客戶的 API
      return { id, kind, title: '', url: '', embeddable: false };
    case 'jump':
      return { id, kind, title: '', targetRowId: null };
  }
}

/** 這一項還缺什麼才算填完。老師要在編輯時就看得出來，不是上課才發現。 */
export function missingOf(item: PopupItem): string | null {
  switch (item.kind) {
    case 'text':
      return item.body.trim() ? null : '還沒填內容';
    case 'image':
    case 'audio':
      return item.assetId ? null : '還沒選檔案';
    case 'video':
      return item.ref.trim() ? null : '還沒填影片來源';
    case 'web':
      return item.url.trim() ? null : '還沒填網址';
    case 'jump':
      return item.targetRowId ? null : '還沒選要跳到哪裡';
  }
}

/** 沒填標題時顯示什麼。清單上總要有字，不能是空白列。 */
export const titleOf = (item: PopupItem) => item.title.trim() || POPUP_KIND[item.kind].label;
