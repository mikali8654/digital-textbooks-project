import { describe, expect, it } from 'vitest';
import { blockBox } from './blockSizing';
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
