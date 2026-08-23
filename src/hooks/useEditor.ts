import { useCallback, useMemo, useState } from 'react';
import { dispatch as apply, canRedo, canUndo, initHistory, redo, undo } from '../model/history';
import { findBlock } from '../model/document';
import type { Action } from '../model/actions';
import type { Doc, TextBlock } from '../model/types';

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
   * 編輯一段文字。
   *
   * 被切成兩頁的課文，畫面上只看得到其中一半。直接把片段存回去
   * 會弄丟另一半，所以要用分頁時記下的位置把片段接回原文。
   */
  const editText = useCallback(
    (blockId: string, fragment: string, slice?: { start: number; end: number }) => {
      setHistory((h) => {
        const hit = findBlock(h.present, blockId);
        if (!hit || hit.block.type !== 'text') return h;

        const full = (hit.block as TextBlock).spans.map((s) => s.text).join('');
        const next = slice
          ? full.slice(0, slice.start) + fragment + full.slice(slice.end)
          : fragment;

        return apply(h, { type: 'setText', blockId, text: next });
      });
    },
    []
  );

  const replaceDoc = useCallback((doc: Doc) => setHistory(initHistory(doc)), []);

  return useMemo(
    () => ({
      doc: history.present,
      dispatch,
      editText,
      replaceDoc,
      undo: () => setHistory(undo),
      redo: () => setHistory(redo),
      canUndo: canUndo(history),
      canRedo: canRedo(history),
    }),
    [history, dispatch, editText, replaceDoc]
  );
}
