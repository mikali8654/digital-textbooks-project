import { useCallback, useRef } from 'react';
import type { DropTarget } from '../model/actions';

/**
 * 拖曳重排，用 pointer events。
 *
 * 刻意不用 HTML5 的 drag-and-drop：它在觸控裝置上完全不能用，
 * 而老師是用平板的；它還需要 dataTransfer.setData() 才會啟動，
 * 漏了就安靜地什麼都不發生。
 *
 * 落點只有三種，因為版面沒有自由畫布：
 *  - 靠近某列的左右外緣 → 跟它併成兩欄
 *  - 其餘位置           → 依上下半決定插在那一列之前或之後
 */

/**
 * 併欄感應區的寬度（px）。
 *
 * 曾經用「列寬的 28%」，結果一列有超過一半的面積都在併欄區，
 * 而握把又在最左邊——往下拖的路徑整條都在左側感應區裡，
 * 上下換位幾乎觸發不了。改成固定寬度，讓絕大部分的面積是「換位」。
 */
const SIDE_ZONE_PX = 72;

/** 超過這個距離才算拖曳，否則只是點一下握把。 */
const DRAG_THRESHOLD_PX = 4;

export type DragApi = {
  startDrag: (e: PointerEvent, rowId: string) => void;
};

/** 跟著游標的殘影。讓人知道「我正握著這一塊」。 */
function makeGhost(source: HTMLElement): HTMLElement {
  const r = source.getBoundingClientRect();
  const ghost = source.cloneNode(true) as HTMLElement;
  ghost.removeAttribute('data-row-id');
  ghost.querySelectorAll('[contenteditable]').forEach((n) => {
    (n as HTMLElement).contentEditable = 'false';
  });
  Object.assign(ghost.style, {
    position: 'fixed',
    left: '0',
    top: '0',
    width: `${r.width}px`,
    margin: '0',
    pointerEvents: 'none',
    zIndex: '9999',
    opacity: '0.9',
    background: 'var(--ds-surface-raised)',
    border: '1px solid var(--ds-border-accent)',
    borderRadius: '12px',
    padding: '8px 12px',
    boxShadow: '0 18px 40px rgba(26, 25, 23, 0.24)',
    transformOrigin: 'top left',
  });
  document.body.appendChild(ghost);
  return ghost;
}

export function useRowDrag(
  setDraggingRowId: (id: string | null) => void,
  setDropTarget: (t: DropTarget | null) => void,
  commit: (rowId: string, target: DropTarget) => void
): DragApi {
  const target = useRef<DropTarget | null>(null);
  const dragging = useRef<string | null>(null);

  const startDrag = useCallback(
    (e: PointerEvent, rowId: string) => {
      const handle = e.currentTarget as HTMLElement | null;
      const source = (e.target as HTMLElement).closest<HTMLElement>('[data-row-id]');
      const startX = e.clientX;
      const startY = e.clientY;

      let started = false;
      let ghost: HTMLElement | null = null;
      let offsetX = 0;
      let offsetY = 0;

      const targetAt = (x: number, y: number): DropTarget | null => {
        // 殘影會擋住命中測試，先請它讓開
        if (ghost) ghost.style.visibility = 'hidden';
        const el = document.elementFromPoint(x, y);
        if (ghost) ghost.style.visibility = '';

        const frame = el?.closest<HTMLElement>('[data-row-id]');
        if (!frame || frame.dataset.rowId === dragging.current) return null;

        const r = frame.getBoundingClientRect();
        const index = Number(frame.dataset.rowIndex);

        // 左右外緣才是併欄，而且用固定寬度不是比例
        if (x - r.left < SIDE_ZONE_PX)
          return { mode: 'column', rowId: frame.dataset.rowId!, side: 'left' };
        if (r.right - x < SIDE_ZONE_PX)
          return { mode: 'column', rowId: frame.dataset.rowId!, side: 'right' };

        // 上半插在它之前、下半插在它之後——這樣拖到哪裡就落在哪裡
        const after = y > r.top + r.height / 2;
        return { mode: 'row', index: after ? index + 1 : index };
      };

      const onMove = (ev: PointerEvent) => {
        if (!started) {
          const moved = Math.hypot(ev.clientX - startX, ev.clientY - startY);
          if (moved < DRAG_THRESHOLD_PX) return;
          started = true;
          dragging.current = rowId;
          setDraggingRowId(rowId);
          if (source) {
            const r = source.getBoundingClientRect();
            offsetX = startX - r.left;
            offsetY = startY - r.top;
            ghost = makeGhost(source);
          }
        }

        if (ghost) {
          ghost.style.transform = `translate(${ev.clientX - offsetX}px, ${ev.clientY - offsetY}px)`;
        }
        const next = targetAt(ev.clientX, ev.clientY);
        target.current = next;
        setDropTarget(next);
      };

      const finish = (ev: PointerEvent) => {
        window.removeEventListener('pointermove', onMove);
        window.removeEventListener('pointerup', finish);
        window.removeEventListener('pointercancel', finish);
        try {
          handle?.releasePointerCapture?.(ev.pointerId);
        } catch {
          /* 沒捕捉到就沒得釋放 */
        }

        // 放開的位置才是真正的落點。中途若完全沒有 move 事件
        // （拖太快、事件被合併），這裡補算一次。
        const t = started ? (targetAt(ev.clientX, ev.clientY) ?? target.current) : null;
        const id = dragging.current;

        ghost?.remove();
        ghost = null;
        dragging.current = null;
        target.current = null;
        setDraggingRowId(null);
        setDropTarget(null);

        if (id && t) commit(id, t);
      };

      // 抓住指標，滑出視窗也不會卡在拖曳中。
      // 包在 try 裡是因為它會對無效的 pointerId 丟例外——
      // 若讓它往外拋，下面的監聽就不會註冊，整個拖曳靜靜地失效。
      // 指標捕捉只是加強，不是拖曳能否運作的前提。
      try {
        handle?.setPointerCapture?.(e.pointerId);
      } catch {
        /* 沒有捕捉也能拖，只是滑出視窗時可能中斷 */
      }
      window.addEventListener('pointermove', onMove);
      window.addEventListener('pointerup', finish);
      window.addEventListener('pointercancel', finish);
      e.preventDefault();
    },
    [setDraggingRowId, setDropTarget, commit]
  );

  return { startDrag };
}
