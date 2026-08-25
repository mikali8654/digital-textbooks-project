// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { htmlToSpans, spansToHtml } from './inlineDom';
import { plainOf } from './spans';
import type { InlineSpan } from './types';

const mount = (html: string): HTMLElement => {
  const el = document.createElement('div');
  el.innerHTML = html;
  return el;
};

const roundTrip = (spans: InlineSpan[]) => htmlToSpans(mount(spansToHtml(spans)));

/** 國文正文的形狀：注音、重點詞、注釋號同時出現在一段裡。 */
const sample: InlineSpan[] = [
  { text: '先生不知' },
  { text: '何許', keyword: true, footnoteRef: '1' },
  { text: '人也，宅邊有五' },
  { text: '柳', ruby: 'ㄌㄧㄡˇ' },
  { text: '樹。' },
];

describe('spans ⇄ DOM', () => {
  it('來回一趟之後完全一樣', () => {
    expect(roundTrip(sample)).toEqual(sample);
  });

  it('注音是原子，打字碰不到裡面', () => {
    const el = mount(spansToHtml(sample));
    const ruby = el.querySelector('ruby')!;
    expect(ruby.getAttribute('contenteditable')).toBe('false');
    expect(ruby.querySelector('rt')?.textContent).toBe('ㄌㄧㄡˇ');
  });

  it('注釋號是原子，讀回來時不會被當成內文', () => {
    const el = mount(spansToHtml(sample));
    const sup = el.querySelector('sup[data-fn]')!;
    expect(sup.getAttribute('contenteditable')).toBe('false');

    // 畫面上看得到編號，但它不是課文的字——讀回模型時只留參照
    expect(sup.textContent).toBe('1');
    expect(plainOf(htmlToSpans(el))).toBe('先生不知何許人也，宅邊有五柳樹。');
  });

  it('md 匯入的空標記形式也能來回', () => {
    // 解析器產出的形狀：注釋號自成一段、沒有文字
    const fromMd: InlineSpan[] = [{ text: '因以為號焉' }, { text: '', footnoteRef: '2' }];
    const back = roundTrip(fromMd);
    // 讀回來時掛到前一段上，但畫出來的 HTML 完全一樣——所以是穩定的
    expect(back).toEqual([{ text: '因以為號焉', footnoteRef: '2' }]);
    expect(spansToHtml(back)).toBe(spansToHtml(fromMd));
  });

  it('打字之後注釋號還在——這是 25 條注釋不斷掉的關鍵', () => {
    const fromMd: InlineSpan[] = [{ text: '因以為號焉' }, { text: '', footnoteRef: '2' }];
    const el = mount(spansToHtml(fromMd));
    el.childNodes[0].textContent = '因以為別號焉';

    const out = htmlToSpans(el);
    expect(out.find((s) => s.footnoteRef)?.footnoteRef).toBe('2');
  });

  it('在重點詞裡打字，重點詞還在', () => {
    const el = mount(spansToHtml(sample));
    const kw = el.querySelector('[data-kw]')!;
    kw.textContent = '何許何';

    const out = htmlToSpans(el);
    expect(out.find((s) => s.keyword)).toMatchObject({
      text: '何許何',
      keyword: true,
      footnoteRef: '1',
    });
    // 其他標記一個都沒掉
    expect(out.find((s) => s.ruby)?.ruby).toBe('ㄌㄧㄡˇ');
  });

  it('在無標記的地方打字不會沾到旁邊的標記', () => {
    const el = mount(spansToHtml(sample));
    el.childNodes[0].textContent = '先生實不知';

    const out = htmlToSpans(el);
    expect(out[0]).toEqual({ text: '先生實不知' });
    expect(out[0].keyword).toBeUndefined();
  });

  it('整個刪掉注音那一塊，其餘不受影響', () => {
    const el = mount(spansToHtml(sample));
    el.querySelector('ruby')!.remove();

    const out = htmlToSpans(el);
    expect(plainOf(out)).toBe('先生不知何許人也，宅邊有五樹。');
    expect(out.some((s) => s.ruby)).toBe(false);
    expect(out.find((s) => s.keyword)?.keyword).toBe(true);
  });

  it('認得瀏覽器自己插入的 <b>', () => {
    const out = htmlToSpans(mount('平常<b>粗的</b>'));
    expect(out).toEqual([{ text: '平常' }, { text: '粗的', bold: true }]);
  });

  it('相鄰的相同標記會併起來，不會愈打愈碎', () => {
    const out = htmlToSpans(mount('<span>甲</span><span>乙</span><span>丙</span>'));
    expect(out).toEqual([{ text: '甲乙丙' }]);
  });

  it('尖括號被跳脫，不會變成標籤', () => {
    const out = roundTrip([{ text: '<script>不是標籤' }]);
    expect(out).toEqual([{ text: '<script>不是標籤' }]);
  });

  it('全空的內容回傳一段空文字，不是空陣列', () => {
    expect(htmlToSpans(mount(''))).toEqual([{ text: '' }]);
  });
});
