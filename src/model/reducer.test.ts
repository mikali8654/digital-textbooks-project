import { beforeEach, describe, expect, it } from 'vitest';
import { applyAction } from './reducer';
import { emptyDoc, makeRow, makeText, textOf } from './document';
import { newId, resetIds } from './ids';
import type { Doc, ImageBlock, TextBlock, VideoBlock } from './types';

const image = (): ImageBlock => ({
  id: newId('blk'), type: 'image', assetId: null, alt: '', caption: '', aspectRatio: 1.5, popups: [],
});
const video = (): VideoBlock => ({
  id: newId('blk'), type: 'video', source: 'youtube', ref: 'abc', title: '', popups: [],
});

const docWith = (...rows: Doc['rows']): Doc => ({ ...emptyDoc(), rows });

beforeEach(resetIds);

describe('純度', () => {
  it('不會改到原本的文件', () => {
    const doc = docWith(makeRow([makeText('原文')]));
    const snapshot = JSON.stringify(doc);
    applyAction(doc, { type: 'setTitle', title: '改了' });
    expect(JSON.stringify(doc)).toBe(snapshot);
  });

  it('同樣的輸入得到同樣的輸出', () => {
    const doc = docWith(makeRow([makeText('原文')]));
    const a = applyAction(doc, { type: 'setSettings', patch: { aspectRatio: '16:9' } });
    const b = applyAction(doc, { type: 'setSettings', patch: { aspectRatio: '16:9' } });
    expect(a).toEqual(b);
  });
});

describe('拖曳重排', () => {
  it('插進兩列之間會自成一列、佔滿整寬', () => {
    const a = makeRow([makeText('A')]);
    const b = makeRow([makeText('B')]);
    const doc = docWith(a, b);
    const next = applyAction(doc, { type: 'moveRow', rowId: b.id, target: { mode: 'row', index: 0 } });
    expect(next.rows.map((r) => r.id)).toEqual([b.id, a.id]);
    expect(next.rows[0].columns).toHaveLength(1);
    expect(next.rows[0].columns[0].widthPct).toBe(100);
  });

  it('放到元件側邊會併成兩欄，寬度平均分配', () => {
    const a = makeRow([makeText('A')]);
    const b = makeRow([image()]);
    const doc = docWith(a, b);
    const next = applyAction(doc, {
      type: 'moveRow', rowId: b.id, target: { mode: 'column', rowId: a.id, side: 'right' },
    });
    expect(next.rows).toHaveLength(1);
    expect(next.rows[0].columns).toHaveLength(2);
    expect(next.rows[0].columns.map((c) => c.widthPct)).toEqual([50, 50]);
  });

  it('併欄之後不會留下空的列', () => {
    const a = makeRow([makeText('A')]);
    const b = makeRow([makeText('B')]);
    const next = applyAction(docWith(a, b), {
      type: 'moveRow', rowId: b.id, target: { mode: 'column', rowId: a.id, side: 'left' },
    });
    expect(next.rows).toHaveLength(1);
    expect(next.rows.every((r) => r.columns.every((c) => c.blocks.length > 0))).toBe(true);
  });

  it('欄寬永遠加總為 100', () => {
    const a = makeRow([makeText('A')]);
    const b = makeRow([makeText('B')]);
    const c = makeRow([makeText('C')]);
    let doc = docWith(a, b, c);
    doc = applyAction(doc, { type: 'moveRow', rowId: b.id, target: { mode: 'column', rowId: a.id, side: 'right' } });
    doc = applyAction(doc, { type: 'moveRow', rowId: c.id, target: { mode: 'column', rowId: a.id, side: 'right' } });
    const sum = doc.rows[0].columns.reduce((s, col) => s + col.widthPct, 0);
    expect(sum).toBeCloseTo(100);
    expect(doc.rows[0].columns).toHaveLength(3);
  });

  it('拖曳分隔線只改比例，欄數不變', () => {
    const a = makeRow([makeText('A')]);
    const b = makeRow([makeText('B')]);
    let doc = applyAction(docWith(a, b), {
      type: 'moveRow', rowId: b.id, target: { mode: 'column', rowId: a.id, side: 'right' },
    });
    const rowId = doc.rows[0].id;
    doc = applyAction(doc, { type: 'setColumnWidths', rowId, widths: [62, 38] });
    expect(doc.rows[0].columns.map((c) => Math.round(c.widthPct))).toEqual([62, 38]);
  });
});

