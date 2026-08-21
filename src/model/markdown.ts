import { makeRow, makeText } from './document';
import type { Row, TextRole } from './types';

/**
 * md 匯入。
 *
 * 只吃純文字——圖片、影音、注音都不隨 md 進來，那些是老師匯入之後
 * 自己插入的。匯入文字與後續的圖片編排是前後兩件事，這個切法讓 md
 * 只負責它做得到的事。
 */

const HEADING: Record<number, TextRole> = { 1: 'h1', 2: 'h2', 3: 'h3' };

export type ImportOptions = {
  /**
   * 自動切頁：在每個大標與中標前面各放一條換頁線。
   * 這只是起手式，之後放在哪裡完全由使用者決定。
   */
  autoPageBreak: boolean;
};

export function parseMarkdown(md: string, opts: ImportOptions): Row[] {
  const rows: Row[] = [];
  // 空行分段；段落內的換行視為同一段
  const chunks = md.replace(/\r\n?/g, '\n').split(/\n{2,}/);

  for (const raw of chunks) {
    const chunk = raw.trim();
    if (!chunk) continue;

    const heading = /^(#{1,3})\s+(.*)$/.exec(chunk);
    if (heading) {
      const level = heading[1].length;
      const role = HEADING[level];
      const breakBefore = opts.autoPageBreak && (role === 'h1' || role === 'h2');
      rows.push(makeRow([makeText(heading[2].trim(), role)], breakBefore));
      continue;
    }

    if (chunk.startsWith('>')) {
      const body = chunk
        .split('\n')
        .map((l) => l.replace(/^>\s?/, ''))
        .join('');
      rows.push(makeRow([makeText(body, 'annotation')]));
      continue;
    }

    // 其餘一律視為內文，段落內的換行併成一段
    rows.push(makeRow([makeText(chunk.split('\n').join(''), 'body')]));
  }

  // 第一頁不需要換頁線
  if (rows.length > 0) rows[0] = { ...rows[0], breakBefore: false };
  return rows;
}
