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

  it('一張圖不會獨佔整頁——要留空間給圖說與後續內容', () => {
    const box = blockBox(image(0.3), CTX)!;
    expect(box.blockSize).toBeLessThan(CTX.maxBlockSize);
  });
});
