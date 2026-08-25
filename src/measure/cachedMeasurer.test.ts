import { beforeEach, describe, expect, it } from 'vitest';
import { withCache } from './cachedMeasurer';
import { paginate, pageOptionsFor } from '../model/paginate';
import { makeRow, makeText } from '../model/document';
import { resetIds } from '../model/ids';
import { fakeMeasurer, linesOfText } from '../model/testing';
import { applyAction } from '../model/reducer';
import type { Doc, ImageBlock, TextBlock } from '../model/types';
import { emptyDoc } from '../model/document';

const PAGE = { width: 800, height: 600 };
const OPTS = pageOptionsFor({ writingMode: 'horizontal' }, PAGE, 16);

/** 一課一萬字：約 40 段、每段 250 字。 */
function bigDoc(): Doc {
  const rows = Array.from({ length: 40 }, (_, i) =>
    makeRow([makeText(`第${i}段。` + linesOfText(8))])
  );
  return { ...emptyDoc(), rows };
}

beforeEach(resetIds);

describe('量測快取', () => {
  it('同樣的內容只量一次', () => {
    const m = withCache(fakeMeasurer);
    const rows = [makeRow([makeText(linesOfText(3))])];
    paginate(rows, OPTS, m);
    const afterFirst = m.stats.misses;
    paginate(rows, OPTS, m);
    expect(m.stats.misses).toBe(afterFirst);
    expect(m.stats.hits).toBeGreaterThan(0);
  });

  it('打一個字只重量一個區塊', () => {
    const m = withCache(fakeMeasurer);
    let doc = bigDoc();
    paginate(doc.rows, OPTS, m); // 暖機

    const target = doc.rows[20].columns[0].blocks[0] as TextBlock;
    const before = m.stats.misses;

    doc = applyAction(doc, {
      type: 'setText',
      blockId: target.id,
      text: '改過的內容' + linesOfText(8),
    });
    paginate(doc.rows, OPTS, m);

    // 四十段裡只有一段變了，所以只該多量那一段
    expect(m.stats.misses - before).toBeLessThanOrEqual(2);
  });

  it('連打十個字，重量次數與段落總數無關', () => {
    const m = withCache(fakeMeasurer);
    let doc = bigDoc();
    paginate(doc.rows, OPTS, m);

    const target = doc.rows[0].columns[0].blocks[0] as TextBlock;
    const before = m.stats.misses;
    let text = '起';
    for (let i = 0; i < 10; i++) {
      text += '字';
      doc = applyAction(doc, { type: 'setText', blockId: target.id, text });
      paginate(doc.rows, OPTS, m);
    }
    // 每次按鍵最多量兩次（高度與行框），十次就是二十上下——
    // 不會因為文件有四十段就變成四百次
    expect(m.stats.misses - before).toBeLessThanOrEqual(25);
  });

  it('設定改變時要整個丟掉', () => {
    const m = withCache(fakeMeasurer);
    paginate([makeRow([makeText(linesOfText(3))])], OPTS, m);
    expect(m.size()).toBeGreaterThan(0);
    m.clear();
    expect(m.size()).toBe(0);
    expect(m.stats.hits).toBe(0);
  });

  it('快取不會改變分頁結果', () => {
    const doc = bigDoc();
    const plain = paginate(doc.rows, OPTS, fakeMeasurer);
    const cached = paginate(doc.rows, OPTS, withCache(fakeMeasurer));
    expect(cached.map((p) => p.items.length)).toEqual(plain.map((p) => p.items.length));
    expect(cached.map((p) => p.usedBlockSize)).toEqual(plain.map((p) => p.usedBlockSize));
  });
});

describe('快取鍵要涵蓋所有會改變尺寸的東西', () => {
  /** 量到的高度若不隨這些欄位變，畫面就會跟分頁對不起來，內容被切掉。 */
  const measureOnce = (block: Parameters<typeof fakeMeasurer.blockSize>[0]) => {
    const m = withCache(fakeMeasurer);
    m.blockSize(block, 400, 600);
    return m;
  };

  const img = (patch: Partial<ImageBlock> = {}): ImageBlock => ({
    id: 'blk_img', type: 'image', assetId: null, alt: '', caption: '',
    aspectRatio: 1.5, popups: [], ...patch,
  });

  it('圖片換了比例就要重量', () => {
    const m = measureOnce(img());
    const before = m.stats.misses;
    m.blockSize(img({ aspectRatio: 16 / 9 }), 400, 600);
    expect(m.stats.misses).toBe(before + 1);
  });

  it('圖片改了寬度就要重量', () => {
    const m = measureOnce(img());
    const before = m.stats.misses;
    m.blockSize(img({ widthPct: 35 }), 400, 600);
    expect(m.stats.misses).toBe(before + 1);
  });

  it('文字加了注音就要重量——注音會撐高行高', () => {
    const plain: TextBlock = {
      id: 'blk_t', type: 'text', role: 'body', popups: [], spans: [{ text: '五柳先生' }],
    };
    const ruby: TextBlock = {
      ...plain,
      spans: [{ text: '五' }, { text: '柳', ruby: 'ㄌㄧㄡˇ' }, { text: '先生' }],
    };
    const m = withCache(fakeMeasurer);
    m.blockSize(plain, 400, 600);
    const before = m.stats.misses;
    m.blockSize(ruby, 400, 600);
    expect(m.stats.misses).toBe(before + 1);
  });

  it('同一段沒改就還是命中，不會因為換了鍵而全部重量', () => {
    const plain: TextBlock = {
      id: 'blk_t', type: 'text', role: 'body', popups: [], spans: [{ text: '五柳先生' }],
    };
    const m = withCache(fakeMeasurer);
    m.blockSize(plain, 400, 600);
    const before = m.stats.hits;
    m.blockSize({ ...plain, spans: [{ text: '五柳先生' }] }, 400, 600);
    expect(m.stats.hits).toBe(before + 1);
  });
});
