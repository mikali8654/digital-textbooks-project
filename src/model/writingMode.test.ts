import { beforeEach, describe, expect, it } from 'vitest';
import { pageOptionsFor, paginate } from './paginate';
import { makeRow, makeText } from './document';
import { resetIds } from './ids';
import { fakeMeasurer, linesOfText } from './testing';

/** 一頁的實體尺寸：4:3 橫置。 */
const PAGE = { width: 800, height: 600 };
const GAP = 16;

beforeEach(resetIds);

describe('書寫方向', () => {
  it('橫排消耗的是高度', () => {
    const o = pageOptionsFor({ writingMode: 'horizontal' }, PAGE, GAP);
    expect(o.contentBlockSize).toBe(PAGE.height);
    expect(o.contentInlineSize).toBe(PAGE.width);
  });

  it('直排消耗的是寬度——內容由右往左流', () => {
    const o = pageOptionsFor({ writingMode: 'vertical' }, PAGE, GAP);
    expect(o.contentBlockSize).toBe(PAGE.width);
    expect(o.contentInlineSize).toBe(PAGE.height);
  });

  it('同一份內容在兩種方向下的分頁結果不同', () => {
    // 4:3 的頁：直排可用的 block 尺寸（寬 800）比橫排（高 600）多，
    // 所以同樣的內容在直排下頁數會比較少。
    const rows = Array.from({ length: 5 }, () => makeRow([makeText(linesOfText(4))]));
    const h = paginate(rows, pageOptionsFor({ writingMode: 'horizontal' }, PAGE, GAP), fakeMeasurer);
    const v = paginate(rows, pageOptionsFor({ writingMode: 'vertical' }, PAGE, GAP), fakeMeasurer);
    expect(v.length).toBeLessThan(h.length);
  });

  it('引擎本身不知道有直排這回事——換方向只是換 PageOptions', () => {
    const rows = [makeRow([makeText('星星的世界', 'h1')]), makeRow([makeText(linesOfText(2))])];
    const square = { width: 600, height: 600 };
    const h = paginate(rows, pageOptionsFor({ writingMode: 'horizontal' }, square, GAP), fakeMeasurer);
    const v = paginate(rows, pageOptionsFor({ writingMode: 'vertical' }, square, GAP), fakeMeasurer);
    // 正方形的頁，兩種方向的可用量相同，結果就應該完全一致
    expect(v.map((p) => p.items.length)).toEqual(h.map((p) => p.items.length));
    expect(v.map((p) => p.usedBlockSize)).toEqual(h.map((p) => p.usedBlockSize));
  });

  it('手動換頁線在直排下同樣不隨內容移動', () => {
    const marked = makeRow([makeText('固定在這裡', 'body')], true);
    const o = pageOptionsFor({ writingMode: 'vertical' }, PAGE, GAP);
    const pages = paginate([makeRow([makeText('短', 'body')]), marked], o, fakeMeasurer);
    expect(pages).toHaveLength(2);
    expect(pages[1].startedBy).toBe('manual');
    expect(pages[1].items[0].row.id).toBe(marked.id);
  });
});
