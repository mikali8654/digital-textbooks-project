// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { spansToHtml } from '../model/inlineDom';
import { caretOffset, placeCaret, selectionRange } from './caret';
import type { InlineSpan } from '../model/types';

const spans: InlineSpan[] = [
  { text: '先生不知' },
  { text: '何許', keyword: true, footnoteRef: '1' },
  { text: '人也，宅邊有五' },
  { text: '柳', ruby: 'ㄌㄧㄡˇ' },
  { text: '樹。' },
];

function mount(): HTMLElement {
  const el = document.createElement('div');
  el.innerHTML = spansToHtml(spans);
  document.body.append(el);
  return el;
}

describe('游標位置', () => {
  it('放到第幾個字，讀回來就是第幾個字', () => {
    const el = mount();
    for (const n of [0, 4, 6, 13, 16]) {
      placeCaret(el, n);
      expect(caretOffset(el)).toBe(n);
    }
  });

  it('注音與注釋號都不算字', () => {
    const el = mount();
    // 課文是 16 個字，但 DOM 的 textContent 有 21 個——多的是注音 ㄌㄧㄡˇ
    // 與注釋號 1。少扣任何一個，套用標記的範圍就會整段位移，標到錯的字上
    expect(el.textContent).toHaveLength(21);
    placeCaret(el, 15);
    expect(caretOffset(el)).toBe(15);
  });

  it('超過結尾就停在結尾', () => {
    const el = mount();
    placeCaret(el, 9999);
    expect(caretOffset(el)).toBe(16);
  });

  it('沒選字時沒有選取範圍——膠囊不該冒出來', () => {
    const el = mount();
    placeCaret(el, 3);
    expect(selectionRange(el)).toBeNull();
  });

  it('選一段字回報字元區間', () => {
    const el = mount();
    const range = document.createRange();
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    const first = walker.nextNode() as Text;
    range.setStart(first, 1);
    range.setEnd(first, 3);
    const sel = document.getSelection()!;
    sel.removeAllRanges();
    sel.addRange(range);

    expect(selectionRange(el)).toEqual({ start: 1, end: 3 });
  });
});
