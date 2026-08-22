import { isBoxLike } from './registry';
import { HEADING_ROLES } from './types';
import type { Block, Row, TextRole } from './types';

/**
 * 間距編碼「歸屬」：相鄰兩塊越相關，垂直間距越小；越是換模組、換節，間距越大。
 * 全部取自設計系統的間距階。
 */
export const GAP = {
  /** 緊貼：標題與其正文／導言 */
  tight: 8,
  /** 附屬：正文與其注釋、圖與其圖說 */
  attached: 12,
  /** 連續：同一節內相鄰的正文段落 */
  continuous: 16,
  /** 換模組：圖、書籤卡、表格等盒狀模組前後 */
  module: 24,
  /** 換頁線：換頁記號的上下留白（編輯畫面用，不影響分頁計算） */
  pageBreak: 32,
  /** 換節：進入新的大標／中標 */
  section: 48,
} as const;

// 四個標題角色對應 md 標記規格的 課 / 區塊 / 項 / 子項

const firstBlock = (row: Row): Block | null => row.columns[0]?.blocks[0] ?? null;
const lastBlock = (row: Row): Block | null => {
  const col = row.columns[row.columns.length - 1];
  return col?.blocks[col.blocks.length - 1] ?? null;
};

const roleOf = (b: Block | null): TextRole | null =>
  b && b.type === 'text' ? b.role : null;

const rowIsBoxLike = (row: Row): boolean =>
  row.columns.some((c) => c.blocks.some((b) => isBoxLike(b.type)));

/**
 * 前一列與這一列之間該留多少。
 *
 * 判斷順序有意義：先問「這兩塊是不是同一件事」，是就取小值，否則取大值。
 * 換節永遠最大，讓大標自帶呼吸。
 */
export function gapBefore(prev: Row | null, next: Row): number {
  if (!prev) return 0;

  const nextRole = roleOf(firstBlock(next));
  const prevRole = roleOf(lastBlock(prev));

  // 換節：進入新的大標或中標，永遠最大
  if (nextRole === 'sectionTitle' || nextRole === 'itemTitle') return GAP.section;

  // 附屬：圖說跟著它的圖、注釋跟著它的正文
  if (nextRole === 'caption' || nextRole === 'annotation') return GAP.attached;

  // 換模組：盒狀模組一律用固定間距與前後隔開，不因內容多寡改變
  if (rowIsBoxLike(next) || rowIsBoxLike(prev)) return GAP.module;

  // 緊貼：標題與它自己的內文或導言
  if (prevRole && HEADING_ROLES.includes(prevRole)) return GAP.tight;

  // 連續：同一節內相鄰的段落
  return GAP.continuous;
}