describe('Pop-up 是屬性，不是元件', () => {
  it('影片不能掛 Pop-up——它本身就有互動', () => {
    const v = video();
    const doc = docWith(makeRow([v]));
    const next = applyAction(doc, {
      type: 'addPopup', blockId: v.id,
      item: { id: 'p1', kind: 'text', title: '補充', body: '內容' },
    });
    expect(next.rows[0].columns[0].blocks[0].popups).toHaveLength(0);
  });

  it('圖片可以掛多個，順序可以調整', () => {
    const img = image();
    let doc: Doc = docWith(makeRow([img]));
    for (const id of ['p1', 'p2', 'p3']) {
      doc = applyAction(doc, {
        type: 'addPopup', blockId: img.id,
        item: { id, kind: 'web', title: id, url: `https://example.com/${id}`, embeddable: false },
      });
    }
    expect(doc.rows[0].columns[0].blocks[0].popups.map((p) => p.id)).toEqual(['p1', 'p2', 'p3']);

    doc = applyAction(doc, { type: 'reorderPopups', blockId: img.id, from: 2, to: 0 });
    expect(doc.rows[0].columns[0].blocks[0].popups.map((p) => p.id)).toEqual(['p3', 'p1', 'p2']);
  });
});

describe('文字', () => {
  it('改角色不會動到內容', () => {
    const t = makeText('星星的世界');
    const doc = docWith(makeRow([t]));
    const next = applyAction(doc, { type: 'setTextRole', blockId: t.id, role: 'sectionTitle' });
    const block = next.rows[0].columns[0].blocks[0] as TextBlock;
    expect(block.role).toBe('sectionTitle');
    expect(textOf(block)).toBe('星星的世界');
  });
});

describe('併欄之後要拆得回來', () => {
  it('把一欄拖出去會變成獨立的一列', () => {
    const a = makeRow([makeText('A')]);
    const b = makeRow([makeText('B')]);
    // 先併成兩欄
    let doc = applyAction(docWith(a, b), {
      type: 'moveRow', rowId: b.id, target: { mode: 'column', rowId: a.id, side: 'right' },
    });
    expect(doc.rows).toHaveLength(1);
    expect(doc.rows[0].columns).toHaveLength(2);

    // 再把第二欄拆出來放到最前面
    const rowId = doc.rows[0].id;
    const colId = doc.rows[0].columns[1].id;
    doc = applyAction(doc, {
      type: 'moveColumn', rowId, columnId: colId, target: { mode: 'row', index: 0 },
    });
    expect(doc.rows).toHaveLength(2);
    expect(doc.rows.every((r) => r.columns.length === 1)).toBe(true);
    expect(doc.rows[0].columns[0].widthPct).toBe(100);
  });

  it('剩下的那一欄會回復成滿寬', () => {
    const a = makeRow([makeText('A')]);
    const b = makeRow([makeText('B')]);
    let doc = applyAction(docWith(a, b), {
      type: 'moveRow', rowId: b.id, target: { mode: 'column', rowId: a.id, side: 'right' },
    });
    const rowId = doc.rows[0].id;
    const colId = doc.rows[0].columns[0].id;
    doc = applyAction(doc, {
      type: 'moveColumn', rowId, columnId: colId, target: { mode: 'row', index: 1 },
    });
    const widths = doc.rows.flatMap((r) => r.columns.map((c) => c.widthPct));
    expect(widths).toEqual([100, 100]);
  });

  it('單欄的列不吃 moveColumn——那是 moveRow 的工作', () => {
    const a = makeRow([makeText('A')]);
    const doc = docWith(a);
    const next = applyAction(doc, {
      type: 'moveColumn', rowId: a.id, columnId: a.columns[0].id, target: { mode: 'row', index: 0 },
    });
    expect(next).toBe(doc);
  });
});
