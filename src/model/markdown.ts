import { newId } from './ids';
import { parseInline } from './inline';
import type {
  InlineSpan,
  Block,
  Doc,
  DocMeta,
  DocSettings,
  Footnote,
  Row,
  TextRole,
} from './types';

/**
 * md 匯入。對應客戶的《教科書 md 標記規格》。
 *
 * 四層標題與文字角色一一對應，兩份文件用同一套詞彙：
 *   #    課    → lessonTitle
 *   ##   區塊  → sectionTitle
 *   ###  項    → itemTitle
 *   #### 子項  → subItemTitle
 */

const HEADING_BY_LEVEL: Record<number, TextRole> = {
  1: 'lessonTitle',
  2: 'sectionTitle',
  3: 'itemTitle',
  4: 'subItemTitle',
};

export type ImportOptions = {
  /**
   * 自動切頁：在每個「區塊」（`##`）前面放一條換頁線。
   *
   * 只切區塊，不切「項」——一課通常有 5 個區塊但十幾個項，
   * 每個項都切會得到二十幾頁，而有些項只有一張照片。
   *
   * 這只是起手式，之後放在哪裡完全由使用者決定。
   */
  autoPageBreak: boolean;
};

export type ImportResult = {
  rows: Row[];
  meta: DocMeta;
  settings: Partial<DocSettings>;
  footnotes: Footnote[];
  title: string;
  /** 沒有對應規則、被當成內文處理的行。用來檢查格式有沒有寫錯。 */
  unrecognized: string[];
  /**
   * 認得出來、但 MVP 刻意不實作的指令（例如區塊層級的 @排版）。
   * 跟 unrecognized 分開，因為這兩者的意義不同：一個是格式寫錯，
   * 一個是我們決定不做。交接時要說明的是這一份。
   */
  skipped: string[];
};

// ── frontmatter ──────────────────────────────────────────
function parseFrontmatter(src: string): { meta: DocMeta; settings: Partial<DocSettings>; title: string; rest: string } {
  const m = /^---\n([\s\S]*?)\n---\n?/.exec(src);
  if (!m) return { meta: {}, settings: {}, title: '', rest: src };

  const fields: Record<string, string> = {};
  for (const line of m[1].split('\n')) {
    const kv = /^([a-zA-Z_]+):\s*(.*)$/.exec(line);
    if (kv) fields[kv[1]] = kv[2].replace(/\s+#.*$/, '').trim();
  }

  const range = /\[\s*(\d+)\s*,\s*(\d+)\s*\]/.exec(fields.page ?? '');
  return {
    title: fields.title ?? '',
    settings: fields.direction === '直排' ? { writingMode: 'vertical' } : {},
    meta: {
      sourceId: fields.id,
      publisher: fields.publisher,
      stage: fields.stage,
      grade: fields.grade,
      term: fields.term,
      subject: fields.subject,
      unit: fields.unit,
      printPageRange: range ? [Number(range[1]), Number(range[2])] : undefined,
    },
    rest: src.slice(m[0].length),
  };
}

// ── 單行指令 ─────────────────────────────────────────────
const RE = {
  heading: /^(#{1,4})\s+(.*)$/,
  image: /^!\[([^\]]*)\]\(([^)\s]+)(?:\s+"([^"]*)")?\)$/,
  dialogue: /@對話\[([^\]]*)\]\{([^}]*)\}/g,
  printPage: /^@頁\[(\d+)\]$/,
  reference: /^@參照\[([^\]]*)\]\{([^}]*)\}$/,
  link: /^@連結\[([^\]]*)\]\(([^)]+)\)(\{QR\})?$/,
  audio: /^@音檔\[([^\]]*)\]\(([^)]+)\)$/,
  video: /^@影片\[([^\]]*)\]\(([^)]+)\)(?:\{字幕=([^}]+)\})?$/,
  label: /^@題型\[([^\]]*)\]$/,
  module: /^@模組\[([^\]]*)\]\(([^)]+)\)(?:\{([^}]*)\})?$/,
  /** 題目：`1. @題型[標籤] 題幹`，後面接縮排的 `- (A) 選項`。 */
  questionStem: /^(\d+)\.\s*(?:@題型\[([^\]]*)\]\s*)?(.*)$/,
  questionOption: /^\s*-\s*[（(]([A-Za-z])[）)]\s*(.*)$/,
  /** 區塊層級的方向覆蓋。MVP 不做，讀到就跳過並記錄。 */
  writingOverride: /^@排版\[([^\]]*)\]$/,
  footnoteDef: /^\[\^([^\]]+)\]:\s*(\S+)\s+([\s\S]*)$/,
  tableRow: /^\|(.+)\|$/,
  tableSep: /^\|[\s:|-]+\|$/,
};

