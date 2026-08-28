import { walkBlocks } from '../model/document';
import { canHavePopup } from '../model/registry';
import type { Doc, PopupItem, TextBlock } from '../model/types';

/**
 * 示範用的種子。
 *
 * ⚠️ 這裡加的東西**不在 md 裡**，是程式碼掛上去的。
 *
 * 理由：Pop-up 是老師編出來的，md 規格裡沒有這個構造，所以匯入任何一份
 * 真實教材都不會有補充。但那樣一開啟就看不到這次改版最重要的功能，
 * 客戶得自己先掛一個才看得到。
 *
 * 交接後要拿掉很簡單：App.tsx 不要呼叫 seedDemo 就好，其餘一行都不必動。
 */

const popupsFor = (rowId: string | null): PopupItem[] => [
  {
    id: 'demo-pop-1',
    kind: 'text',
    title: '什麼是總督府？',
    body: '臺灣總督府是日治時期的最高統治機關，設於臺北，現在是總統府。',
  },
  {
    id: 'demo-pop-2',
    kind: 'web',
    title: '國家文化記憶庫',
    url: 'https://memory.culture.tw/',
    embeddable: false,
  },
  ...(rowId
    ? [{ id: 'demo-pop-3', kind: 'jump' as const, title: '看交通建設那一段', targetRowId: rowId }]
    : []),
];

export function seedDemo(doc: Doc): Doc {
  // 掛在第一段內文上——它在第一頁，開啟就看得到角標
  let target: string | null = null;
  for (const { block } of walkBlocks(doc)) {
    if (block.type === 'text' && (block as TextBlock).role === 'body' && canHavePopup(block.type)) {
      target = block.id;
      break;
    }
  }
  if (!target) return doc;

  // 「跳到某一段」指向後面的某個大標，跳過去才看得出效果
  const jumpTo =
    doc.rows.find((r) =>
      r.columns.some((c) =>
        c.blocks.some((b) => b.type === 'text' && b.role === 'sectionTitle')
      )
    )?.id ?? null;

  const popups = popupsFor(jumpTo);

  return {
    ...doc,
    rows: doc.rows.map((row) => ({
      ...row,
      columns: row.columns.map((col) => ({
        ...col,
        blocks: col.blocks.map((b) => (b.id === target ? { ...b, popups } : b)),
      })),
    })),
  };
}
