import { HEADING_ROLES } from './types';
import { textOf } from './document';
import type { Doc, TextRole } from './types';

/**
 * 目次。
 *
 * 由內容的角色算出來，不另外存一份——老師把一段從「中標」改成「內文」，
 * 目次就該跟著少一條。存一份的話兩邊遲早不一致，而課本的目次不一致
 * 就是學生翻不到老師講的地方。
 *
 * 同理，這裡不記頁碼：頁是分頁算出來的，記下來就會過期。
 * 要知道在第幾頁是拿 rowId 去問目前的分頁結果。
 */

export type OutlineItem = {
  rowId: string;
  role: TextRole;
  /** 標題的縮排層級，0 是最外層。 */
  depth: number;
  text: string;
};

export function outlineOf(doc: Doc): OutlineItem[] {
  const items: OutlineItem[] = [];

  for (const row of doc.rows) {
    for (const col of row.columns) {
      for (const b of col.blocks) {
        if (b.type !== 'text') continue;
        const depth = HEADING_ROLES.indexOf(b.role);
        if (depth < 0) continue;

        const text = textOf(b).trim();
        // 空標題不進目次：跳過去看到一片空白比找不到還難理解
        if (!text) continue;

        items.push({ rowId: row.id, role: b.role, depth, text });
      }
    }
  }

  return items;
}

/** 某一列現在在第幾頁。頁是算出來的，所以每次都要重新問。 */
export function pageOfRow(pages: { items: { row: { id: string } }[] }[], rowId: string): number {
  return pages.findIndex((p) => p.items.some((i) => i.row.id === rowId));
}
