/**
 * 文件模型。
 *
 * 核心：內容是一條連續的流，頁是算出來的。這裡沒有任何跟「頁」有關的欄位，
 * 頁由 paginate() 依可用高度切出來。也沒有 x / y 座標——元件的位置只有
 * 「在流裡的第幾列」和「那一列怎麼分欄」兩個維度。
 */

// ── 內容角色 ─────────────────────────────────────────────
/** 九種文字角色。字級／行高／字重由角色決定，老師不能逐段調整。 */
export type TextRole =
  | 'lessonTitle' // 課名 48/700
  | 'h1' // 大標 36/700 — 自動切頁的依據
  | 'h2' // 中標 28/700 — 自動切頁的依據
  | 'h3' // 小標 24/700
  | 'lead' // 導言 20/500
  | 'body' // 內文 18/400（預設）
  | 'supplement' // 補充 16/400
  | 'annotation' // 注釋 14/400
  | 'caption'; // 圖說 12/400

/**
 * 內容分類。這是「系統讀不讀得懂教材」的關鍵欄位——沒有它，
 * 生字表、全書搜尋、正確順序的朗讀都做不到。
 *
 * ⚠️ 暫定值。客戶尚未提供正式清單，取值範圍確定後只需要改這個 union，
 * 資料結構不受影響。詳見 HANDOVER.md。
 */
export type ContentCategory =
  | 'courseText'
  | 'annotation'
  | 'vocabulary'
  | 'objective'
  | 'activity'
  | 'exercise'
  | 'caption'
  | 'extension';

// ── 行內 ─────────────────────────────────────────────────
/** 行內強調。字級不在這裡——字級由角色決定，行內只能改重量與顏色。 */
export type InlineSpan = {
  text: string;
  bold?: boolean;
  /** 只允許設計系統的語意色，不是自由選色盤。 */
  color?: 'default' | 'accent' | 'secondary';
  href?: string;
  /**
   * 注音。MVP 不算繪，但欄位保留——客戶日後接上注音系統時是「補上算繪」，
   * 不是「改資料結構再回填全部教材」。
   */
  ruby?: string;
};

// ── Pop-up ───────────────────────────────────────────────
/**
 * Pop-up 是元件的屬性，不是第十種元件。一個元件可以掛多個。
 *
 * 行為規則（無例外、不依數量變化）：有掛補充就開檢視器，
 * 每一項的行動鈕依它自己的 kind 決定。
 */
export type PopupItem =
  | { id: string; kind: 'text'; title: string; body: string }
  | { id: string; kind: 'image'; title: string; assetId: string | null }
  | {
      id: string;
      kind: 'video';
      title: string;
      /** YouTube 走白名單比對，能在檢視台裡直接播；上傳檔案同理。 */
      source: 'upload' | 'youtube';
      ref: string;
    }
  | { id: string; kind: 'audio'; title: string; assetId: string | null }
  | {
      id: string;
      kind: 'web';
      title: string;
      url: string;
      /**
       * 能否在頁內嵌入。MVP 恆為 false——真實判斷要看對方的
       * X-Frame-Options / CSP，那是伺服器端的檢查，屬於客戶的 API。
       * 接上之後把這個欄位打開就有頁內瀏覽，不必改資料結構或檢視器。
       */
      embeddable: boolean;
    }
  | { id: string; kind: 'jump'; title: string; targetRowId: string | null };

export type PopupKind = PopupItem['kind'];

// ── 區塊 ─────────────────────────────────────────────────
type BlockBase = {
  id: string;
  /** 掛在這個元件上的補充，順序可拖曳調整。 */
  popups: PopupItem[];
  category?: ContentCategory;
};

export type TextBlock = BlockBase & {
  type: 'text';
  role: TextRole;
  spans: InlineSpan[];
};

export type ImageBlock = BlockBase & {
  type: 'image';
  assetId: string | null;
  /** 圖說是常駐顯示的一行小字，跟 Pop-up 是兩個層級，可以並存。 */
  caption: string;
  aspectRatio: number;
};

export type VideoBlock = BlockBase & {
  type: 'video';
  source: 'upload' | 'youtube';
  ref: string;
};

export type AudioBlock = BlockBase & { type: 'audio'; assetId: string | null };

export type ShapeBlock = BlockBase & {
  type: 'shape';
  shape: 'rect' | 'circle';
  label: string;
};

export type TableBlock = BlockBase & {
  type: 'table';
  rows: number;
  cols: number;
  cells: string[][];
  hasHeader: boolean;
};

export type WebBlock = BlockBase & {
  type: 'web';
  url: string;
  title: string;
  /** 書籤是一張小卡片；嵌入是一個完整的網頁框。 */
  presentation: 'bookmark' | 'embed';
};

/** 客戶要的「預留擴充空間」。本身不是功能，是佔位。 */
export type ModuleBlock = BlockBase & { type: 'module'; moduleKind: string | null };

export type Block =
  | TextBlock
  | ImageBlock
  | VideoBlock
  | AudioBlock
  | ShapeBlock
  | TableBlock
  | WebBlock
  | ModuleBlock;

export type BlockType = Block['type'];

// ── 流 ───────────────────────────────────────────────────
export type Column = {
  id: string;
  /** 佔該列寬度的百分比。同一列的總和恆為 100。 */
  widthPct: number;
  blocks: Block[];
};

export type Row = {
  id: string;
  /** 一到三欄。 */
  columns: Column[];
  /**
   * 使用者自己放的換頁線：這一列一定從新的一頁開始，位置不隨內容移動。
   * 系統放的換頁線不存在資料裡——那是 paginate() 算出來的。
   */
  breakBefore: boolean;
};

// ── 整本設定 ─────────────────────────────────────────────
export type DocSettings = {
  /** 決定文字方向、版面配置與翻頁方向。整本一致，不能逐頁改。 */
  writingMode: 'horizontal' | 'vertical';
  /** 預設 4:3——橫置平板全部比 4:3 寬，4:3 能用滿垂直空間。 */
  aspectRatio: '4:3' | '16:9';
  /**
   * 整本的字級檔位，所有角色一起等比縮放。
   * 這是老師面對未知平板尺寸唯一的補償手段，不是裝飾性設定。
   */
  textScale: 'sm' | 'md' | 'lg';
};

export type Doc = {
  id: string;
  title: string;
  settings: DocSettings;
  rows: Row[];
  /**
   * 書與單元。MVP 的介面不做這兩層，欄位先留著，
   * 之後接上整本書的管理不需要改結構。
   */
  bookId: string | null;
  unitId: string | null;
};
