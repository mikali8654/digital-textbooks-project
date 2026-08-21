import type { Block, DocSettings, PopupItem, Row, TextRole } from './types';

/**
 * 拖曳的落點只有兩種，因為版面沒有自由畫布：
 * - row：插進順序裡，自成一列、佔滿整寬
 * - column：跟旁邊的元件併成同一列的兩欄
 */
export type DropTarget =
  | { mode: 'row'; index: number }
  | { mode: 'column'; rowId: string; side: 'left' | 'right' };

export type Action =
  | { type: 'setTitle'; title: string }
  | { type: 'setSettings'; patch: Partial<DocSettings> }
  | { type: 'insertRow'; index: number; blocks: Block[] }
  | { type: 'deleteRow'; rowId: string }
  | { type: 'moveRow'; rowId: string; target: DropTarget }
  | { type: 'setColumnWidths'; rowId: string; widths: number[] }
  | { type: 'setBreakBefore'; rowId: string; value: boolean }
  | { type: 'setText'; blockId: string; text: string }
  | { type: 'setTextRole'; blockId: string; role: TextRole }
  | { type: 'addPopup'; blockId: string; item: PopupItem }
  | { type: 'updatePopup'; blockId: string; item: PopupItem }
  | { type: 'removePopup'; blockId: string; popupId: string }
  | { type: 'reorderPopups'; blockId: string; from: number; to: number };

export type ActionType = Action['type'];

/** 這些動作連續發生時會合併成一次復原，否則打字每個字都要按一次 Cmd+Z。 */
export const COALESCING: ActionType[] = ['setText', 'setTitle', 'setColumnWidths'];

export const rowOf = (rows: Row[], rowId: string) => rows.find((r) => r.id === rowId) ?? null;
