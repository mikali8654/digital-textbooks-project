import { useRef } from 'react';
import styled from 'styled-components';
import { BlockView } from './BlockView';
import { Icon } from './Icon';
import { InsertPoint } from './InsertPoint';
import { InsertPanel } from './InsertPanel';
import { useEditorCtx } from '../editor/EditorContext';
import { usePopupViewer } from '../viewer/PopupViewer';
import { PopupBadge } from './PopupBadge';
import { COLUMN_GAP } from '../model/pageSize';
import { makeText } from '../model/document';
import { newId } from '../model/ids';
import type { PageItem } from '../model/paginate';
import type { Block, BlockType, DocSettings } from '../model/types';

type Props = {
  item: PageItem;
  settings: DocSettings;
  contentInline: number;
  contentBlock: number;
  /** 這一列在 doc.rows 裡的位置。插入與拖曳都要用它。 */
  rowIndex: number;
  /** 全文共幾列。只為了知道自己是不是最後一列。 */
  rowCount: number;
};

/** 插入選單選了之後要產生什麼。真正的內容由使用者接著填。 */
function blockFor(key: BlockType | 'library'): Block {
  const id = newId('blk');
  switch (key) {
    case 'text':
      return makeText('', 'body');
    case 'image':
      // 明確給一個尺寸，不要留在「沒設定」的隱含狀態——老師插進來就
      // 看得到膠囊上亮著哪一格，畫出來的也就是那一格
      return { id, type: 'image', assetId: null, alt: '', caption: '', aspectRatio: 1.5, widthPct: 50, popups: [] };
    case 'video':
      return { id, type: 'video', source: 'upload', ref: '', title: '', popups: [] };
    case 'audio':
      return { id, type: 'audio', assetId: null, title: '', popups: [] };
    case 'shape':
      return { id, type: 'shape', shape: 'rect', label: '', popups: [] };
    case 'table':
      return { id, type: 'table', rows: 3, cols: 3, cells: [], hasHeader: true, popups: [] };
    case 'web':
      return { id, type: 'web', url: '', title: '', presentation: 'bookmark', popups: [] };
    // 媒體庫不是元件，是挑素材的入口——挑完會變成圖片或影音。
    // MVP 是演出，先放一個圖片佔位。
    case 'library':
      return { id, type: 'image', assetId: null, alt: '', caption: '', aspectRatio: 1.5, widthPct: 50, popups: [] };
    default:
      return { id, type: 'module', moduleKind: null, popups: [] };
  }
}

