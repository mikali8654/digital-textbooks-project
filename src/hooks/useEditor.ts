import { useCallback, useMemo, useState } from 'react';
import { dispatch as apply, canRedo, canUndo, initHistory, redo, undo } from '../model/history';
import { findBlock } from '../model/document';
import type { Action } from '../model/actions';
import { spliceSpans } from '../model/spans';
import type { Doc, InlineSpan, TextBlock } from '../model/types';

/**
 * 編輯器的狀態。
 *
 * 所有改動都經過 reducer，所以復原重做與自動儲存都是免費的副產品——
 * 這是 D1 把 reducer 寫成純函式的回報。
 */
export function useEditor(initial: Doc) {
  const [history, setHistory] = useState(() => initHistory(initial));

  const dispatch = useCallback((action: Action) => {
    setHistory((h) => apply(h, action));
  }, []);

  /**
   * 編輯一段文字，連同行內標記。
   *
   * 被切成兩頁的課文，畫面上只看得到其中一半。直接把片段存回去
   * 會弄丟另一半，所以要用分頁時記下的位置把片段接回原文——
   * 接的是「帶標記的片段」，不是純文字，否則另外那半的注音會被洗掉。
   */
  const editSpans = useCallback(
    (blockId: string, spans: InlineSpan[], slice?: { start: number; end: number }) => {
      setHistory((h) => {
        const hit = findBlock(h.present, blockId);
        if (!hit || hit.block.type !== 'text') return h;

        const full = (hit.block as TextBlock).spans;
        const next = slice ? spliceSpans(full, slice.start, slice.end, spans) : spans;

        return apply(h, { type: 'setSpans', blockId, spans: next });
      });
    },
    []
  );

  /**
   * 對選取範圍套用行內標記。範圍是「這個片段裡的」字元位置，
   * 跨頁時要先加上片段在原文的起點。
   */
  const toggleMark = useCallback(
    (
      blockId: string,
      range: { start: number; end: number },
      mark: 'bold' | 'keyword',
      on: boolean,
      slice?: { start: number; end: number }
    ) => {
      const offset = slice?.start ?? 0;
      dispatch({
        type: 'toggleMark',
        blockId,
        start: range.start + offset,
        end: range.end + offset,
        mark,
        on,
      });
    },
    [dispatch]
  );

  const replaceDoc = useCallback((doc: Doc) => setHistory(initHistory(doc)), []);

  return useMemo(
    () => ({
      doc: history.present,
      dispatch,
      editSpans,
      toggleMark,
      replaceDoc,
      undo: () => setHistory(undo),
      redo: () => setHistory(redo),
      canUndo: canUndo(history),
      canRedo: canRedo(history),
    }),
    [history, dispatch, editSpans, toggleMark, replaceDoc]
  );
}
