import { beforeEach, describe, expect, it } from 'vitest';
import { paginate, pageOptionsFor } from './paginate';
import { makeRow, makeText, textOf } from './document';
import { resetIds } from './ids';
import { fakeMeasurer, linesOfText } from './testing';
import { applyAction } from './reducer';
import { emptyDoc } from './document';
import type { TextBlock } from './types';

const OPTS = pageOptionsFor({ writingMode: 'horizontal' }, { width: 800, height: 400 }, 16);

beforeEach(resetIds);

describe('被切開的文字要記住自己在原文的位置', () => {
  it('沒被切開的列不帶 slice', () => {
    const pages = paginate([makeRow([makeText('短短一行')])], OPTS, fakeMeasurer);
    expect(pages[0].items[0].textSlice).toBeUndefined();
  });

  it('切開的前後兩半各自記住起訖，接起來剛好是原文', () => {
    const original = linesOfText(30);
    const pages = paginate([makeRow([makeText(original)])], OPTS, fakeMeasurer);
    const items = pages.flatMap((p) => p.items);
    expect(items.length).toBeGreaterThan(1);

    let cursor = 0;
    for (const item of items) {
      const block = item.row.columns[0].blocks[0] as TextBlock;
      expect(item.textSlice).toBeDefined();
      expect(item.textSlice!.start).toBe(cursor);
      expect(original.slice(item.textSlice!.start, item.textSlice!.end)).toBe(textOf(block));
      cursor = item.textSlice!.end;
    }
    expect(cursor).toBe(original.length);
  });

  it('編輯其中一半不會弄丟另一半', () => {
    const original = linesOfText(30);
    const t = makeText(original);
    let doc = { ...emptyDoc(), rows: [makeRow([t])] };

    const pages = paginate(doc.rows, OPTS, fakeMeasurer);
    const head = pages[0].items.at(-1)!;
    const slice = head.textSlice!;

    // 模擬在第一頁那一半的結尾打了三個字
    const fragment = original.slice(slice.start, slice.end) + '新增字';
    const next = original.slice(0, slice.start) + fragment + original.slice(slice.end);
    doc = applyAction(doc, { type: 'setText', blockId: t.id, text: next });

    const after = textOf(doc.rows[0].columns[0].blocks[0] as TextBlock);
    // 原文一個字都沒少，只是中間多了三個字
    expect(after.length).toBe(original.length + 3);
    expect(after.endsWith(original.slice(slice.end))).toBe(true);
  });
});
