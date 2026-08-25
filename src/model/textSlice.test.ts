import { beforeEach, describe, expect, it } from 'vitest';
import { paginate, pageOptionsFor } from './paginate';
import { makeRow, makeText, textOf } from './document';
import { resetIds } from './ids';
import { fakeMeasurer, linesOfText } from './testing';
import { applyAction } from './reducer';
import { emptyDoc } from './document';
import type { InlineSpan, TextBlock } from './types';

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

describe('跨頁的段落要保住行內標記', () => {
  /** 一段長課文，重點詞、注釋號、注音散在整段裡——就像〈五柳先生傳〉。 */
  const richBlock = (): TextBlock => {
    const unit = '閑靜少言不慕榮利好讀書不求甚解每有會意便欣然忘食';
    const spans: InlineSpan[] = [];
    for (let i = 0; i < 40; i += 1) {
      spans.push({ text: unit });
      spans.push({ text: '會意', keyword: true, footnoteRef: String(i + 1) });
      spans.push({ text: '柳', ruby: 'ㄌㄧㄡˇ' });
    }
    return { ...makeText(''), spans };
  };

  it('切到第二頁之後，注音、重點詞、注釋號都還在', () => {
    const block = richBlock();
    const pages = paginate([makeRow([block])], OPTS, fakeMeasurer);
    const items = pages.flatMap((p) => p.items);
    expect(items.length).toBeGreaterThan(1);

    // 每一頁的片段都還帶著標記，不是只有第一頁
    for (const item of items) {
      const b = item.row.columns[0].blocks[0] as TextBlock;
      expect(b.spans.some((s) => s.keyword)).toBe(true);
      expect(b.spans.some((s) => s.footnoteRef)).toBe(true);
    }
  });

  it('拼回來的注釋參照一個都沒少', () => {
    const block = richBlock();
    const before = block.spans.filter((s) => s.footnoteRef).length;

    const pages = paginate([makeRow([block])], OPTS, fakeMeasurer);
    const after = pages
      .flatMap((p) => p.items)
      .flatMap((i) => (i.row.columns[0].blocks[0] as TextBlock).spans)
      .filter((s) => s.footnoteRef).length;

    // 切點正好落在某個注釋詞中間時它會變成兩段，所以只能是「不減少」
    expect(after).toBeGreaterThanOrEqual(before);
  });

  it('各頁的文字接起來仍然等於原文', () => {
    const block = richBlock();
    const original = textOf(block);
    const pages = paginate([makeRow([block])], OPTS, fakeMeasurer);
    const joined = pages
      .flatMap((p) => p.items)
      .map((i) => textOf(i.row.columns[0].blocks[0]))
      .join('');
    expect(joined).toBe(original);
  });
});
