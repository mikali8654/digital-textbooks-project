import type { InlineSpan } from './types';

/**
 * 行內標記解析。對應 md 標記規格的「03 行內標記」。
 *
 *   重點詞  ==嘉南大圳==
 *   注音    {閑|ㄒㄧㄢˊ}
 *   注釋    先生不知何許[^1]人也
 *
 * 這三種都是語意不是樣式：重點詞關係到生字表、注音是文字資料的一部分、
 * 注釋是內容。做成粗體或上標會讓系統再次「讀不懂教材」。
 */
const TOKEN = /(==[^=]+==)|(\{[^}|]+\|[^}]+\})|(\[\^[^\]]+\])/g;

export function parseInline(raw: string): InlineSpan[] {
  const spans: InlineSpan[] = [];
  let last = 0;

  const pushText = (text: string) => {
    if (!text) return;
    const prev = spans[spans.length - 1];
    // 相鄰的純文字合併，避免產生一堆碎片
    if (prev && Object.keys(prev).length === 1) prev.text += text;
    else spans.push({ text });
  };

  for (const m of raw.matchAll(TOKEN)) {
    pushText(raw.slice(last, m.index));
    last = m.index + m[0].length;

    if (m[1]) {
      // 重點詞裡面可能還有注音（==瓦旦．{燮|ㄒㄧㄝˋ}謝促==），要遞迴進去
      for (const inner of parseInline(m[1].slice(2, -2))) {
        spans.push({ ...inner, keyword: true });
      }
    } else if (m[2]) {
      const [base, ruby] = m[2].slice(1, -1).split('|');
      spans.push({ text: base, ruby });
    } else if (m[3]) {
      spans.push({ text: '', footnoteRef: m[3].slice(2, -1) });
    }
  }
  pushText(raw.slice(last));

  return spans.length > 0 ? spans : [{ text: '' }];
}

export const plainOf = (spans: InlineSpan[]) => spans.map((s) => s.text).join('');
