import { useCallback, useEffect, useRef } from 'react';
import { htmlToSpans, spansToHtml } from '../model/inlineDom';
import { caretOffset, placeCaret, selectionRange } from '../editor/caret';
import type { InlineSpan } from '../model/types';

export type Props = {
  spans: InlineSpan[];
  onChange: (next: InlineSpan[]) => void;
  /** 選取範圍改變（字元位置）。浮動膠囊靠它決定要不要出現。 */
  onSelect?: (range: { start: number; end: number } | null) => void;
  className?: string;
  style?: React.CSSProperties;
  placeholder?: string;
  onFocus?: () => void;
};

/**
 * 可以直接打字、而且保得住行內標記的文字。
 *
 * 兩個關鍵：
 *
 * 一、非受控。打字時不把 React 的值寫回 DOM，否則每按一鍵都會重設內容、
 *    游標跳回開頭。只有當外部的值跟「我們最後送出去的」不一樣時才同步——
 *    那是復原、套用標記、匯入、換教材造成的，而不是自己打的字。
 *
 * 二、標記存在 DOM 上，不是靠純文字。注音與注釋號是 contenteditable=false
 *    的原子，可以整個刪掉但打字碰不到裡面；粗體與重點詞是一般的行內元素，
 *    在裡面打字會自然延續。改一個字不會弄丟旁邊的注釋參照。
 */
export function EditableText({
  spans,
  onChange,
  onSelect,
  className,
  style,
  placeholder,
  onFocus,
}: Props) {
  const ref = useRef<HTMLDivElement>(null);
  /** 我們最後送出去的 HTML。用來分辨「自己打的」與「外面改的」。 */
  const emitted = useRef<string | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const want = spansToHtml(spans);
    if (want === emitted.current) return;

    // 外部改動：套用標記時焦點還在這裡，所以要把游標放回原位，
    // 否則按一次「重點詞」游標就跳到開頭。
    const focused = document.activeElement === el;
    const caret = focused ? caretOffset(el) : null;
    el.innerHTML = want;
    emitted.current = want;
    if (caret !== null) placeCaret(el, caret);
  }, [spans]);

  const report = useCallback(() => {
    const el = ref.current;
    if (!el || !onSelect) return;
    onSelect(selectionRange(el));
  }, [onSelect]);

  // 選取要監聽 document：拖曳選字時 mouseup 可能落在元件外面
  useEffect(() => {
    if (!onSelect) return;
    document.addEventListener('selectionchange', report);
    return () => document.removeEventListener('selectionchange', report);
  }, [onSelect, report]);

  return (
    <div
      ref={ref}
      className={className}
      style={style}
      contentEditable
      suppressContentEditableWarning
      role="textbox"
      aria-multiline="true"
      data-placeholder={placeholder}
      onFocus={onFocus}
      onInput={(e) => {
        const next = htmlToSpans(e.currentTarget);
        // 記下正規化後的樣子，下一輪才認得出這是自己造成的改變
        emitted.current = spansToHtml(next);
        onChange(next);
      }}
      onPaste={(e) => {
        // 貼上一律轉純文字：保留段落，丟掉來源的字體大小顏色。
        // 帶格式貼上會讓內容重新變成「有樣式的文字」而不是「有分類的內容」，
        // 那正是這次改版要解決的問題。
        e.preventDefault();
        const text = e.clipboardData.getData('text/plain');
        document.execCommand('insertText', false, text);
      }}
    />
  );
}
