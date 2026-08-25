import type { Measurer } from '../model/paginate';
import type { Block, TextBlock } from '../model/types';
import { spansToHtml } from '../model/inlineDom';

/**
 * 量測快取。
 *
 * 一課一萬字約 30 到 40 頁。每按一個鍵就把整份文件重新量一次，
 * 會卡到不能打字——量測要跑瀏覽器排版，那是最貴的一步。
 *
 * 但打字時實際改變的只有一個區塊。快取讓其餘幾百個區塊直接命中，
 * 於是每次按鍵只重量一個東西。這就是「增量重排」的實作：
 * 不是聰明地判斷哪些頁要重算，而是讓重算本身變得便宜。
 */

/** 區塊內容的指紋。內容沒變就不必重量。 */
function fingerprint(block: Block): string {
  switch (block.type) {
    // 用畫出來的 HTML 而不是純文字：注音會撐高行高、注釋號會佔位置，
    // 只比對文字的話，替一個詞加上注音之後會拿到舊的（偏矮的）高度
    case 'text':
      return `${block.role} ${spansToHtml((block as TextBlock).spans)}`;
    // 比例與寬度都會改變圖片佔的空間。少了它們，老師把圖從滿版改成
    // 「小」之後量測仍然回舊高度，那一頁就會被撐破
    case 'image':
      return `${block.assetId} ${block.aspectRatio} ${block.widthPct ?? ''} ${block.caption}`;
    case 'table':
      return `${block.rows}x${block.cols} ${block.cells.flat().join('')}`;
    case 'question':
      return `${block.stem.map((s) => s.text).join('')} ${block.options.length}`;
    default:
      return block.id;
  }
}

export type CacheStats = { hits: number; misses: number };

export type CachedMeasurer = Measurer & {
  stats: CacheStats;
  /** 設定改變（換書寫方向、換字級檔位）時要整個丟掉。 */
  clear(): void;
  size(): number;
};

/** 上限只是避免長時間編輯無限成長，正常一課用不到。 */
const MAX_ENTRIES = 4000;

export function withCache(inner: Measurer): CachedMeasurer {
  const sizes = new Map<string, number>();
  const lines = new Map<string, number[]>();
  const stats: CacheStats = { hits: 0, misses: 0 };

  const trim = (m: Map<string, unknown>) => {
    if (m.size <= MAX_ENTRIES) return;
    // 最早放進去的先丟。Map 保證插入順序。
    const excess = m.size - MAX_ENTRIES;
    let i = 0;
    for (const k of m.keys()) {
      m.delete(k);
      if (++i >= excess) break;
    }
  };

  return {
    stats,

    blockSize(block: Block, inlineSize: number, maxBlockSize: number): number {
      const key = `${fingerprint(block)}|${inlineSize}|${maxBlockSize}`;
      const hit = sizes.get(key);
      if (hit !== undefined) {
        stats.hits += 1;
        return hit;
      }
      stats.misses += 1;
      const value = inner.blockSize(block, inlineSize, maxBlockSize);
      sizes.set(key, value);
      trim(sizes);
      return value;
    },

    textLineSizes(block: TextBlock, inlineSize: number): number[] {
      const key = `${fingerprint(block)}|${inlineSize}`;
      const hit = lines.get(key);
      if (hit !== undefined) {
        stats.hits += 1;
        return hit;
      }
      stats.misses += 1;
      const value = inner.textLineSizes(block, inlineSize);
      lines.set(key, value);
      trim(lines);
      return value;
    },

    clear() {
      sizes.clear();
      lines.clear();
      stats.hits = 0;
      stats.misses = 0;
    },

    size() {
      return sizes.size + lines.size;
    },
  };
}
