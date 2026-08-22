/**
 * 文件模型。
 *
 * 核心：內容是一條連續的流，頁是算出來的。這裡沒有任何跟「數位頁」有關的欄位，
 * 頁由 paginate() 依可用空間切出來。也沒有 x / y 座標——元件的位置只有
 * 「在流裡的第幾列」和「那一列怎麼分欄」兩個維度。
 *
 * 欄位對應客戶的《教科書 md 標記規格》。兩份文件用同一套詞彙，
 * 對照時不需要翻譯。
 */

// ── 內容角色 ─────────────────────────────────────────────
/**
 * 九種文字角色。字級／行高／字重由角色決定，老師不能逐段調整。
 *
 * 前四個是標題，跟 md 標記規格的四層一一對應：
 *   #    課    → lessonTitle   課名 48/700
 *   ##   區塊  → sectionTitle  大標 36/700
 *   ###  項    → itemTitle     中標 28/700
 *   #### 子項  → subItemTitle  小標 24/700
 *
 * 其餘五個不由階層決定，由內容型別決定（圖說跟著圖、注釋跟著 footnote）。
 */
export type TextRole =
  | 'lessonTitle'
  | 'sectionTitle'
  | 'itemTitle'
  | 'subItemTitle'
  | 'lead' // 導言 20/500
  | 'body' // 內文 18/400（預設）
  | 'supplement' // 補充 16/400
  | 'annotation' // 注釋 14/400
  | 'caption'; // 圖說 12/400

export const HEADING_ROLES: TextRole[] = [
  'lessonTitle',
  'sectionTitle',
  'itemTitle',
  'subItemTitle',
];

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
/** 行內強調。字級不在這裡——字級由角色決定，行內只能改重量、顏色與語意標記。 */
export type InlineSpan = {
  text: string;
  bold?: boolean;
  /** 只允許設計系統的語意色，不是自由選色盤。 */
  color?: 'default' | 'accent' | 'secondary';
  href?: string;
  /**
   * 注音（md 規格的 `{閑|ㄒㄧㄢˊ}`）。
   * MVP 不算繪，但欄位保留——客戶日後接上注音系統時是「補上算繪」，
   * 不是「改資料結構再回填全部教材」。
   */
  ruby?: string;
  /**
   * 重點詞（md 規格的 `==嘉南大圳==`）。
   * 這是語意不是樣式——生字表與全書搜尋都靠它，不能只做成粗體。
   */
  keyword?: boolean;
  /** 注釋參照（md 規格的 `[^1]`）。對應 Doc.footnotes 裡的 id。 */
  footnoteRef?: string;
};

/** 注釋。國文一課可能有二十五條，是內容不是註腳裝飾。 */
export type Footnote = {
  id: string;
  /** 被注釋的詞，例如「何許」。 */
  term: string;
  /** 注釋內容，例如「何處。許，處所。」 */
  body: string;
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
  /** 課本印在旁邊的小標籤，例如題型「快篩訊息」（md 規格的 `@題型[]`）。 */
  label?: string;
};

export type TextBlock = BlockBase & {
  type: 'text';
  role: TextRole;
  spans: InlineSpan[];
};

export type ImageBlock = BlockBase & {
  type: 'image';
  assetId: string | null;
  /**
   * 一張圖上有三種文字，職責不同（md 規格明列）：
   *   alt      圖在傳達什麼資訊，只有螢幕報讀軟體看得到
   *   caption  課本印在圖下面那行字，照抄含課本圖號，所有人看得到
   *   longDesc 複雜圖表的完整說明，alt 裝不下時才用，只有螢幕報讀軟體
   *
   * 圖說要保留課本的編號——社會的圖號每個跨頁重編，不能讓系統自動編。
   */
  alt: string;
  caption: string;
  longDescription?: string;
  aspectRatio: number;
};

export type VideoBlock = BlockBase & {
  type: 'video';
  source: 'upload' | 'youtube';
  ref: string;
  title: string;
  /** 字幕檔（md 規格的 `{字幕=video/x.vtt}`）。無障礙需要。 */
  captionsRef?: string;
};

export type AudioBlock = BlockBase & {
  type: 'audio';
  assetId: string | null;
  title: string;
};

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
  /**
   * 書籤是一張小卡片；嵌入是一個完整的網頁框；
   * qr 是課本印的 QR 碼（md 規格的 `@連結[](url){QR}`）。
   */
  presentation: 'bookmark' | 'embed' | 'qr';
};

/** 對話框。社會的課首情境圖、國文的角色對白都是真內容，不是裝飾。 */
export type DialogueBlock = BlockBase & {
  type: 'dialogue';
  speaker: string;
  text: string;
};

/** 頁尾參照，例如「配合習作第 24〜25 頁」。 */
export type ReferenceBlock = BlockBase & {
  type: 'reference';
  target: string;
  pages: string;
};

/**
 * 互動模組。版面上跨課重複出現、由系統產生的元件，
 * 例如國文頁側的朝代時間軸——它每一課都出現，只是反白的朝代不同。
 * 同時也是客戶要的「預留擴充空間」。
 */
export type ModuleBlock = BlockBase & {
  type: 'module';
  moduleKind: string | null;
  title?: string;
};

export type Block =
  | TextBlock
  | ImageBlock
  | VideoBlock
  | AudioBlock
  | ShapeBlock
  | TableBlock
  | WebBlock
  | DialogueBlock
  | ReferenceBlock
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
  /**
   * 紙本原頁碼（md 規格的 `@頁[91]`）。
   *
   * ⚠️ 這是錨點，不是換頁線，兩者完全獨立。數位頁是 4:3、字級固定、
   * 間距放鬆，裝的資訊量跟紙本跨頁本來就不同，老師還會插補充、移圖片——
   * 數位頁與紙本頁不會一致，也不應該一致。
   *
   * 它的用途是查表：老師說「翻到 93 頁」時，找到 printPage 為 93 的列，
   * 再看它落在數位的第幾頁。一個紙本頁可以橫跨兩個數位頁，反之亦然。
   */
  printPage?: number;
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

/** 來自 md frontmatter，用於書目與查找，不影響排版。 */
export type DocMeta = {
  sourceId?: string;
  publisher?: string;
  stage?: string;
  grade?: string;
  term?: string;
  subject?: string;
  unit?: string;
  /** 紙本課本的頁碼範圍，例如 [90, 97]。 */
  printPageRange?: [number, number];
};

export type Doc = {
  id: string;
  title: string;
  settings: DocSettings;
  meta: DocMeta;
  rows: Row[];
  /** 注釋表。InlineSpan.footnoteRef 指向這裡的 id。 */
  footnotes: Footnote[];
  /**
   * 書與單元。MVP 的介面不做這兩層，欄位先留著，
   * 之後接上整本書的管理不需要改結構。
   */
  bookId: string | null;
  unitId: string | null;
};
