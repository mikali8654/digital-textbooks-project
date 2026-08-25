/**
 * 游標與選取範圍的位置，用「第幾個字」表示。
 *
 * DOM 的 Selection 講的是「哪個節點的第幾個位置」，但資料模型講的是
 * 「整段的第幾個字」。行內標記讓兩者不一致——一段話可能由五個 <span>
 * 組成，DOM 位置沒辦法直接拿來切 spans。
 *
 * 注音的 <rt> 與注釋號的 <sup> 都不算字：它們是標在字旁邊的記號，
 * 不是內文的一部分。少扣一個，套用標記時整段的位置就會位移，標到錯的字上。
 */

/** 走訪內文的文字節點，跳過注音與注釋號。 */
function textNodes(root: HTMLElement): Text[] {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode: (n) =>
      n.parentElement?.closest('rt, [data-fn]')
        ? NodeFilter.FILTER_REJECT
        : NodeFilter.FILTER_ACCEPT,
  });
  const out: Text[] = [];
  let n = walker.nextNode();
  while (n) {
    out.push(n as Text);
    n = walker.nextNode();
  }
  return out;
}

/** DOM 位置 → 第幾個字。 */
function offsetOf(root: HTMLElement, node: Node, offset: number): number {
  let count = 0;
  for (const t of textNodes(root)) {
    if (t === node) return count + offset;
    count += t.length;
  }
  // 落在元素節點上（例如整段被選起來），用它前面的字數逼近
  if (node === root) {
    let seen = 0;
    for (let i = 0; i < offset && i < root.childNodes.length; i += 1) {
      seen += root.childNodes[i].textContent?.length ?? 0;
    }
    return seen;
  }
  return count;
}

/** 第幾個字 → DOM 位置。超出結尾就放在最後。 */
function locate(root: HTMLElement, offset: number): { node: Node; offset: number } {
  let left = offset;
  const nodes = textNodes(root);
  for (const t of nodes) {
    if (left <= t.length) return { node: t, offset: left };
    left -= t.length;
  }
  const last = nodes[nodes.length - 1];
  return last ? { node: last, offset: last.length } : { node: root, offset: 0 };
}

/** 目前游標在第幾個字。沒有游標或游標不在這裡就是 null。 */
export function caretOffset(root: HTMLElement): number | null {
  const sel = document.getSelection();
  if (!sel || sel.rangeCount === 0) return null;
  const r = sel.getRangeAt(0);
  if (!root.contains(r.startContainer)) return null;
  return offsetOf(root, r.startContainer, r.startOffset);
}

/** 把游標放回第幾個字。 */
export function placeCaret(root: HTMLElement, offset: number): void {
  const sel = document.getSelection();
  if (!sel) return;
  const { node, offset: o } = locate(root, offset);
  const range = document.createRange();
  range.setStart(node, o);
  range.collapse(true);
  sel.removeAllRanges();
  sel.addRange(range);
}

/**
 * 目前選了哪一段。折疊（只有游標、沒有選字）時回傳 null——
 * 浮動膠囊只在真的選了字的時候出現。
 */
export function selectionRange(root: HTMLElement): { start: number; end: number } | null {
  const sel = document.getSelection();
  if (!sel || sel.rangeCount === 0 || sel.isCollapsed) return null;
  const r = sel.getRangeAt(0);
  if (!root.contains(r.startContainer) || !root.contains(r.endContainer)) return null;
  const start = offsetOf(root, r.startContainer, r.startOffset);
  const end = offsetOf(root, r.endContainer, r.endOffset);
  return start === end ? null : { start: Math.min(start, end), end: Math.max(start, end) };
}