export function RowView({
  item,
  settings,
  contentInline,
  contentBlock,
  rowIndex,
  rowCount,
}: Props) {
  const ed = useEditorCtx();
  // 檢視器在編輯與預覽兩邊都在：老師看到的補充就是學生看到的那一個
  const viewer = usePopupViewer();
  const vertical = settings.writingMode === 'vertical';
  const ref = useRef<HTMLDivElement>(null);
  const frameRef = useRef<HTMLDivElement>(null);

  const row = item.row;
  const selected = ed?.selectedBlockId
    ? row.columns.some((c) => c.blocks.some((b) => b.id === ed.selectedBlockId))
    : false;

  const dropHere =
    ed?.dropTarget?.mode === 'column' && ed.dropTarget.rowId === row.id
      ? ed.dropTarget.side
      : null;
  /**
   * 被切到下一頁的段落，在兩頁上各畫一次，而且兩份的 rowIndex 相同。
   *
   * 所以「插在這一列之前」只能由**起點那一份**負責，「插在之後」只能由
   * **結尾那一份**負責——否則同一個插入點會在上下兩頁同時展開，
   * 而且中間那一份的位置根本不對：它的上緣是接續處，不是列的開頭。
   */
  const isStart = !item.continuedFromPrev;
  const isEnd = !item.continuesOnNext;

  const dropAbove = isStart && ed?.dropTarget?.mode === 'row' && ed.dropTarget.index === rowIndex;
  const dropBelow = isEnd && ed?.dropTarget?.mode === 'row' && ed.dropTarget.index === rowIndex + 1;

  const dragging = ed?.draggingRowId === row.id;

  return (
    <Slot ref={ref} $dragging={dragging}>
      {/* 落點一：插進順序裡。用絕對定位的細線，不佔版面高度——
          佔高度的話一開始拖曳，整頁的列都會跳動。 */}
      {dropAbove && <DropLine $where="start" />}
      {dropBelow && <DropLine $where="end" />}

      {/* 插入點：安靜不常駐，滑過才浮現 */}
      {ed && isStart && !ed.draggingRowId && (
        <InsertPoint
          vertical={vertical}
          open={ed.insertAt === rowIndex}
          onOpen={() => ed.openInsert(ed.insertAt === rowIndex ? null : rowIndex)}
        />
      )}
      {ed?.insertAt === rowIndex && isStart && (
        <PanelAnchor>
          <InsertPanel
            onClose={() => ed.openInsert(null)}
            onPick={(key) => {
              ed.dispatch({ type: 'insertRow', index: rowIndex, blocks: [blockFor(key)] });
              ed.openInsert(null);
            }}
          />
        </PanelAnchor>
      )}

      {/*
        識別屬性只有可編輯時才掛。縮圖列與預覽畫的是同一個 RowView，
        若兩邊都掛，整份文件就會有兩組同樣的 id；而縮圖列在 DOM 裡排在
        前面，document.querySelector 會先找到縮圖那一份——浮動膠囊、
        捲到某一頁、跳到某一段全部會指到左邊那條 180px 的縮圖上。
      */}
      <Frame
        ref={frameRef}
        data-row-id={ed ? row.id : undefined}
        data-row-index={ed ? rowIndex : undefined}
        $selected={selected}
        style={{ marginBlockStart: item.gapBefore }}
        onPointerDown={() => {
          if (ed?.insertAt !== null) ed?.openInsert(null);
        }}
      >
        {/* 抓取點。用 pointer events 而不是 HTML5 拖曳——
            HTML5 拖曳在觸控裝置上完全不能用，而老師是用平板的。 */}
        {ed && (
          <Grip
            onPointerDown={(e) => {
              e.preventDefault();
              ed.startDrag(e.nativeEvent, { rowId: row.id });
            }}
            aria-label="拖曳搬移"
            title="拖曳搬移這一列"
          >
            <Icon name="grip" size={16} />
          </Grip>
        )}

        {/* 落點二：貼在元件側邊 → 跟旁邊併成兩欄。刻意跟落點一完全不同形態 */}
        {ed?.draggingRowId && ed.draggingRowId !== row.id && (
          <>
            <SideDrop $side="start" $active={dropHere === 'left'}>
              併成兩欄
            </SideDrop>
            <SideDrop $side="end" $active={dropHere === 'right'}>
              併成兩欄
            </SideDrop>
          </>
        )}

        {item.continuedFromPrev && <Continues>接上頁</Continues>}

        <Columns data-columns>
          {row.columns.map((col, ci) => {
            const gaps = COLUMN_GAP * (row.columns.length - 1);
            const colInline = ((contentInline - gaps) * col.widthPct) / 100;
            return (
              <ColumnWrap
                key={col.id}
                data-col-id={ed ? col.id : undefined}
                style={{ flexBasis: `${col.widthPct}%` }}
              >
                {/* 多欄時每一欄各有握把，否則併起來就拆不開了 */}
                {ed && row.columns.length > 1 && (
                  <ColGrip
                    onPointerDown={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      ed.startDrag(e.nativeEvent, { rowId: row.id, columnId: col.id });
                    }}
                    aria-label="拖曳搬移這一欄"
                    title="拖曳搬移這一欄。往上或往下放可以拆回獨立的一列"
                  >
                    <Icon name="grip" size={16} />
                  </ColGrip>
                )}
                {col.blocks.map((b) => (
                  <BlockShell
                    key={b.id}
                    data-block-id={ed ? b.id : undefined}
                    $selected={ed?.selectedBlockId === b.id}
                  >
                    {b.popups.length > 0 && viewer && (
                      <PopupBadge count={b.popups.length} onClick={() => viewer.open(b)} />
                    )}
                    <BlockView
                      block={b}
                      settings={settings}
                      sizing={{ inlineSize: colInline, maxBlockSize: contentBlock, vertical }}
                      onEditSpans={
                        ed ? (spans) => ed.editSpans(b.id, spans, item.textSlice) : undefined
                      }
                      onPatch={
                        ed
                          ? (patch) =>
                              ed.dispatch({
                                type: 'patchBlock',
                                blockId: b.id,
                                blockType: b.type,
                                patch,
                              })
                          : undefined
                      }
                      onSelectRange={
                        ed
                          ? (range) =>
                              ed.setInlineSelection(
                                range ? { blockId: b.id, range, slice: item.textSlice } : null
                              )
                          : undefined
                      }
                      onSelect={ed ? () => ed.select(b.id) : undefined}
                    />
                  </BlockShell>
                ))}
                {ed && ci < row.columns.length - 1 && (
                  <Divider
                    rowId={row.id}
                    widths={row.columns.map((c) => c.widthPct)}
                    index={ci}
                    vertical={vertical}
                    onChange={(widths) =>
                      ed.dispatch({ type: 'setColumnWidths', rowId: row.id, widths })
                    }
                  />
                )}
              </ColumnWrap>
            );
          })}
        </Columns>

        {item.continuesOnNext && <Continues $end>接下頁</Continues>}
      </Frame>

      {/*
        全文最後面的插入點。
        插入點都畫在列的「之前」，所以沒有這一個的話，課文結尾就再也
        加不了東西——老師只能插在最後一列之前，再把它拖下去。
      */}
      {ed && isEnd && rowIndex === rowCount - 1 && !ed.draggingRowId && (
        <InsertPoint
          vertical={vertical}
          where="end"
          open={ed.insertAt === rowCount}
          onOpen={() => ed.openInsert(ed.insertAt === rowCount ? null : rowCount)}
        />
      )}
      {ed?.insertAt === rowCount && isEnd && rowIndex === rowCount - 1 && (
        <PanelAnchor>
          <InsertPanel
            onClose={() => ed.openInsert(null)}
            onPick={(key) => {
              ed.dispatch({ type: 'insertRow', index: rowCount, blocks: [blockFor(key)] });
              ed.openInsert(null);
            }}
          />
        </PanelAnchor>
      )}
    </Slot>
  );
}

