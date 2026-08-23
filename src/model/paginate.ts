import { isSplittable } from './registry';
import { gapBefore } from './spacing';
import type { Block, DocSettings, Row, TextBlock } from './types';

/**
 * 把內容流切成頁。
 *
 * 這是整個系統的核心：頁不儲存在資料裡，是這個函式算出來的。
 *
 * 尺寸一律用「邏輯軸」而不是寬高，因為直排的內容是由右往左流的——
 * 一頁填滿與否，直排量的是寬度，橫排量的是高度。用寬高命名會把
 * 「橫排」的假設寫進引擎裡。
 *
 *   inline：文字行進的方向（橫排＝寬，直排＝高）
 *   block ：內容堆疊、分頁消耗的方向（橫排＝高，直排＝寬）
 *
 * 演算法對兩種書寫方向完全相同，差別只在 pageOptionsFor() 的映射。
 */

export type Measurer = {
  /**
   * 區塊在給定 inline 尺寸下佔的 block 尺寸。
   * maxBlockSize 是一整頁的可用量——盒狀模組比一頁還大時，
   * 實作要等比縮到放得進去。
   */
  blockSize(block: Block, inlineSize: number, maxBlockSize: number): number;
  /** 可切開的文字：每一行佔的 block 尺寸。引擎只在行邊界切開。 */
  textLineSizes(block: TextBlock, inlineSize: number): number[];
};

export type PageOptions = {
  /** 頁面內容區的尺寸（已扣掉頁面留白）。 */
  contentInlineSize: number;
  contentBlockSize: number;
  /** 欄與欄之間的溝寬，量在 inline 軸上。 */
  columnGap: number;
};

/**
 * 把實體的頁面尺寸依書寫方向映射成邏輯軸。
 * 整個引擎對 writingMode 的相依只有這一個函式，其餘都不知道有直排這回事。
 */
export function pageOptionsFor(
  settings: Pick<DocSettings, 'writingMode'>,
  page: { width: number; height: number },
  columnGap: number
): PageOptions {
  const vertical = settings.writingMode === 'vertical';
  return {
    contentInlineSize: vertical ? page.height : page.width,
    contentBlockSize: vertical ? page.width : page.height,
    columnGap,
  };
}

export type PageItem = {
  row: Row;
  /** 這一列前緣要留的間距。每頁第一列一律為 0。 */
  gapBefore: number;
  blockSize: number;
  /** 這一列是從上一頁接續下來的。 */
  continuedFromPrev: boolean;
  /** 這一列還沒結束，下一頁繼續——畫面要顯示接續記號。 */
  continuesOnNext: boolean;
  /**
   * 被切開的文字在原始內容裡的位置。
   *
   * 沒有這個，編輯一段被切成兩頁的課文時就會把另一半弄丟——
   * 畫面上只看得到前半，存回去就變成只剩前半。
   * 有了它，編輯器可以把改過的片段接回原文的正確位置。
   */
  textSlice?: { start: number; end: number };
};

export type Page = {
  index: number;
  items: PageItem[];
  /** 這一頁是怎麼開始的。manual 的換頁線不隨內容移動，auto 的會。 */
  startedBy: 'first' | 'manual' | 'auto';
  /** 已用的 block 尺寸。剩下的就是留白——那是使用者選擇的結果，不是錯誤。 */
  usedBlockSize: number;
};

const columnInlineSizes = (row: Row, o: PageOptions): number[] => {
  const gaps = o.columnGap * (row.columns.length - 1);
  const usable = o.contentInlineSize - gaps;
  return row.columns.map((c) => (usable * c.widthPct) / 100);
};

/** 一列佔的 block 尺寸＝最長的那一欄。 */
function rowBlockSize(row: Row, o: PageOptions, m: Measurer): number {
  const sizes = columnInlineSizes(row, o);
  return Math.max(
    0,
    ...row.columns.map((col, i) =>
      col.blocks.reduce(
        (sum, b) => sum + m.blockSize(b, sizes[i], o.contentBlockSize),
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
): { head: Row; headBlockSize: number; tail: Row; cut: number } | null {
  const inlineSize = columnInlineSizes(row, o)[0];
  const lines = m.textLineSizes(block, inlineSize);
  if (lines.length < 2) return null;

  let used = 0;
  let fitCount = 0;
  for (const size of lines) {
    if (used + size > available) break;
    used += size;
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
    headBlockSize: used,
    // 後半保留同一個 row / block id：切開之後仍然是同一個元件
    tail: { ...row, breakBefore: false, columns: [{ ...row.columns[0], blocks: [tailBlock] }] },
    cut,
  };
}

export function paginate(rows: Row[], o: PageOptions, m: Measurer): Page[] {
  const pages: Page[] = [];
  let items: PageItem[] = [];
  let used = 0;
  let startedBy: Page['startedBy'] = 'first';

  const flush = (nextStartedBy: Page['startedBy']) => {
    pages.push({ index: pages.length, items, startedBy, usedBlockSize: used });
    items = [];
    used = 0;
    startedBy = nextStartedBy;
  };

  // 佇列可能在切開文字時被塞回剩餘的後半
  // offset＝這個片段的第一個字在原始內容裡的位置。整列沒被切開時是 0。
  const queue: { row: Row; continued: boolean; offset: number }[] = rows.map((row) => ({
    row,
    continued: false,
    offset: 0,
  }));

  /** 被切開的片段要記住它在原文的哪一段，編輯時才接得回去。 */
  const sliceOf = (row: Row, offset: number, split: boolean) => {
    if (offset === 0 && !split) return undefined;
    const text = splittableTextOf(row);
    if (!text) return undefined;
    const len = text.spans.map((s) => s.text).join('').length;
    return { start: offset, end: offset + len };
  };

  while (queue.length > 0) {
    const { row, continued, offset } = queue.shift()!;

    // 使用者放的換頁線：一定從新的一頁開始，位置不隨內容移動
    if (row.breakBefore && items.length > 0) flush('manual');

    const prevRow = items.length > 0 ? items[items.length - 1].row : null;
    const gap = items.length === 0 ? 0 : gapBefore(prevRow, row);
    const size = rowBlockSize(row, o, m);
    const available = o.contentBlockSize - used - gap;

    if (size <= available) {
      items.push({
        row,
        gapBefore: gap,
        blockSize: size,
        continuedFromPrev: continued,
        continuesOnNext: false,
        textSlice: sliceOf(row, offset, false),
      });
      used += gap + size;
      continue;
    }

    const text = splittableTextOf(row);
    if (text && available > 0) {
      const split = splitTextRow(row, text, available, o, m);
      if (split) {
        items.push({
          row: split.head,
          gapBefore: gap,
          blockSize: split.headBlockSize,
          continuedFromPrev: continued,
          continuesOnNext: true,
          textSlice: { start: offset, end: offset + split.cut },
        });
        used += gap + split.headBlockSize;
        flush('auto');
        queue.unshift({ row: split.tail, continued: true, offset: offset + split.cut });
        continue;
      }
    }

    // 放不下也切不開：整列移到下一頁
    if (items.length > 0) {
      flush('auto');
      queue.unshift({ row, continued, offset });
      continue;
    }

    // 已經是空白頁還放不下：接受溢出，獨佔一頁，避免無限迴圈
    items.push({
      row,
      gapBefore: 0,
      blockSize: size,
      continuedFromPrev: continued,
      continuesOnNext: false,
      textSlice: sliceOf(row, offset, false),
    });
    used += size;
  }

  flush('auto');
  return pages;
}
