import { describe, expect, it } from 'vitest';
import { COLUMN_GAP, PAGE_PADDING, PAGE_SIZE, contentBox } from './pageSize';
import { pageOptionsFor, paginate } from './paginate';
import { makeRow, makeText } from './document';
import { fakeMeasurer, linesOfText } from './testing';

describe('頁面尺寸與螢幕無關', () => {
  it('內容區只由頁面比例決定', () => {
    const box = contentBox({ aspectRatio: '4:3' });
    expect(box.width).toBe(PAGE_SIZE['4:3'].width - PAGE_PADDING * 2);
    expect(box.height).toBe(PAGE_SIZE['4:3'].height - PAGE_PADDING * 2);
  });

  it('4:3 比 16:9 高，所以同樣的內容頁數比較少', () => {
    const rows = Array.from({ length: 12 }, () => makeRow([makeText(linesOfText(6))]));
    const at = (ratio: '4:3' | '16:9') =>
      paginate(
        rows,
        pageOptionsFor({ writingMode: 'horizontal' }, contentBox({ aspectRatio: ratio }), COLUMN_GAP),
        fakeMeasurer
      ).length;
    expect(at('4:3')).toBeLessThanOrEqual(at('16:9'));
  });

  it('分頁的輸入裡沒有任何螢幕尺寸——這是「老師的第 76 頁＝學生的第 76 頁」的保證', () => {
    // pageOptionsFor 只吃書寫方向與頁面尺寸，contentBox 只吃頁面比例。
    // 兩者都不接受視窗寬度，所以同一份文件在任何裝置上分頁結果都相同。
    const opts = pageOptionsFor(
      { writingMode: 'horizontal' },
      contentBox({ aspectRatio: '4:3' }),
      COLUMN_GAP
    );
    expect(Object.keys(opts).sort()).toEqual([
      'columnGap',
      'contentBlockSize',
      'contentInlineSize',
    ]);
    expect(opts.contentBlockSize).toBe(PAGE_SIZE['4:3'].height - PAGE_PADDING * 2);
  });

  it('同一份文件重複分頁結果完全一致', () => {
    const rows = Array.from({ length: 20 }, (_, i) =>
      makeRow([makeText(`第${i}段` + linesOfText(4))])
    );
    const opts = pageOptionsFor(
      { writingMode: 'horizontal' },
      contentBox({ aspectRatio: '4:3' }),
      COLUMN_GAP
    );
    const a = paginate(rows, opts, fakeMeasurer);
    const b = paginate(rows, opts, fakeMeasurer);
    expect(b.map((p) => p.items.map((i) => i.row.id))).toEqual(
      a.map((p) => p.items.map((i) => i.row.id))
    );
  });
});