/** 欄分隔線：只調兩欄比例，沒有對齊格線、不吸附任意座標。 */
function Divider({
  widths,
  index,
  vertical,
  onChange,
}: {
  rowId: string;
  widths: number[];
  index: number;
  vertical: boolean;
  onChange: (widths: number[]) => void;
}) {
  const start = useRef<{ pos: number; a: number; b: number; span: number } | null>(null);

  /**
   * 用容器的「實際渲染寬度」換算百分比，不用頁座標。
   *
   * 頁面是 transform: scale() 縮放過的，指標事件給的是視窗像素。
   * 拿視窗像素去除以頁座標的寬度，比例會差一個縮放倍率——
   * 縮到 62% 時，拖 100px 只會動到該動的六成。
   * 兩邊都用視窗像素就自動對齊，不必把倍率傳進來。
   */
  const axis = (e: React.PointerEvent) => (vertical ? e.clientY : e.clientX);

  return (
    <Handle
      role="separator"
      aria-label="調整欄寬"
      $vertical={vertical}
      onPointerDown={(e) => {
        const columns = e.currentTarget.closest<HTMLElement>('[data-columns]');
        const box = columns?.getBoundingClientRect();
        const span = (vertical ? box?.height : box?.width) ?? 0;
        if (span <= 0) return;

        start.current = { pos: axis(e), a: widths[index], b: widths[index + 1], span };
        // 包在 try 裡：它會對無效的 pointerId 丟例外，
        // 一丟就把上面的初始化整個中斷，拖曳靜靜地失效。
        try {
          e.currentTarget.setPointerCapture(e.pointerId);
        } catch {
          /* 沒有捕捉也能拖 */
        }
      }}
      onPointerMove={(e) => {
        const s = start.current;
        if (!s) return;
        const deltaPct = ((axis(e) - s.pos) / s.span) * 100;
        // 兩欄各自至少留兩成，否則會被拖到看不見
        const a = Math.max(20, Math.min(80, s.a + deltaPct));
        const next = widths.slice();
        next[index] = a;
        next[index + 1] = s.a + s.b - a;
        onChange(next);
      }}
      onPointerUp={() => {
        start.current = null;
      }}
      onPointerCancel={() => {
        start.current = null;
      }}
    >
      <Ratio>
        {Math.round(widths[index])} / {Math.round(widths[index + 1])}
      </Ratio>
    </Handle>
  );
}

