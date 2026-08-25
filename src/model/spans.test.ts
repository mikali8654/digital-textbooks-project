import { describe, expect, it } from 'vitest';
import { lengthOf, mergeSpans, plainOf, sliceSpans, spliceSpans } from './spans';
import type { InlineSpan } from './types';

/** 一段有注音、有重點詞、有注釋號的課文，形狀跟國文正文一樣。 */
const sample: InlineSpan[] = [
  { text: '先生不知' },
  { text: '何許', keyword: true, footnoteRef: '1' },
  { text: '人也，亦不詳其姓字，宅邊有五' },
  { text: '柳', ruby: 'ㄌㄧㄡˇ' },
  { text: '樹，因以為號焉。' },
];

describe('sliceSpans', () => {
  it('切出來的純文字等於原文的同一段', () => {
    const plain = plainOf(sample);
    for (const [a, b] of [[0, 4], [2, 10], [4, 8], [0, plain.length]]) {
      expect(plainOf(sliceSpans(sample, a, b))).toBe(plain.slice(a, b));
    }
  });

  it('標記跟著字走', () => {
    // 「何許」整個落在區間內，重點詞與注釋號都要留著
    const s = sliceSpans(sample, 4, 8);
    expect(s[0]).toMatchObject({ text: '何許', keyword: true, footnoteRef: '1' });
  });

  it('注音被切一半時只留字，不留注音', () => {
    const ruby: InlineSpan[] = [{ text: '嘉南', ruby: 'ㄐㄧㄚ ㄋㄢˊ' }];
    expect(sliceSpans(ruby, 0, 1)).toEqual([{ text: '嘉', ruby: undefined }]);
    // 完整涵蓋就保留
    expect(sliceSpans(ruby, 0, 2)[0].ruby).toBe('ㄐㄧㄚ ㄋㄢˊ');
  });

  it('空區間是空的', () => {
    expect(sliceSpans(sample, 3, 3)).toEqual([]);
  });
});

describe('spliceSpans', () => {
  it('只換掉中間那一段，前後原封不動', () => {
    // 4..8 是「何許人也」——連重點詞帶注釋號一起換掉
    const next = spliceSpans(sample, 4, 8, [{ text: '在下' }]);
    expect(plainOf(next)).toBe('先生不知在下，亦不詳其姓字，宅邊有五柳樹，因以為號焉。');
    // 後半的注音還在
    expect(next.find((s) => s.ruby)?.ruby).toBe('ㄌㄧㄡˇ');
  });

  it('改第二頁那半段不會弄丟第一頁那半段', () => {
    // 分頁把段落切在第 12 個字，老師編的是後半
    const cut = 12;
    const tail = sliceSpans(sample, cut, lengthOf(sample));
    const edited = [...tail, { text: '（老師加註）' }];
    const merged = spliceSpans(sample, cut, lengthOf(sample), edited);

    expect(plainOf(merged).startsWith(plainOf(sample).slice(0, cut))).toBe(true);
    expect(plainOf(merged).endsWith('（老師加註）')).toBe(true);
    // 前半的重點詞與注釋參照沒被洗掉
    expect(merged.find((s) => s.footnoteRef)?.footnoteRef).toBe('1');
  });

  it('全部刪光仍然是一段空文字，不是空陣列', () => {
    expect(spliceSpans(sample, 0, lengthOf(sample), [])).toEqual([{ text: '' }]);
  });
});

describe('mergeSpans', () => {
  it('相鄰且標記相同的併起來', () => {
    expect(mergeSpans([{ text: '甲' }, { text: '乙' }])).toEqual([{ text: '甲乙' }]);
  });

  it('標記不同的不併', () => {
    const out = mergeSpans([{ text: '甲' }, { text: '乙', bold: true }]);
    expect(out).toHaveLength(2);
  });

  it('兩個注音各自獨立，不會被併成一個', () => {
    const out = mergeSpans([
      { text: '閑', ruby: 'ㄒㄧㄢˊ' },
      { text: '靜', ruby: 'ㄐㄧㄥˋ' },
    ]);
    expect(out).toHaveLength(2);
  });
});

describe('切開帶注釋號的段落', () => {
  // 注釋號標在段尾，所以切開時只有含段尾的那一半留著
  const withFn: InlineSpan[] = [{ text: '閑靜少言', footnoteRef: '3' }, { text: '不慕榮利' }];

  it('前半不帶注釋號', () => {
    expect(sliceSpans(withFn, 0, 2)).toEqual([{ text: '閑靜' }]);
  });

  it('後半才帶注釋號', () => {
    expect(sliceSpans(withFn, 2, 4)).toEqual([{ text: '少言', footnoteRef: '3' }]);
  });

  it('跨頁時同一個編號不會在兩頁上各出現一次', () => {
    const head = sliceSpans(withFn, 0, 3);
    const tail = sliceSpans(withFn, 3, lengthOf(withFn));
    const count = [...head, ...tail].filter((s) => s.footnoteRef === '3').length;
    expect(count).toBe(1);
  });

  it('沒有文字的標記段落在切片時不會消失', () => {
    const marker: InlineSpan[] = [{ text: '因以為號焉' }, { text: '', footnoteRef: '2' }];
    expect(sliceSpans(marker, 0, 5)).toEqual(marker);
    // 起點之前的不算進來
    expect(sliceSpans(marker, 0, 3)).toEqual([{ text: '因以為' }]);
  });
});
