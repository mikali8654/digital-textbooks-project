import { isSplittable } from './registry';
import { gapBefore } from './spacing';
import type { Block, Row, TextBlock } from './types';

/**
 * 把內容流切成頁。
 *
 * 這是整個系統的核心：頁不儲存在資料裡，是這個函式算出來的。
 * 量測交給外部注入，所以引擎本身沒有 DOM 相依，可以直接測。
 */

export type Measurer = {
  /**
   * 區塊在給定寬度下的高度。maxHeight 是一整頁的可用高度——
   * 圖片類比一頁還高時，實作要等比縮到放得進去。
   */
  blockHeight(block: Block, widthPx: number, maxHeightPx: number): number;
  /** 可切開的文字：每一行的高度。引擎只在行邊界切開，不會切到半行。 */
  textLines(block: TextBlock, widthPx: number): number[];
};

export type PageOptions = {
  /** 頁面內容區的寬高（已扣掉頁面留白）。 */
  contentWidth: number;
  contentHeight: number;
  /** 欄與欄之間的溝寬。 */
  columnGap: number;
};

export type PageItem = {
  row: Row;
  /** 這一列上緣要留的間距。每頁第一列一律為 0。 */
  gapBefore: number;
  height: number;
  /** 這一列是從上一頁接續下來的。 */
  continuedFromPrev: boolean;
  /** 這一列還沒結束，下一頁繼續——畫面要顯示接續記號。 */
  continuesOnNext: boolean;
};

export type Page = {
  index: number;
  items: PageItem[];
  /** 這一頁是怎麼開始的。manual 的換頁線不隨內容移動，auto 的會。 */
  startedBy: 'first' | 'manual' | 'auto';
  /** 已用高度。剩下的就是留白——那是使用者選擇的結果，不是錯誤。 */
  usedHeight: number;
};

const columnWidths = (row: Row, o: PageOptions): number[] => {
  const gaps = o.columnGap * (row.columns.length - 1);
  const usable = o.contentWidth - gaps;
  return row.columns.map((c) => (usable * c.widthPct) / 100);
};

/** 一列的高度＝最高的那一欄。 */
function rowHeight(row: Row, o: PageOptions, m: Measurer): number {
  const widths = columnWidths(row, o);
  return Math.max(
    0,
    ...row.columns.map((col, i) =>
      col.blocks.reduce(
        (sum, b) => sum + m.blockHeight(b, widths[i], o.contentHeight),
        0
      )
    )
  );
}

/** 只有「單欄、單一可切開區塊」的列能跨頁。其餘放不下就整列移到下一頁。 */
function splittableTextOf(row: Row): TextBlock | null {
  if (row.columns.length !== 1) return null;
  const blocks = row.columns[0].blocks;
  if (blocks.length !== 1) return null;
  const b = blocks[0];
  return b.type === 'text' && isSplittable(b.type) ? b : null;
}

/** 把文字列切成「放得下的前半」與「剩下的後半」，在行邊界切。 */
function splitTextRow(
  row: Row,
  block: TextBlock,
  available: number,
  o: PageOptions,
  m: Measurer
): { head: Row; headHeight: number; tail: Row } | null {
  const width = columnWidths(row, o)[0];
  const lines = m.textLines(block, width);
  if (lines.length < 2) return null;

  let used = 0;
  let fitCount = 0;
  for (const h of lines) {
    if (used + h > available) break;
    used += h;
    fitCount += 1;
  }
  // 至少要留一行在這一頁，也至少要留一行給下一頁，否則不算切開
  if (fitCount < 1 || fitCount >= lines.length) return null;

  const ratio = fitCount / lines.length;
  const plain = block.spans.map((s) => s.text).join('');
  const cut = Math.max(1, Math.round(plain.length * ratio));

  const headBlock: TextBlock = { ...block, spans: [{ text: plain.slice(0, cut) }] };
  const tailBlock: TextBlock = { ...block, spans: [{ text: plain.slice(cut) }] };

  return {
    head: { ...row, columns: [{ ...row.columns[0], blocks: [headBlock] }] },
    headHeight: used,
    // 後半保留同一個 row / block id：切開之後仍然是同一個元件
    tail: { ...row, breakBefore: false, columns: [{ ...row.columns[0], blocks: [tailBlock] }] },
  };
}

export function paginate(rows: Row[], o: PageOptions, m: Measurer): Page[] {
  const pages: Page[] = [];
  let items: PageItem[] = [];
  let used = 0;
  let startedBy: Page['startedBy'] = 'first';

  const flush = (nextStartedBy: Page['startedBy']) => {
    pages.push({ index: pages.length, items, startedBy, usedHeight: used });
    items = [];
    used = 0;
    startedBy = nextStartedBy;
  };

  // 佇列可能在切開文字時被塞回剩餘的後半
  const queue: { row: Row; continued: boolean }[] = rows.map((row) => ({
    row,
    continued: false,
  }));

  while (queue.length > 0) {
    const { row, continued } = queue.shift()!;

    // 使用者放的換頁線：一定從新的一頁開始，位置不隨內容移動
    if (row.breakBefore && items.length > 0) flush('manual');

    const prevRow = items.length > 0 ? items[items.length - 1].row : null;
    const gap = items.length === 0 ? 0 : gapBefore(prevRow, row);
    const h = rowHeight(row, o, m);
    const available = o.contentHeight - used - gap;

    if (h <= available) {
      items.push({
        row,
        gapBefore: gap,
        height: h,
        continuedFromPrev: continued,
        continuesOnNext: false,
      });
      used += gap + h;
      continue;
    }

    const text = splittableTextOf(row);
    if (text && available > 0) {
      const split = splitTextRow(row, text, available, o, m);
      if (split) {
        items.push({
          row: split.head,
          gapBefore: gap,
          height: split.headHeight,
          continuedFromPrev: continued,
          continuesOnNext: true,
        });
        used += gap + split.headHeight;
        flush('auto');
        queue.unshift({ row: split.tail, continued: true });
        continue;
      }
    }

    // 放不下也切不開：整列移到下一頁
    if (items.length > 0) {
      flush('auto');
      queue.unshift({ row, continued });
      continue;
    }

    // 已經是空白頁還放不下：接受溢出，獨佔一頁，避免無限迴圈
    items.push({
      row,
      gapBefore: 0,
      height: h,
      continuedFromPrev: continued,
      continuesOnNext: false,
    });
    used += h;
  }

  flush('auto');
  return pages;
}
