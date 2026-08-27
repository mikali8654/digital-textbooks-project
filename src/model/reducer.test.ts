import { beforeEach, describe, expect, it } from 'vitest';
import { applyAction } from './reducer';
import { emptyDoc, makeRow, makeText, textOf } from './document';
import { parseMarkdown } from './markdown';
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

describe('行內標記', () => {
  const richRow = () => {
    const b: TextBlock = {
      id: newId('blk'),
      type: 'text',
      role: 'body',
      popups: [],
      spans: [
        { text: '先生不知' },
        { text: '何許', keyword: true, footnoteRef: '1' },
        { text: '人也' },
      ],
    };
    return { row: makeRow([b]), id: b.id };
  };

  it('setSpans 換掉整段，注釋參照跟著新內容走', () => {
    const { row, id } = richRow();
    const next = applyAction(docWith(row), {
      type: 'setSpans',
      blockId: id,
      spans: [{ text: '甲' }, { text: '乙', footnoteRef: '2' }],
    });
    const b = next.rows[0].columns[0].blocks[0] as TextBlock;
    expect(b.spans).toEqual([{ text: '甲' }, { text: '乙', footnoteRef: '2' }]);
  });

  it('setSpans 會把碎掉的相同標記併回去', () => {
    const { row, id } = richRow();
    const next = applyAction(docWith(row), {
      type: 'setSpans',
      blockId: id,
      spans: [{ text: '一' }, { text: '二' }, { text: '三' }],
    });
    expect((next.rows[0].columns[0].blocks[0] as TextBlock).spans).toEqual([{ text: '一二三' }]);
  });

  it('toggleMark 只標到選的那幾個字', () => {
    const { row, id } = richRow();
    const next = applyAction(docWith(row), {
      type: 'toggleMark', blockId: id, start: 0, end: 2, mark: 'keyword', on: true,
    });
    const spans = (next.rows[0].columns[0].blocks[0] as TextBlock).spans;
    expect(spans[0]).toEqual({ text: '先生', keyword: true });
    expect(spans[1]).toEqual({ text: '不知' });
    // 原本就有的重點詞與注釋號沒被動到
    expect(spans.find((s) => s.footnoteRef)).toMatchObject({ text: '何許', keyword: true });
  });

  it('toggleMark 取消標記不會連注釋參照一起拿掉', () => {
    const { row, id } = richRow();
    const next = applyAction(docWith(row), {
      type: 'toggleMark', blockId: id, start: 4, end: 6, mark: 'keyword', on: false,
    });
    const spans = (next.rows[0].columns[0].blocks[0] as TextBlock).spans;
    const fn = spans.find((s) => s.footnoteRef)!;
    expect(fn.footnoteRef).toBe('1');
    expect(fn.keyword).toBeUndefined();
  });

  it('空的範圍什麼都不做，不佔一次復原', () => {
    const { row, id } = richRow();
    const doc = docWith(row);
    expect(
      applyAction(doc, { type: 'toggleMark', blockId: id, start: 3, end: 3, mark: 'bold', on: true })
    ).toBe(doc);
  });

  it('文字內容不受行內標記影響', () => {
    const { row, id } = richRow();
    const next = applyAction(docWith(row), {
      type: 'toggleMark', blockId: id, start: 1, end: 5, mark: 'bold', on: true,
    });
    expect(textOf(next.rows[0].columns[0].blocks[0])).toBe('先生不知何許人也');
  });
});

describe('patchBlock', () => {
  it('改得動圖說', () => {
    const img = image();
    const next = applyAction(docWith(makeRow([img])), {
      type: 'patchBlock', blockId: img.id, blockType: 'image', patch: { caption: '圖 4-1 嘉南大圳' },
    });
    expect((next.rows[0].columns[0].blocks[0] as ImageBlock).caption).toBe('圖 4-1 嘉南大圳');
  });

  it('上傳圖片時比例與 assetId 一起換掉', () => {
    const img = image();
    const next = applyAction(docWith(makeRow([img])), {
      type: 'patchBlock', blockId: img.id, blockType: 'image',
      patch: { assetId: 'asset-1', aspectRatio: 16 / 9 },
    });
    const b = next.rows[0].columns[0].blocks[0] as ImageBlock;
    expect(b.assetId).toBe('asset-1');
    expect(b.aspectRatio).toBeCloseTo(16 / 9);
  });

  it('型別對不上就整個不動——舊的 id 不會把網址蓋到影片上', () => {
    const v = video();
    const doc = docWith(makeRow([v]));
    const next = applyAction(doc, {
      type: 'patchBlock', blockId: v.id, blockType: 'image', patch: { caption: '不該進來' },
    });
    expect(next.rows[0].columns[0].blocks[0]).toEqual(v);
  });
});

