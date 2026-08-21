import { canHavePopup } from './registry';
import { newId } from './ids';
import type { Action, DropTarget } from './actions';
import type { Block, Column, Doc, Row } from './types';

/** 同一列的欄寬總和恆為 100。 */
function normalizeWidths(columns: Column[]): Column[] {
  const total = columns.reduce((s, c) => s + c.widthPct, 0) || 1;
  return columns.map((c) => ({ ...c, widthPct: (c.widthPct / total) * 100 }));
}

function mapBlock(doc: Doc, blockId: string, fn: (b: Block) => Block): Doc {
  let touched = false;
  const rows = doc.rows.map((row) => ({
    ...row,
    columns: row.columns.map((col) => ({
      ...col,
      blocks: col.blocks.map((b) => {
        if (b.id !== blockId) return b;
        touched = true;
        return fn(b);
      }),
    })),
  }));
  return touched ? { ...doc, rows } : doc;
}

/** 抽出一列，回傳剩下的列與被抽出的那一列。 */
function detachRow(rows: Row[], rowId: string): { rest: Row[]; taken: Row | null } {
  const taken = rows.find((r) => r.id === rowId) ?? null;
  return { rest: rows.filter((r) => r.id !== rowId), taken };
}

function applyDrop(rows: Row[], moved: Row, target: DropTarget): Row[] {
  if (target.mode === 'row') {
    const index = Math.max(0, Math.min(target.index, rows.length));
    const next = rows.slice();
    // 併回單欄：插進順序裡就是佔滿整寬
    next.splice(index, 0, {
      ...moved,
      columns: normalizeWidths([
        { id: newId('col'), widthPct: 100, blocks: moved.columns.flatMap((c) => c.blocks) },
      ]),
    });
    return next;
  }

  return rows.map((row) => {
    if (row.id !== target.rowId) return row;
    const incoming: Column = {
      id: newId('col'),
      widthPct: 100 / (row.columns.length + 1),
      blocks: moved.columns.flatMap((c) => c.blocks),
    };
    const columns =
      target.side === 'left' ? [incoming, ...row.columns] : [...row.columns, incoming];
    // 併欄之後平均分配寬度；使用者可以再拖分隔線調整
    const even = columns.map((c) => ({ ...c, widthPct: 100 / columns.length }));
    return { ...row, columns: normalizeWidths(even) };
  });
}

/** 移除空掉的欄與空掉的列，避免拖曳之後留下看不見的殘骸。 */
function prune(rows: Row[]): Row[] {
  return rows
    .map((row) => {
      const columns = row.columns.filter((c) => c.blocks.length > 0);
      return columns.length === row.columns.length
        ? row
        : { ...row, columns: normalizeWidths(columns) };
    })
    .filter((row) => row.columns.length > 0);
}

/**
 * 純 reducer：同樣的輸入永遠得到同樣的輸出，不碰任何外部狀態。
 * 復原／重做與自動儲存都建立在這個性質上。
 */
export function applyAction(doc: Doc, action: Action): Doc {
  switch (action.type) {
    case 'setTitle':
      return { ...doc, title: action.title };

    case 'setSettings':
      return { ...doc, settings: { ...doc.settings, ...action.patch } };

    case 'insertRow': {
      const index = Math.max(0, Math.min(action.index, doc.rows.length));
      const rows = doc.rows.slice();
      rows.splice(index, 0, {
        id: newId('row'),
        breakBefore: false,
        columns: [{ id: newId('col'), widthPct: 100, blocks: action.blocks }],
      });
      return { ...doc, rows };
    }

    case 'deleteRow': {
      const rows = doc.rows.filter((r) => r.id !== action.rowId);
      // 沒刪到東西就回傳原本的文件，否則會佔掉一次復原
      return rows.length === doc.rows.length ? doc : { ...doc, rows };
    }

    case 'moveRow': {
      const { rest, taken } = detachRow(doc.rows, action.rowId);
      if (!taken) return doc;
      return { ...doc, rows: prune(applyDrop(rest, taken, action.target)) };
    }

    case 'setColumnWidths':
      return {
        ...doc,
        rows: doc.rows.map((row) =>
          row.id === action.rowId && action.widths.length === row.columns.length
            ? {
                ...row,
                columns: normalizeWidths(
                  row.columns.map((c, i) => ({ ...c, widthPct: action.widths[i] }))
                ),
              }
            : row
        ),
      };

    case 'setBreakBefore': {
      const target = doc.rows.find((r) => r.id === action.rowId);
      if (!target || target.breakBefore === action.value) return doc;
      return {
        ...doc,
        rows: doc.rows.map((r) =>
          r.id === action.rowId ? { ...r, breakBefore: action.value } : r
        ),
      };
    }

    case 'setText':
      return mapBlock(doc, action.blockId, (b) =>
        b.type === 'text' ? { ...b, spans: [{ text: action.text }] } : b
      );

    case 'setTextRole':
      return mapBlock(doc, action.blockId, (b) =>
        b.type === 'text' ? { ...b, role: action.role } : b
      );

    case 'addPopup':
      return mapBlock(doc, action.blockId, (b) =>
        canHavePopup(b.type) ? { ...b, popups: [...b.popups, action.item] } : b
      );

    case 'updatePopup':
      return mapBlock(doc, action.blockId, (b) => ({
        ...b,
        popups: b.popups.map((p) => (p.id === action.item.id ? action.item : p)),
      }));

    case 'removePopup':
      return mapBlock(doc, action.blockId, (b) => ({
        ...b,
        popups: b.popups.filter((p) => p.id !== action.popupId),
      }));

    case 'reorderPopups':
      return mapBlock(doc, action.blockId, (b) => {
        const popups = b.popups.slice();
        const [moved] = popups.splice(action.from, 1);
        if (!moved) return b;
        popups.splice(action.to, 0, moved);
        return { ...b, popups };
      });

    default: {
      const never: never = action;
      return never;
    }
  }
}