const Slot = styled.div<{ $dragging: boolean }>`
  position: relative;
  opacity: ${(p) => (p.$dragging ? 0.4 : 1)};
`;

const PanelAnchor = styled.div`
  position: relative;
  block-size: 0;
`;

const Frame = styled.div<{ $selected: boolean }>`
  position: relative;
  display: flex;
  flex-direction: column;

  outline: ${(p) =>
    p.$selected
      ? `${p.theme.border.widthSelected} solid ${p.theme.border.accent}`
      : 'none'};
  outline-offset: 8px;
  border-radius: 2px;
`;

const Grip = styled.div`
  position: absolute;
  inset-inline-start: -36px;
  inset-block-start: 0;
  inline-size: 28px;
  block-size: 28px;
  display: grid;
  place-items: center;
  border-radius: ${(p) => p.theme.radius.field};
  border: ${(p) => p.theme.border.widthDefault} solid ${(p) => p.theme.border.subtle};
  background: ${(p) => p.theme.surface.raised};
  color: ${(p) => p.theme.icon.secondary};
  cursor: grab;
  writing-mode: horizontal-tb;

  /* 平常很淡但看得見——完全隱形的話沒人知道可以拖 */
  opacity: 0.35;
  transition: opacity 0.12s, border-color 0.12s, color 0.12s;

  ${Frame}:hover & {
    opacity: 1;
  }
  &:hover {
    border-color: ${(p) => p.theme.border.accent};
    color: ${(p) => p.theme.icon.accent};
  }
  &:active {
    cursor: grabbing;
  }
`;

/**
 * 落點一：插進順序裡。
 * 一條貼在列上下緣的細線，兩端各一個圓點——語意是「落在這個縫隙」。
 * 絕對定位，不佔版面高度。
 */
const DropLine = styled.div<{ $where: 'start' | 'end' }>`
  position: absolute;
  inset-inline: 0;
  ${(p) => (p.$where === 'start' ? 'inset-block-start: -3px;' : 'inset-block-end: -3px;')}
  block-size: 3px;
  z-index: 12;
  border-radius: 999px;
  background: ${(p) => p.theme.brand.primary};
  writing-mode: horizontal-tb;

  &::before,
  &::after {
    content: '';
    position: absolute;
    inset-block-start: -3px;
    inline-size: 9px;
    block-size: 9px;
    border-radius: 999px;
    background: ${(p) => p.theme.brand.primary};
  }
  &::before { inset-inline-start: -4px; }
  &::after { inset-inline-end: -4px; }
`;