describe('補充的排序', () => {
  const withPopups = () => {
    const img = image();
    let doc = docWith(makeRow([img]));
    for (const id of ['p1', 'p2', 'p3']) {
      doc = applyAction(doc, {
        type: 'addPopup', blockId: img.id, item: { id, kind: 'text', title: id, body: 'x' },
      });
    }
    return { doc, id: img.id };
  };
  const order = (d: Doc) => d.rows[0].columns[0].blocks[0].popups.map((p) => p.id);

  it('往上移一格', () => {
    const { doc, id } = withPopups();
    expect(order(applyAction(doc, { type: 'reorderPopups', blockId: id, from: 1, to: 0 })))
      .toEqual(['p2', 'p1', 'p3']);
  });

  it('往下移一格', () => {
    const { doc, id } = withPopups();
    expect(order(applyAction(doc, { type: 'reorderPopups', blockId: id, from: 0, to: 1 })))
      .toEqual(['p2', 'p1', 'p3']);
  });

  it('超出範圍不會把項目插到錯的位置', () => {
    const { doc, id } = withPopups();
    // 負的 to 若直接交給 splice，會被當成「從尾端數回來」
    expect(order(applyAction(doc, { type: 'reorderPopups', blockId: id, from: 0, to: -5 })))
      .toEqual(['p1', 'p2', 'p3']);
    expect(order(applyAction(doc, { type: 'reorderPopups', blockId: id, from: 0, to: 99 })))
      .toEqual(['p2', 'p3', 'p1']);
  });

  it('原地不動不佔一次復原', () => {
    const { doc, id } = withPopups();
    expect(applyAction(doc, { type: 'reorderPopups', blockId: id, from: 1, to: 1 })).toBe(doc);
  });

  it('排序不會弄丟任何一項', () => {
    const { doc, id } = withPopups();
    const moved = applyAction(doc, { type: 'reorderPopups', blockId: id, from: 2, to: 0 });
    expect(order(moved).slice().sort()).toEqual(['p1', 'p2', 'p3']);
  });
});

describe('匯入', () => {
  // 格式照真實教材：frontmatter 的 key 是英文，區塊之間空一行
  const md = [
    '---',
    'title: 測試課',
    'direction: 直排',
    'publisher: 測試出版社',
    '---',
    '',
    '# 測試課',
    '',
    '這是一段內文。',
    '',
    '## 第一節',
    '',
  ].join('\n');

  it('走 reducer，所以匯入退得回去', () => {
    // 直接換掉整份文件的話，老師匯錯檔案就得重編一課
    const before = docWith(makeRow([makeText('原本的內容')]));
    const after = applyAction(before, {
      type: 'importDoc',
      result: parseMarkdown(md, { autoPageBreak: true }),
    });
    expect(textOf(after.rows[0].columns[0].blocks[0])).toBe('測試課');
    // 純函式：原本那份沒被動到，undo 拿回來的是完整的舊狀態
    expect(textOf(before.rows[0].columns[0].blocks[0])).toBe('原本的內容');
  });

  it('標題與排版設定一起帶進來', () => {
    const after = applyAction(emptyDoc(), {
      type: 'importDoc',
      result: parseMarkdown(md, { autoPageBreak: true }),
    });
    expect(after.title).toBe('測試課');
    expect(after.settings.writingMode).toBe('vertical');
    expect(after.meta.publisher).toBe('測試出版社');
  });

  it('沒帶到的設定沿用原本的，不會被重設', () => {
    const doc: Doc = { ...emptyDoc(), settings: { ...emptyDoc().settings, textScale: 'lg' } };
    const after = applyAction(doc, {
      type: 'importDoc',
      result: parseMarkdown(md, { autoPageBreak: true }),
    });
    expect(after.settings.textScale).toBe('lg');
  });
});
