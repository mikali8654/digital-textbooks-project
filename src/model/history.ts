import { COALESCING, type Action } from './actions';
import { applyAction } from './reducer';
import type { Doc } from './types';

/**
 * 復原／重做。
 *
 * 這不是一個「功能」，是純 reducer 的副產品——因為 applyAction 不碰外部狀態，
 * 保留每一步的文件快照就能來回。同樣的性質也讓自動儲存變成只要監看 present。
 */
export type History = {
  past: Doc[];
  present: Doc;
  future: Doc[];
  /** 上一個動作的識別，用來判斷連續的編輯要不要合併成一次復原。 */
  lastMark: string | null;
  lastAt: number;
};

/** 連續打字在這個時間內算同一次編輯。 */
export const COALESCE_WINDOW_MS = 800;

/** 上限只是為了不讓長時間編輯無限吃記憶體，正常使用碰不到。 */
const MAX_DEPTH = 200;

export function initHistory(doc: Doc): History {
  return { past: [], present: doc, future: [], lastMark: null, lastAt: 0 };
}

const markOf = (action: Action): string | null => {
  if (!COALESCING.includes(action.type)) return null;
  const target =
    'blockId' in action ? action.blockId : 'rowId' in action ? action.rowId : 'doc';
  return `${action.type}:${target}`;
};

export function dispatch(history: History, action: Action, now = Date.now()): History {
  const next = applyAction(history.present, action);
  if (next === history.present) return history;

  const mark = markOf(action);
  const coalesce =
    mark !== null && mark === history.lastMark && now - history.lastAt < COALESCE_WINDOW_MS;

  // 合併時不推新的歷史點，直接換掉 present——連續打字才會是一次復原
  const past = coalesce ? history.past : [...history.past, history.present].slice(-MAX_DEPTH);

  return { past, present: next, future: [], lastMark: mark, lastAt: now };
}

export const canUndo = (h: History) => h.past.length > 0;
export const canRedo = (h: History) => h.future.length > 0;

export function undo(history: History): History {
  if (!canUndo(history)) return history;
  const past = history.past.slice();
  const present = past.pop()!;
  return {
    past,
    present,
    future: [history.present, ...history.future],
    lastMark: null,
    lastAt: 0,
  };
}

export function redo(history: History): History {
  if (!canRedo(history)) return history;
  const [present, ...future] = history.future;
  return {
    past: [...history.past, history.present],
    present,
    future,
    lastMark: null,
    lastAt: 0,
  };
}
