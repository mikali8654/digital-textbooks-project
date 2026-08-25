import type { InlineSpan } from './types';
import { sameMarks } from './spans';

/**
 * 行內樣式與 DOM 的雙向轉換。
 *
 * 直接把帶標記的文字丟給 contentEditable 會有兩種壞法：
 *  - 打字之後 <ruby>、注釋號、重點詞被壓成純文字，25 條注釋的連結全斷
 *  - 或者為了保住標記而整段唯讀，老師根本不能編
 *
 * 所以要能把 spans 畫成 DOM，也能把使用者改過的 DOM 讀回 spans。
 *
 * 兩種標記的處理方式不同：
 *  - 可以在裡面打字的（粗體、重點詞、顏色）→ 一般的行內元素
 *  - 不該被拆開的（注音、注釋號）→ 原子，contenteditable=false，
 *    可以整個刪掉但不能編到內部
 */

const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/**
 * 注釋號一律畫成獨立的 <sup> 原子，而不是掛在某一段文字上。
 *
 * 因為它在課文裡是一個「點」不是一個「範圍」：
 * `何許[^1]` 的注釋屬於那個位置，不屬於整句話。掛在文字上的話，
 * 老師在那段話裡打字，新字也會繼承注釋號。
 */
const supOf = (n: string) => `<sup data-fn="${esc(n)}" contenteditable="false">${esc(n)}</sup>`;

export function spansToHtml(spans: InlineSpan[]): string {
  return spans
    .map((s) => {
      const mark = s.footnoteRef ? supOf(s.footnoteRef) : '';
      if (!s.text) return mark;

      if (s.ruby) {
        // 注音是原子：整個刪得掉，但不能編到裡面，否則注音會跟字分家
        return (
          `<ruby data-ruby="${esc(s.ruby)}" contenteditable="false">` +
          `${esc(s.text)}<rt>${esc(s.ruby)}</rt></ruby>${mark}`
        );
      }

      const attrs: string[] = [];
      if (s.keyword) attrs.push('data-kw="1"');
      if (s.bold) attrs.push('data-bold="1"');
      if (s.color && s.color !== 'default') attrs.push(`data-color="${esc(s.color)}"`);
      if (s.href) attrs.push(`data-href="${esc(s.href)}"`);

      const text = esc(s.text);
      return (attrs.length > 0 ? `<span ${attrs.join(' ')}>${text}</span>` : text) + mark;
    })
    .join('');
}

/** 把使用者編過的 DOM 讀回 spans。相鄰且標記相同的會被合併。 */
export function htmlToSpans(root: HTMLElement): InlineSpan[] {
  const out: InlineSpan[] = [];

  const push = (span: InlineSpan) => {
    if (!span.text) return;
    const last = out[out.length - 1];
    // 相鄰且標記完全相同就併起來，避免每打一個字就多一個 span
    if (last && sameMarks(last, span)) {
      last.text += span.text;
      return;
    }
    out.push(span);
  };

  /**
   * 收下一個注釋號。
   *
   * 能掛在前一段文字上就掛上去，這樣模型裡的段落數不會愈編愈多；
   * 前面沒有東西可掛（開頭就是注釋號、或前一段已經有一個）時，
   * 才留成一個沒有文字的標記。兩種形式畫出來的 HTML 完全一樣。
   */
  const pushFootnote = (id: string, inherited: Omit<InlineSpan, 'text'>) => {
    const last = out[out.length - 1];
    if (last && last.text && !last.footnoteRef && !last.ruby) last.footnoteRef = id;
    else out.push({ ...inherited, text: '', footnoteRef: id });
  };

  const walk = (node: Node, inherited: Omit<InlineSpan, 'text'>) => {
    if (node.nodeType === Node.TEXT_NODE) {
      push({ ...inherited, text: node.textContent ?? '' });
      return;
    }
    if (node.nodeType !== Node.ELEMENT_NODE) return;

    const el = node as HTMLElement;

    // 注釋號的數字是畫出來的，不是內文——不能讀進 text
    if (el.dataset.fn) {
      pushFootnote(el.dataset.fn, inherited);
      return;
    }

    if (el.tagName === 'RUBY') {
      const ruby = el.dataset.ruby ?? el.querySelector('rt')?.textContent ?? '';
      // 只取基字，不要把 <rt> 的注音也讀成內文
      const base = Array.from(el.childNodes)
        .filter((n) => n.nodeName !== 'RT')
        .map((n) => n.textContent ?? '')
        .join('');
      push({ ...inherited, text: base, ruby });
      return;
    }
    // 注音的 <rt> 已經在上面處理掉了，單獨遇到就跳過
    if (el.tagName === 'RT') return;

    // 瀏覽器有時會自己插入 <b> / <i>，一併認得
    const marks: Omit<InlineSpan, 'text'> = { ...inherited };
    if (el.dataset.kw) marks.keyword = true;
    if (el.dataset.bold || el.tagName === 'B' || el.tagName === 'STRONG') marks.bold = true;
    if (el.dataset.color) marks.color = el.dataset.color as InlineSpan['color'];
    if (el.dataset.href) marks.href = el.dataset.href;

    for (const child of Array.from(el.childNodes)) walk(child, marks);
  };

  for (const child of Array.from(root.childNodes)) walk(child, {});
  return out.length > 0 ? out : [{ text: '' }];
}
