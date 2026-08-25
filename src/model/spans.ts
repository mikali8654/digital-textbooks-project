import type { InlineSpan } from './types';

/**
 * 行內樣式陣列的純函式操作。
 *
 * 分頁把長段落切成兩頁、行內編輯把改過的片段寫回原文，用的是同一組操作：
 * 都是「用字元位置切開或接起一串帶標記的文字」。
 *
 * 以前這件事是用 spans.map(s => s.text).join('') 攤平成純文字做的，
 * 於是跨頁的段落一到第二頁就沒有注音、重點詞和注釋號了——
 * 〈五柳先生傳〉的正文正好跨頁。
 */

export const plainOf = (spans: InlineSpan[]) => spans.map((s) => s.text).join('');

export const lengthOf = (spans: InlineSpan[]) => plainOf(spans).length;

/**
 * 沒有文字、只帶注釋號的標記段。
 *
 * 注釋號在課文裡是一個位置不是一段字（md 的 `[^1]`），
 * md 匯入時就是這個形狀。合併與切片都不能把它當成空字串丟掉，
 * 否則老師一打字，那一課的 25 條注釋就全斷了。
 */
export const isFootnoteMarker = (s: InlineSpan) => !s.text && !!s.footnoteRef;

/** 兩段的標記是否完全相同。注音自成一段，永遠不合併。 */
export function sameMarks(a: InlineSpan, b: InlineSpan): boolean {
  if (a.ruby || b.ruby) return false;
  return (
    !!a.bold === !!b.bold &&
    !!a.keyword === !!b.keyword &&
    a.color === b.color &&
    a.href === b.href &&
    a.footnoteRef === b.footnoteRef
  );
}

/** 把相鄰且標記相同的段落併起來，避免每打一個字就多一段。 */
export function mergeSpans(spans: InlineSpan[]): InlineSpan[] {
  const out: InlineSpan[] = [];
  for (const s of spans) {
    if (isFootnoteMarker(s)) {
      out.push({ ...s });
      continue;
    }
    if (!s.text) continue;
    const last = out[out.length - 1];
    if (last && sameMarks(last, s)) last.text += s.text;
    else out.push({ ...s });
  }
  return out;
}

/**
 * 取出字元區間 [start, end)，標記跟著走。
 *
 * 注音被切一半時只留字、不留注音——半個注音貼在半個詞上是錯的，
 * 寧可少一個注音也不要標錯位置。
 */
export function sliceSpans(spans: InlineSpan[], start: number, end: number): InlineSpan[] {
  const out: InlineSpan[] = [];
  let pos = 0;

  for (const s of spans) {
    const from = pos;
    const to = pos + s.text.length;
    pos = to;

    // 注釋號沒有寬度，用「它落在哪個位置」判斷。屬於它前面那個字，
    // 所以區間的結尾算含它、開頭算不含。
    if (isFootnoteMarker(s)) {
      if (from > start && from <= end) out.push({ ...s });
      continue;
    }

    if (to <= start) continue;
    if (from >= end) break;

    const a = Math.max(start, from) - from;
    const b = Math.min(end, to) - from;
    const text = s.text.slice(a, b);
    if (!text) continue;

    if (a === 0 && b === s.text.length) {
      out.push({ ...s, text });
      continue;
    }

    // 被切成兩半時，兩種標記都不能兩邊都留：
    //   注音標的是整個詞，半個詞配半個音是錯的
    //   注釋號標在這一段的結尾，只有含結尾的那一半該留著，
    //   否則跨頁的段落會在兩頁上各出現一次同一個編號
    const piece: InlineSpan = { ...s, text };
    if (s.ruby) piece.ruby = undefined;
    if (s.footnoteRef && b !== s.text.length) piece.footnoteRef = undefined;
    out.push(piece);
  }

  return mergeSpans(out);
}

/**
 * 用新的內容取代字元區間 [start, end)。
 *
 * 這是「這一頁只看得到半段課文，老師改了這半段」的寫回路徑：
 * 前後兩半原封不動，只有中間換掉。
 */
export function spliceSpans(
  spans: InlineSpan[],
  start: number,
  end: number,
  replacement: InlineSpan[]
): InlineSpan[] {
  const total = lengthOf(spans);
  const head = sliceSpans(spans, 0, start);
  const tail = sliceSpans(spans, end, total);
  const merged = mergeSpans([...head, ...replacement, ...tail]);
  return merged.length > 0 ? merged : [{ text: '' }];
}
