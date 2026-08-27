import { beforeEach, describe, expect, it } from 'vitest';
import { outlineOf, pageOfRow } from './outline';
import { emptyDoc, makeRow, makeText } from './document';
import { resetIds } from './ids';
import { applyAction } from './reducer';
import type { Doc, TextRole } from './types';

const docOf = (...specs: [string, TextRole][]): Doc => ({
  ...emptyDoc(),
  rows: specs.map(([t, r]) => makeRow([makeText(t, r)])),
});

beforeEach(resetIds);

describe('目次', () => {
  it('只收四層標題，內文不進去', () => {
    const doc = docOf(
      ['五柳先生傳', 'lessonTitle'],
      ['先生不知何許人也', 'body'],
      ['課文賞析', 'sectionTitle'],
      ['寫作背景', 'itemTitle'],
      ['補充說明', 'supplement']
    );
    expect(outlineOf(doc).map((i) => i.text)).toEqual(['五柳先生傳', '課文賞析', '寫作背景']);
  });

  it('層級由角色決定，不是由順序', () => {
    const doc = docOf(['甲', 'itemTitle'], ['乙', 'lessonTitle']);
    expect(outlineOf(doc).map((i) => i.depth)).toEqual([2, 0]);
  });

  it('空標題不進目次', () => {
    // 跳過去看到一片空白，比找不到還難理解
    const doc = docOf(['', 'sectionTitle'], ['  ', 'itemTitle'], ['有字', 'itemTitle']);
    expect(outlineOf(doc)).toHaveLength(1);
  });

  it('把標題改成內文，目次就少一條', () => {
    // 目次是算出來的不是存起來的，所以不會跟內容不一致
    const doc = docOf(['課文賞析', 'sectionTitle'], ['內文', 'body']);
    const blockId = doc.rows[0].columns[0].blocks[0].id;
    const after = applyAction(doc, { type: 'setTextRole', blockId, role: 'body' });
    expect(outlineOf(after)).toHaveLength(0);
  });

  it('記的是哪一列，不是第幾頁', () => {
    const doc = docOf(['課文賞析', 'sectionTitle']);
    expect(outlineOf(doc)[0].rowId).toBe(doc.rows[0].id);
  });
});

describe('某一列在第幾頁', () => {
  const pages = [
    { items: [{ row: { id: 'r1' } }, { row: { id: 'r2' } }] },
    { items: [{ row: { id: 'r3' } }] },
  ];

  it('找得到', () => {
    expect(pageOfRow(pages, 'r3')).toBe(1);
  });

  it('找不到回 -1，呼叫端才知道要不要動', () => {
    expect(pageOfRow(pages, 'nope')).toBe(-1);
  });
});