/** 落點二：貼在側邊的直向落區。跟落點一視覺刻意完全不同。 */
const SideDrop = styled.div<{ $side: 'start' | 'end'; $active: boolean }>`
  position: absolute;
  inset-block: 0;
  ${(p) => (p.$side === 'start' ? 'inset-inline-start: 0;' : 'inset-inline-end: 0;')}
  inline-size: 72px;
  z-index: 10;
  display: grid;
  place-items: center;
  writing-mode: horizontal-tb;
  font-size: var(--ds-typography-label-size);
  color: ${(p) => (p.$active ? p.theme.text.accent : 'transparent')};
  border: ${(p) => (p.$active ? p.theme.border.widthSelected : '0')} dashed
    ${(p) => p.theme.border.accent};
  border-radius: ${(p) => p.theme.radius.tile};
  background: ${(p) => (p.$active ? p.theme.brand.primaryTintSubtle : 'transparent')};
`;

const Columns = styled.div`
  display: flex;
  gap: ${COLUMN_GAP}px;
  align-items: flex-start;
`;

const ColGrip = styled.div`
  position: absolute;
  inset-block-start: -10px;
  inset-inline-start: -10px;
  z-index: 11;
  inline-size: 24px;
  block-size: 24px;
  display: grid;
  place-items: center;
  border-radius: ${(p) => p.theme.radius.field};
  border: ${(p) => p.theme.border.widthDefault} solid ${(p) => p.theme.border.subtle};
  background: ${(p) => p.theme.surface.raised};
  color: ${(p) => p.theme.icon.secondary};
  cursor: grab;
  writing-mode: horizontal-tb;
  opacity: 0.35;
  transition: opacity 0.12s, border-color 0.12s, color 0.12s;

  &:hover {
    opacity: 1;
    border-color: ${(p) => p.theme.border.accent};
    color: ${(p) => p.theme.icon.accent};
  }
  &:active { cursor: grabbing; }
`;

const ColumnWrap = styled.div`
  position: relative;
  min-inline-size: 0;
`;

const Handle = styled.div<{ $vertical: boolean }>`
  position: absolute;
  inset-block: 0;
  inset-inline-end: -${COLUMN_GAP / 2}px;
  inline-size: 16px;
  /* 直排時欄是上下排的，拖曳軸也要跟著轉 */
  cursor: ${(p) => (p.$vertical ? 'row-resize' : 'col-resize')};
  display: grid;
  place-items: center;
  writing-mode: horizontal-tb;
  touch-action: none;
  opacity: 0;
  transition: opacity 0.12s;

  &::before {
    content: '';
    position: absolute;
    inset-block: 0;
    inline-size: 2px;
    background: ${(p) => p.theme.border.accent};
  }
  &:hover,
  &:active {
    opacity: 1;
  }
`;

const Ratio = styled.span`
  position: relative;
  padding: 2px 8px;
  border-radius: ${(p) => p.theme.radius.control};
  background: ${(p) => p.theme.surface.inverse};
  color: ${(p) => p.theme.text.onInverse};
  font-size: var(--ds-typography-label-size);
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
`;

const Continues = styled.div<{ $end?: boolean }>`
  font-size: var(--ds-typography-caption-size);
  line-height: var(--ds-typography-caption-line-height);
  color: ${(p) => p.theme.text.tertiary};
  margin-block: ${(p) => (p.$end ? '8px 0' : '0 8px')};

  &::before {
    content: '${(p) => (p.$end ? '↓ ' : '↑ ')}';
  }
`;

/**
 * 元件的外框。
 *
 * 存在的理由有兩個：給浮動膠囊一個可以定位的錨點（data-block-id），
 * 以及畫選取態。外框用 outline 不用 border——border 會改變元素尺寸，
 * 而尺寸是分頁算過的，一改就跟量測對不起來。
 */
const BlockShell = styled.div<{ $selected?: boolean }>`
  position: relative;
  border-radius: 4px;
  outline: ${(p) =>
    p.$selected
      ? `${p.theme.border.widthSelected} solid ${p.theme.border.accent}`
      : 'none'};
  outline-offset: 4px;
`;
