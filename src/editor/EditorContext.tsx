import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { useRowDrag, type DragSubject } from './useRowDrag';
import type { DropTarget } from '../model/actions';
import type { Block } from '../model/types';
import { usePopupViewer } from '../viewer/PopupViewer';
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

  /**
   * 目前選起來的那一段字，以及它屬於哪個元件。
   *
   * slice 是這個片段在原文的位置——段落被切到第二頁時，畫面上的
   * 第 0 個字並不是原文的第 0 個字，套用標記前要先加回去。
   */
  inlineSelection: InlineSelection | null;
  setInlineSelection: (s: InlineSelection | null) => void;

  /**
   * 補充設定面板開在哪個元件上。null 代表沒開。
   *
   * 跟 selectedBlockId 分開存：選取是「我在看這一塊」，開面板是
   * 「我要編它的補充」。合成一個的話，選別的元件面板就會亂跳。
   */
  popupFor: string | null;
  openPopupPanel: (blockId: string | null) => void;

  /** 用學生看到的樣子預覽這個元件的補充。 */
  previewPopups: (block: Block) => void;

  /** 從握把開始拖曳。 */
  startDrag: (e: PointerEvent, subject: DragSubject) => void;
};

export type InlineSelection = {
  blockId: string;
  range: { start: number; end: number };
  slice?: { start: number; end: number };
};

const Ctx = createContext<(Editor & EditorUI) | null>(null);

export function EditorProvider({ editor, children }: { editor: Editor; children: ReactNode }) {
  const [selectedBlockId, select] = useState<string | null>(null);
  const [insertAt, openInsert] = useState<number | null>(null);
  const [draggingRowId, setDraggingRowId] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<DropTarget | null>(null);
  const [inlineSelection, setInlineSelection] = useState<InlineSelection | null>(null);
  const [popupFor, openPopupPanel] = useState<string | null>(null);
  const viewer = usePopupViewer();
  const previewPopups = useCallback((b: Block) => viewer?.open(b), [viewer]);

  // 讓檢視器知道「編輯」該做什麼。只有編輯模式會註冊，
  // 學生端與預覽沒有人註冊，檢視器上就不會出現那顆按鈕。
  useEffect(() => {
    viewer?.registerEdit(openPopupPanel);
    return () => viewer?.registerEdit(null);
  }, [viewer]);

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
      inlineSelection,
      setInlineSelection,
      popupFor,
      openPopupPanel,
      previewPopups,
      startDrag,
    }),
    [
      editor,
      selectedBlockId,
      insertAt,
      draggingRowId,
      dropTarget,
      inlineSelection,
      popupFor,
      previewPopups,
      startDrag,
    ]
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

/** 唯讀（預覽模式）時回傳 null，元件據此關掉所有編輯行為。 */
export function useEditorCtx() {
  return useContext(Ctx);
}
