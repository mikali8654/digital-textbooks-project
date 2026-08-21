import { beforeEach, describe, expect, it } from 'vitest';
import { paginate } from './paginate';
import { makeRow, makeText } from './document';
import { newId, resetIds } from './ids';
import { fakeMeasurer, linesOfText, pageOptions } from './testing';
import type { ImageBlock, Row, TableBlock } from './types';

const run = (rows: Row[]) => paginate(rows, pageOptions, fakeMeasurer);

const image = (): ImageBlock => ({
  id: newId('blk'), type: 'image', assetId: null, caption: '', aspectRatio: 1.5, popups: [],
});
const table = (): TableBlock => ({
  id: newId('blk'), type: 'table', rows: 3, cols: 3,
  cells: [['','',''],['','',''],['','','']], hasHeader: true, popups: [],
});

beforeEach(resetIds);

describe('基本分頁', () => {
  it('內容放得下就只有一頁', () => {
    const pages = run([makeRow([makeText(linesOfText(2))])]);
    expect(pages).toHaveLength(1);
    expect(pages[0].startedBy).toBe('first');
  });

  it('內容超過一頁就自動往下流', () => {
    // 每行 28、可用高度 400 → 一頁約 14 行
    const rows = Array.from({ length: 6 }, () => makeRow([makeText(linesOfText(3))]));
    const pages = run(rows);
    expect(pages.length).toBeGreaterThan(1);
    for (const p of pages) expect(p.usedHeight).toBeLessThanOrEqual(pageOptions.contentHeight);
  });

  it('每頁第一列的上緣間距一律是 0', () => {
    const rows = Array.from({ length: 8 }, () => makeRow([makeText(linesOfText(3))]));
    for (const p of run(rows)) expect(p.items[0].gapBefore).toBe(0);
  });
});

describe('兩種換頁線', () => {
  it('使用者放的換頁線一定從新的一頁開始，即使前面還有空間', () => {
    const rows = [
      makeRow([makeText('第一段', 'body')]),
      makeRow([makeText('第二段', 'body')], true),
    ];
    const pages = run(rows);
    expect(pages).toHaveLength(2);
    expect(pages[1].startedBy).toBe('manual');
    // 第一頁明明還很空
    expect(pages[0].usedHeight).toBeLessThan(pageOptions.contentHeight / 2);
  });

  it('使用者放的換頁線位置不隨內容移動', () => {
    const marked = makeRow([makeText('固定在這裡', 'body')], true);
    const before = run([makeRow([makeText('短', 'body')]), marked]);
    const after = run([
      makeRow([makeText('短', 'body')]),
      makeRow([makeText(linesOfText(5))]),
      marked,
    ]);
    // 前面加了內容，但被標記的那一列仍然是它那一頁的第一列
    const findPage = (pages: ReturnType<typeof run>) =>
      pages.find((p) => p.items.some((i) => i.row.id === marked.id))!;
    expect(findPage(before).items[0].row.id).toBe(marked.id);
    expect(findPage(after).items[0].row.id).toBe(marked.id);
  });

  it('系統放的換頁線會隨內容移動', () => {
    // 用圖片當尾列：它不能被切開，所以放不下時會整列往後流，
    // 那正是「系統放的換頁線位置會跑」的意思。
    const tail = makeRow([image()]);
    const short = run([makeRow([makeText(linesOfText(2))]), tail]);
    const long = run([makeRow([makeText(linesOfText(12))]), tail]);
    const pageOf = (pages: ReturnType<typeof run>) =>
      pages.findIndex((p) => p.items.some((i) => i.row.id === tail.id));
    expect(pageOf(short)).toBe(0);
    expect(pageOf(long)).toBe(1);
  });
});

describe('跨頁', () => {
  it('文字放不下時會被切開，前後仍是同一個元件', () => {
    const row = makeRow([makeText(linesOfText(30))]);
    const pages = run([row]);
    expect(pages.length).toBeGreaterThan(1);

    const head = pages[0].items.at(-1)!;
    const tail = pages[1].items[0];
    expect(head.continuesOnNext).toBe(true);
    expect(tail.continuedFromPrev).toBe(true);
    expect(tail.row.id).toBe(row.id);
    expect(tail.row.columns[0].blocks[0].id).toBe(row.columns[0].blocks[0].id);
  });

  it('切開之後文字不會遺失也不會重複', () => {
    const original = linesOfText(30);
    const pages = run([makeRow([makeText(original)])]);
    const joined = pages
      .flatMap((p) => p.items)
      .map((i) => {
        const b = i.row.columns[0].blocks[0];
        return b.type === 'text' ? b.spans.map((s) => s.text).join('') : '';
      })
      .join('');
    expect(joined).toBe(original);
  });

  it('非文字元件不會被切開，放不下就整個移到下一頁', () => {
    const rows = [makeRow([makeText(linesOfText(12))]), makeRow([image()])];
    const pages = run(rows);
    expect(pages).toHaveLength(2);
    expect(pages[1].items[0].row.id).toBe(rows[1].id);
    expect(pages.flatMap((p) => p.items).every((i) => !i.continuesOnNext)).toBe(true);
  });

  it('多欄的列不會被切開', () => {
    const wide: Row = {
      id: newId('row'),
      breakBefore: false,
      columns: [
        { id: newId('col'), widthPct: 50, blocks: [makeText(linesOfText(10))] },
        { id: newId('col'), widthPct: 50, blocks: [image()] },
      ],
    };
    const pages = run([makeRow([makeText(linesOfText(10))]), wide]);
    expect(pages.flatMap((p) => p.items).every((i) => !i.continuesOnNext)).toBe(true);
  });
});

describe('不滿一頁的留白', () => {
  it('剩下的空間就留白，不會把下一頁的內容拉上來', () => {
    const rows = [
      makeRow([makeText('只有一行')]),
      makeRow([makeText('下一頁的內容')], true),
    ];
    const pages = run(rows);
    expect(pages[0].items).toHaveLength(1);
    expect(pages[0].usedHeight).toBeLessThan(pageOptions.contentHeight);
  });
});

describe('比一頁還高的元件', () => {
  it('盒狀模組會被縮到放得進一頁，不會溢出', () => {
    const tall = { ...table(), rows: 40 };
    const pages = paginate([makeRow([tall])], { ...pageOptions, contentHeight: 120 }, fakeMeasurer);
    expect(pages).toHaveLength(1);
    expect(pages[0].usedHeight).toBeLessThanOrEqual(120);
  });
});
