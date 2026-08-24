import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { useRowDrag, type DragSubject } from './useRowDrag';
import type { DropTarget } from '../model/actions';
import type { useEditor } from '../hooks/useEditor';

type Editor = ReturnType<typeof useEditor>;

export type EditorUI = {
  /** 目前選中的元件。選取外框由它決定。 */
  selectedBlockId: string | null;
  select: (blockId: string | null) => void;

  /**
   * 展開插入面板的位置＝要插在 doc.rows 的第幾個之前。
   * null 代表沒有展開——插入點平常是安靜的，滑過才浮現提示，按下才展開。
   */
  insertAt: number | null;
  openInsert: (index: number | null) => void;

  /** 正在被拖曳的列。 */
  draggingRowId: string | null;
  setDraggingRowId: (id: string | null) => void;

  /** 目前滑過的落點。落點是離散的幾個，不是連續平面。 */
  dropTarget: DropTarget | null;
  setDropTarget: (t: DropTarget | null) => void;

  /** 從握把開始拖曳。 */
  startDrag: (e: PointerEvent, subject: DragSubject) => void;
};

const Ctx = createContext<(Editor & EditorUI) | null>(null);

export function EditorProvider({ editor, children }: { editor: Editor; children: ReactNode }) {
  const [selectedBlockId, select] = useState<string | null>(null);
  const [insertAt, openInsert] = useState<number | null>(null);
  const [draggingRowId, setDraggingRowId] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<DropTarget | null>(null);

  const commit = useCallback(
    (subject: DragSubject, target: DropTarget) =>
      editor.dispatch(
        subject.columnId
          ? { type: 'moveColumn', rowId: subject.rowId, columnId: subject.columnId, target }
          : { type: 'moveRow', rowId: subject.rowId, target }
      ),
    [editor]
  );
  const { startDrag } = useRowDrag(setDraggingRowId, setDropTarget, commit);

  const value = useMemo(
    () => ({
      ...editor,
      selectedBlockId,
      select,
      insertAt,
      openInsert,
      draggingRowId,
      setDraggingRowId,
      dropTarget,
      setDropTarget,
      startDrag,
    }),
    [editor, selectedBlockId, insertAt, draggingRowId, dropTarget, startDrag]
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

/** 唯讀（預覽模式）時回傳 null，元件據此關掉所有編輯行為。 */
export function useEditorCtx() {
  return useContext(Ctx);
}
