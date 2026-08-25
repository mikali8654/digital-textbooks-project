import type {
  AudioBlock,
  Block,
  DialogueBlock,
  DocSettings,
  ImageBlock,
  InlineSpan,
  ModuleBlock,
  PopupItem,
  ReferenceBlock,
  Row,
  TextRole,
  VideoBlock,
  WebBlock,
} from './types';

/**
 * 元件屬性的修補。
 *
 * 把各型別的欄位聯集起來再全部變成選填，所以送 { caption } 或
 * { url, presentation } 都能通過型別檢查，但送一個不存在的欄位名不行。
 * 型別對不對得起來由 patchBlock 的 blockType 再擋一次。
 */
export type BlockPatch = Partial<
  Omit<ImageBlock, 'type' | 'id' | 'popups'> &
    Omit<VideoBlock, 'type' | 'id' | 'popups'> &
    Omit<WebBlock, 'type' | 'id' | 'popups'> &
    Omit<AudioBlock, 'type' | 'id' | 'popups'> &
    Omit<DialogueBlock, 'type' | 'id' | 'popups'> &
    Omit<ReferenceBlock, 'type' | 'id' | 'popups'> &
    Omit<ModuleBlock, 'type' | 'id' | 'popups'>
>;

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
  /**
   * 把一欄從多欄的列裡搬出去。
   *
   * 沒有這個動作，兩塊併成兩欄之後就再也拆不開——因為握把是掛在
   * 「列」上的，搬的是整列。老師併錯了會卡住。
   */
  | { type: 'moveColumn'; rowId: string; columnId: string; target: DropTarget }
  | { type: 'setColumnWidths'; rowId: string; widths: number[] }
  | { type: 'setBreakBefore'; rowId: string; value: boolean }
  | { type: 'setText'; blockId: string; text: string }
  /**
   * 連同行內標記一起換掉整段。
   *
   * setText 只能寫純文字，會把注音、重點詞、注釋號洗掉；
   * 行內編輯走這一條，改一個字不會弄丟旁邊的 25 個注釋參照。
   */
  | { type: 'setSpans'; blockId: string; spans: InlineSpan[] }
  /** 對選取範圍加上或拿掉一種行內標記。範圍是字元位置。 */
  | { type: 'toggleMark'; blockId: string; start: number; end: number; mark: 'bold' | 'keyword'; on: boolean }
  | { type: 'setTextRole'; blockId: string; role: TextRole }
  /**
   * 改元件的屬性（圖說、網址、寬度…）。
   *
   * blockType 是給 reducer 對照用的：id 過期或指到別種元件時就整個不動，
   * 免得把 { url } 蓋到一段文字上。
   */
  | { type: 'patchBlock'; blockId: string; blockType: Block['type']; patch: BlockPatch }
  | { type: 'addPopup'; blockId: string; item: PopupItem }
  | { type: 'updatePopup'; blockId: string; item: PopupItem }
  | { type: 'removePopup'; blockId: string; popupId: string }
  | { type: 'reorderPopups'; blockId: string; from: number; to: number };

export type ActionType = Action['type'];

/** 這些動作連續發生時會合併成一次復原，否則打字每個字都要按一次 Cmd+Z。 */
export const COALESCING: ActionType[] = ['setText', 'setSpans', 'setTitle', 'setColumnWidths'];

export const rowOf = (rows: Row[], rowId: string) => rows.find((r) => r.id === rowId) ?? null;
