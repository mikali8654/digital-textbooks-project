import type { Measurer, PageOptions } from './paginate';
import type { Block, TextBlock, TextRole } from './types';

/**
 * 測試用的假量測器：不需要 DOM，結果完全可預期。
 *
 * 規則刻意簡化——每行固定 30 個字、行高依角色而定，其他型別給固定高度。
 * 真正的量測會在 D2 用瀏覽器排版做，介面（Measurer）保持不變。
 */
const LINE_HEIGHT: Record<TextRole, number> = {
  lessonTitle: 56,
  sectionTitle: 44,
  itemTitle: 36,
  subItemTitle: 32,
  lead: 30,
  body: 28,
  supplement: 26,
  annotation: 22,
  caption: 18,
};

const FIXED_HEIGHT: Record<string, number> = {
  image: 200,
  video: 200,
  audio: 56,
  shape: 120,
  table: 160,
  web: 96,
  dialogue: 72,
  reference: 32,
  module: 120,
};

export const CHARS_PER_LINE = 30;

export const fakeMeasurer: Measurer = {
  textLineSizes(block: TextBlock) {
    const chars = block.spans.map((s) => s.text).join('').length;
    const count = Math.max(1, Math.ceil(chars / CHARS_PER_LINE));
    return Array.from({ length: count }, () => LINE_HEIGHT[block.role]);
  },
  blockSize(block: Block, inlineSize: number, maxBlockSize: number) {
    if (block.type === 'text') {
      return fakeMeasurer.textLineSizes(block, inlineSize).reduce((a, b) => a + b, 0);
    }
    // 盒狀模組比一頁還大時等比縮到放得進去
    return Math.min(FIXED_HEIGHT[block.type] ?? 100, maxBlockSize);
  },
};

export const pageOptions: PageOptions = {
  contentInlineSize: 720,
  contentBlockSize: 400,
  columnGap: 16,
};

/** 產生指定行數的文字，方便測分頁。 */
export const linesOfText = (lines: number) => '字'.repeat(CHARS_PER_LINE * lines);
