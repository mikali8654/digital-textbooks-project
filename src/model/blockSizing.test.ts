import { describe, expect, it } from 'vitest';
import { blockBox, tableOverflow } from './blockSizing';
import { newId } from './ids';
import type { ImageBlock, TableBlock, TextBlock } from './types';

const image = (aspectRatio = 1.5): ImageBlock => ({
  id: newId('blk'), type: 'image', assetId: null, alt: '', caption: '',
  aspectRatio, popups: [],
});
const table = (): TableBlock => ({
  id: newId('blk'), type: 'table', rows: 3, cols: 3,
  cells: [], hasHeader: true, popups: [],
});

const CTX = { inlineSize: 896, maxBlockSize: 640, vertical: false };

describe('區塊尺寸是量測與渲染的唯一來源', () => {
  it('文字不走這裡——它的高度只有瀏覽器排一次才知道', () => {
    const text: TextBlock = {
      id: newId('blk'), type: 'text', role: 'body', popups: [], spans: [{ text: 'x' }],
    };
    expect(blockBox(text, CTX)).toBeNull();
  });

  it('圖片永遠放得進一頁', () => {
    for (const ratio of [0.4, 1, 1.5, 3]) {
      const box = blockBox(image(ratio), CTX)!;
      expect(box.blockSize).toBeLessThanOrEqual(CTX.maxBlockSize);
      expect(box.inlineSize).toBeLessThanOrEqual(CTX.inlineSize);
    }
  });

  it('很高的圖會被等比縮小，不會變形', () => {
    const ratio = 0.5; // 高的直式圖
    const box = blockBox(image(ratio), CTX)!;
    expect(box.inlineSize / box.blockSize).toBeCloseTo(ratio, 5);
  });

  it('直排時 block 軸是水平的，尺寸規則跟著換軸', () => {
    const v = { inlineSize: 640, maxBlockSize: 896, vertical: true };
    const box = blockBox(image(1.5), v)!;
    // 直排：吃滿欄「高」，寬度由比例決定
    expect(box.blockSize).toBeLessThanOrEqual(v.maxBlockSize);
    expect(box.inlineSize).toBeLessThanOrEqual(v.inlineSize);
  });

  it('盒狀模組比一頁大時縮到放得進去', () => {
    const tiny = { ...CTX, maxBlockSize: 100 };
    expect(blockBox(table(), tiny)!.blockSize).toBeLessThanOrEqual(100);
  });

  it('一張圖不會佔掉整頁——老師還要能圖文混排', () => {
    const box = blockBox(image(1.5), CTX)!;
    expect(box.blockSize).toBeLessThanOrEqual(CTX.maxBlockSize * 0.5);
    // 縮小之後仍然等比，不變形
    expect(box.inlineSize / box.blockSize).toBeCloseTo(1.5, 5);
  });

  it('老師縮過的圖用他設的比例', () => {
    const half = { ...image(1.5), widthPct: 50 };
    const box = blockBox(half, CTX)!;
    expect(box.inlineSize).toBe(CTX.inlineSize / 2);
  });
});

describe('沒設定尺寸不等於滿版', () => {
  const ctx = { inlineSize: 896, maxBlockSize: 640, vertical: false };
  const img = (widthPct?: number): ImageBlock => ({
    id: 'b', type: 'image', assetId: null, alt: '', caption: '',
    aspectRatio: 1.5, widthPct, popups: [],
  });

  it('沒設定時會縮到不超過頁面的 45%', () => {
    // 否則 4:3 的頁面插一張 3:2 的圖就用掉整頁，老師沒辦法圖文混排
    const box = blockBox(img(), ctx)!;
    expect(box.blockSize).toBeLessThanOrEqual(ctx.maxBlockSize * 0.45 + 0.5);
    expect(box.inlineSize).toBeLessThan(ctx.inlineSize);
  });

  it('選了滿版就真的滿版，不再受那個上限約束', () => {
    // 膠囊上亮著「滿版」而畫出來是縮過的，就是介面在說謊
    const box = blockBox(img(100), ctx)!;
    expect(Math.round(box.inlineSize)).toBe(ctx.inlineSize);
    expect(box.blockSize).toBeGreaterThan(ctx.maxBlockSize * 0.45);
  });

  it('選過的尺寸就是實際佔的比例', () => {
    for (const pct of [35, 50, 70]) {
      const box = blockBox(img(pct), ctx)!;
      expect(Math.round((box.inlineSize / ctx.inlineSize) * 100)).toBe(pct);
    }
  });
});

describe('比一頁還高的表格', () => {
  const ctx = { inlineSize: 896, maxBlockSize: 640, vertical: false };
  const table = (rows: number): TableBlock => ({
    id: 't', type: 'table', rows, cols: 2,
    cells: Array.from({ length: rows }, (_, i) => [String(i), 'x']),
    hasHeader: true, popups: [],
  });

  it('放得下就不回報', () => {
    // 社會第一張表是 11 列
    expect(tableOverflow(table(11), ctx)).toBeNull();
  });

  it('放不下要說出來，不能靜靜切掉', () => {
    // 資料表格少了幾列而沒人發現，學生看到的就是一份缺資料的課本
    const over = tableOverflow(table(25), ctx)!;
    expect(over).not.toBeNull();
    expect(over.shown + over.hidden).toBe(25);
    expect(over.hidden).toBeGreaterThan(0);
  });

  it('提示自己也要有位置，所以顯示的列數比裝得下的少一列', () => {
    const fits = Math.floor((ctx.maxBlockSize - 32) / 36);
    expect(tableOverflow(table(fits + 1), ctx)!.shown).toBe(fits - 1);
  });

  it('至少留一列，不會變成空表', () => {
    expect(tableOverflow(table(99), { ...ctx, maxBlockSize: 60 })!.shown).toBeGreaterThanOrEqual(1);
  });

  it('直排看的是另一軸', () => {
    // 直排時表格的列數吃的是 inline 軸（垂直），不是 block 軸
    const v = { inlineSize: 200, maxBlockSize: 896, vertical: true };
    expect(tableOverflow(table(11), v)).not.toBeNull();
  });
});