const stripIndent = (s: string) => s.replace(/^[　\s]+/, '');

/** `標示=魏晉南北朝,寬=full` → { 標示: '魏晉南北朝', 寬: 'full' } */
function parseParams(raw?: string): Record<string, string> | undefined {
  if (!raw) return undefined;
  const out: Record<string, string> = {};
  for (const part of raw.split(',')) {
    const i = part.indexOf('=');
    if (i > 0) out[part.slice(0, i).trim()] = part.slice(i + 1).trim();
  }
  return Object.keys(out).length > 0 ? out : undefined;
}

const cells = (line: string) =>
  line.slice(1, -1).split('|').map((c) => c.trim());

export function parseMarkdown(src: string, opts: ImportOptions): ImportResult {
  const { meta, settings, title, rest } = parseFrontmatter(src);
  const rows: Row[] = [];
  const footnotes: Footnote[] = [];
  const unrecognized: string[] = [];
  const skipped: string[] = [];

  /** 下一列要帶的錨點與標籤。@頁 與 @題型 都是「標在下一段內容上」。 */
  let pendingPrintPage: number | undefined;
  let pendingLabel: string | undefined;

  const push = (blocks: Block[], breakBefore = false) => {
    if (blocks.length === 0) return;
    if (pendingLabel) {
      blocks[0] = { ...blocks[0], label: pendingLabel };
      pendingLabel = undefined;
    }
    rows.push({
      id: newId('row'),
      breakBefore,
      printPage: pendingPrintPage,
      columns: [{ id: newId('col'), widthPct: 100, blocks }],
    });
    pendingPrintPage = undefined;
  };

  const text = (raw: string, role: TextRole): Block => ({
    id: newId('blk'),
    type: 'text',
    role,
    popups: [],
    spans: parseInline(raw),
  });

  const chunks = rest.replace(/\r\n?/g, '\n').split(/\n{2,}/);

  for (const rawChunk of chunks) {
    const chunk = rawChunk.trim();
    if (!chunk) continue;
    const lines = chunk.split('\n').map((l) => l.trim()).filter(Boolean);

    // 表格：整段都是 | 開頭
    if (lines.length >= 2 && lines.every((l) => RE.tableRow.test(l))) {
      const body = lines.filter((l) => !RE.tableSep.test(l));
      const grid = body.map(cells);
      push([
        {
          id: newId('blk'),
          type: 'table',
          rows: grid.length,
          cols: Math.max(...grid.map((r) => r.length)),
          cells: grid,
          hasHeader: lines.some((l) => RE.tableSep.test(l)),
          popups: [],
        },
      ]);
      continue;
    }

    // 注釋定義可能整段都是
    if (lines.every((l) => RE.footnoteDef.test(l))) {
      for (const line of lines) {
        const f = RE.footnoteDef.exec(line)!;
        footnotes.push({ id: f[1], term: f[2], body: f[3].trim() });
      }
      continue;
    }

    // 一段裡可能有多個對話框
    if (lines.every((l) => l.startsWith('@對話['))) {
      const blocks: Block[] = [];
      for (const m of chunk.matchAll(RE.dialogue)) {
        blocks.push({
          id: newId('blk'),
          type: 'dialogue',
          speaker: m[1],
          text: m[2],
          popups: [],
        });
      }
      for (const b of blocks) push([b]);
      continue;
    }

    // 題目：一段裡是「N. 題幹」加上縮排的「- (A) 選項」
    if (RE.questionStem.test(lines[0]) && lines.some((l) => RE.questionOption.test(l))) {
      const stem = RE.questionStem.exec(lines[0])!;
      const options: { key: string; text: InlineSpan[] }[] = [];
      for (const l of lines.slice(1)) {
        const o = RE.questionOption.exec(l);
        if (o) options.push({ key: o[1].toUpperCase(), text: parseInline(o[2]) });
      }
      const stemText = stem[3];
      push([
        {
          id: newId('blk'),
          type: 'question',
          number: stem[1],
          questionType: stem[2] || pendingLabel,
          stem: parseInline(stemText),
          options,
          multiple: /多選/.test(stemText),
          popups: [],
        },
      ]);
      pendingLabel = undefined;
      continue;
    }

    // 其餘一段一列
    const line = lines.join('');
    let m: RegExpExecArray | null;

    if ((m = RE.heading.exec(line))) {
      const role = HEADING_BY_LEVEL[m[1].length];
      push([text(m[2], role)], opts.autoPageBreak && role === 'sectionTitle');
      continue;
    }
    if ((m = RE.printPage.exec(line))) {
      pendingPrintPage = Number(m[1]);
      continue;
    }
    if ((m = RE.label.exec(line))) {
      pendingLabel = m[1];
      continue;
    }
    if ((m = RE.writingOverride.exec(line))) {
      // 區塊層級的直橫排覆蓋，MVP 不做（見 HANDOVER）。
      // 記錄下來而不是丟掉——客戶要知道 md 裡有這個指令而編輯器忽略了它。
      skipped.push(line);
      continue;
    }
    if ((m = RE.image.exec(line))) {
      push([
        {
          id: newId('blk'),
          type: 'image',
          assetId: m[2],
          alt: m[1],
          caption: m[3] ?? '',
          aspectRatio: 1.5,
          popups: [],
        },
      ]);
      continue;
    }
    if ((m = RE.reference.exec(line))) {
      push([{ id: newId('blk'), type: 'reference', target: m[1], pages: m[2], popups: [] }]);
      continue;
    }
    if ((m = RE.link.exec(line))) {
      push([
        {
          id: newId('blk'),
          type: 'web',
          url: m[2],
          title: m[1],
          presentation: m[3] ? 'qr' : 'bookmark',
          popups: [],
        },
      ]);
      continue;
    }
    if ((m = RE.audio.exec(line))) {
      push([{ id: newId('blk'), type: 'audio', assetId: m[2], title: m[1], popups: [] }]);
      continue;
    }
    if ((m = RE.video.exec(line))) {
      push([
        {
          id: newId('blk'),
          type: 'video',
          source: 'upload',
          ref: m[2],
          title: m[1],
          captionsRef: m[3],
          popups: [],
        },
      ]);
      continue;
    }
    if ((m = RE.module.exec(line))) {
      push([
        {
          id: newId('blk'),
          type: 'module',
          moduleKind: m[2],
          title: m[1],
          params: parseParams(m[3]),
          popups: [],
        },
      ]);
      continue;
    }
    if (line.startsWith('>')) {
      push([text(lines.map((l) => l.replace(/^>\s?/, '')).join(''), 'annotation')]);
      continue;
    }
    if (line.startsWith('@')) {
      unrecognized.push(line);
      continue;
    }

    push([text(stripIndent(lines.map(stripIndent).join('')), 'body')]);
  }

  if (rows.length > 0) rows[0] = { ...rows[0], breakBefore: false };
  return { rows, meta, settings, footnotes, title, unrecognized, skipped };
}

/** 把匯入結果套進一份文件。 */
export function applyImport(doc: Doc, result: ImportResult): Doc {
  return {
    ...doc,
    title: result.title || doc.title,
    settings: { ...doc.settings, ...result.settings },
    meta: { ...doc.meta, ...result.meta },
    rows: result.rows,
    footnotes: result.footnotes,
  };
}
