import type { BlockType, TextRole } from './types';

/**
 * 區塊型別登錄表。
 *
 * 客戶要的「模組＝預留可擴充的空間」在這裡落地：新增一種區塊型別，
 * 只要在 types.ts 的 Block union 加一支、在這裡加一筆，
 * 排版引擎、Pop-up、拖曳都會自動支援，不需要動既有元件。
 * 步驟寫在 HANDOVER.md。
 */
export type BlockMeta = {
  label: string;
  /**
   * 放不下時能不能被切開接到下一頁。
   * 只有文字可以——其他型別放不下就整個移到下一頁。
   */
  splittable: boolean;
  /** 能不能掛 Pop-up。影片／聲音／網頁本身就有互動，不能掛。 */
  canHavePopup: boolean;
  /** 盒狀模組在間距規則裡一律用 24 與前後隔開。 */
  boxLike: boolean;
};

export const blockRegistry: Record<BlockType, BlockMeta> = {
  text: { label: '文字', splittable: true, canHavePopup: true, boxLike: false },
  image: { label: '圖片', splittable: false, canHavePopup: true, boxLike: true },
  video: { label: '影片', splittable: false, canHavePopup: false, boxLike: true },
  audio: { label: '聲音', splittable: false, canHavePopup: false, boxLike: true },
  shape: { label: '圖案', splittable: false, canHavePopup: true, boxLike: true },
  table: { label: '表格', splittable: false, canHavePopup: true, boxLike: true },
  web: { label: '網頁', splittable: false, canHavePopup: false, boxLike: true },
  dialogue: { label: '對話框', splittable: false, canHavePopup: false, boxLike: true },
  reference: { label: '參照', splittable: false, canHavePopup: false, boxLike: false },
  module: { label: '模組', splittable: false, canHavePopup: true, boxLike: true },
  question: { label: '題目', splittable: false, canHavePopup: true, boxLike: true },
};

export const canHavePopup = (t: BlockType) => blockRegistry[t].canHavePopup;
export const isSplittable = (t: BlockType) => blockRegistry[t].splittable;
export const isBoxLike = (t: BlockType) => blockRegistry[t].boxLike;

/**
 * 九種角色在介面上的名字。
 *
 * 刻意用課本的詞彙，不用字級。叫「內文小」老師會拿來塞字——
 * 哪一段是內文、哪一段是補充，是內容的事實，不是排版的偏好；
 * 生字表、朗讀順序、全書搜尋全部依賴這個分類是對的。
 */
export const ROLE_LABEL: Record<TextRole, string> = {
  lessonTitle: '課名',
  sectionTitle: '大標',
  itemTitle: '中標',
  subItemTitle: '小標',
  lead: '導言',
  body: '內文',
  supplement: '補充',
  annotation: '注釋',
  caption: '圖說',
};
