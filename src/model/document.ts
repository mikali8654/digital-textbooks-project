import { newId } from './ids';
import type {
  Block,
  Column,
  Doc,
  InlineSpan,
  Row,
  TextBlock,
  TextRole,
} from './types';

export function makeColumn(blocks: Block[], widthPct = 100): Column {
  return { id: newId('col'), widthPct, blocks };
}

/** 插入永遠先自成一列；要併欄是之後拖曳的結果，不是插入時決定的。 */
export function makeRow(blocks: Block[], breakBefore = false): Row {
  return { id: newId('row'), columns: [makeColumn(blocks)], breakBefore };
}

export function makeText(text: string, role: TextRole = 'body'): TextBlock {
  return { id: newId('blk'), type: 'text', role, popups: [], spans: [{ text }] };
}

export function textOf(block: TextBlock): string {
  return block.spans.map((s) => s.text).join('');
}

/** 把純文字放回單一 span。行內樣式會被清掉，呼叫端要自己判斷是否可接受。 */
export function setPlainText(block: TextBlock, text: string): TextBlock {
  return { ...block, spans: [{ text }] };
}

export function spansToPlain(spans: InlineSpan[]): string {
  return spans.map((s) => s.text).join('');
}

export function emptyDoc(title = '未命名教材'): Doc {
  return {
    id: newId('doc'),
    title,
    settings: { writingMode: 'horizontal', aspectRatio: '4:3', textScale: 'md' },
    meta: {},
    rows: [makeRow([makeText('', 'lessonTitle')])],
    footnotes: [],
    bookId: null,
    unitId: null,
  };
}

/** 依序走訪所有區塊。朗讀順序與全書搜尋都靠這個順序，不是畫面位置。 */
export function* walkBlocks(doc: Doc): Generator<{ row: Row; column: Column; block: Block }> {
  for (const row of doc.rows) {
    for (const column of row.columns) {
      for (const block of column.blocks) {
        yield { row, column, block };
      }
    }
  }
}

export function findBlock(doc: Doc, blockId: string) {
  for (const hit of walkBlocks(doc)) {
    if (hit.block.id === blockId) return hit;
  }
  return null;
}
