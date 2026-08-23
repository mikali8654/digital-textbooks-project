import { useCallback, useRef } from 'react';
import type { DropTarget } from '../model/actions';

/**
 * 拖曳重排，用 pointer events。
 *
 * 刻意不用 HTML5 的 drag-and-drop：
 *  - 它在觸控裝置上完全不能用，而老師是用平板的
 *  - 它需要 dataTransfer.setData() 才會啟動，漏了就安靜地什麼都不發生
 *  - 自動化測不到，等於這條路只能靠人工試
 *
 * 落點靠命中測試決定，而且只有三種結果——因為版面沒有自由畫布：
 *  - 指到某一列的左緣  → 跟它併成兩欄（放左邊）
 *  - 指到某一列的右緣  → 跟它併成兩欄（放右邊）
 *  - 指到中間          → 插進那一列之前，自成一列
 */

/** 左右各多少比例算「併欄」。中間留給「插進順序裡」。 */
const SIDE_ZONE = 0.28;

export type DragApi = {
  startDrag: (e: PointerEvent, rowId: string) => void;
};

export function useRowDrag(
  setDraggingRowId: (id: string | null) => void,
  setDropTarget: (t: DropTarget | null) => void,
  commit: (rowId: string, target: DropTarget) => void
): DragApi {
  // 用 ref 保存，pointerup 當下才不會讀到過期的 state
  const target = useRef<DropTarget | null>(null);
  const dragging = useRef<string | null>(null);

  const startDrag = useCallback(
    (e: PointerEvent, rowId: string) => {
      dragging.current = rowId;
      target.current = null;
      setDraggingRowId(rowId);

      /** 依指標位置算出落點。只有三種結果——版面沒有自由畫布。 */
      const targetAt = (x: number, y: number): DropTarget | null => {
        const el = document.elementFromPoint(x, y);
        const frame = el?.closest<HTMLElement>('[data-row-id]');
        if (!frame || frame.dataset.rowId === dragging.current) return null;

        const r = frame.getBoundingClientRect();
        const rel = (x - r.left) / r.width;
        if (rel < SIDE_ZONE)
          return { mode: 'column', rowId: frame.dataset.rowId!, side: 'left' };
        if (rel > 1 - SIDE_ZONE)
          return { mode: 'column', rowId: frame.dataset.rowId!, side: 'right' };
        return { mode: 'row', index: Number(frame.dataset.rowIndex) };
      };

      const onMove = (ev: PointerEvent) => {
        const next = targetAt(ev.clientX, ev.clientY);
        target.current = next;
        setDropTarget(next);
      };

      const onUp = (ev: PointerEvent) => {
        window.removeEventListener('pointermove', onMove);
        window.removeEventListener('pointerup', onUp);
        window.removeEventListener('pointercancel', onUp);

        const id = dragging.current;
        // 放開的位置才是真正的落點。若中途完全沒有 move 事件
        // （快速拖曳、事件被合併、自動化操作），這裡補算一次，
        // 免得使用者明明放在對的地方卻什麼都沒發生。
        const t = targetAt(ev.clientX, ev.clientY) ?? target.current;
        dragging.current = null;
        target.current = null;
        setDraggingRowId(null);
        setDropTarget(null);

        if (id && t) commit(id, t);
      };

      window.addEventListener('pointermove', onMove);
      window.addEventListener('pointerup', onUp);
      window.addEventListener('pointercancel', onUp);
      e.preventDefault();
    },
    [setDraggingRowId, setDropTarget, commit]
  );

  return { startDrag };
}
