import { useRef } from 'react';
import styled from 'styled-components';
import { BlockView } from './BlockView';
import { Icon } from './Icon';
import { InsertPoint } from './InsertPoint';
import { InsertPanel } from './InsertPanel';
import { useEditorCtx } from '../editor/EditorContext';
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
};

/** 插入選單選了之後要產生什麼。真正的內容由使用者接著填。 */
function blockFor(key: BlockType | 'library'): Block {
  const id = newId('blk');
  switch (key) {
    case 'text':
      return makeText('', 'body');
    case 'image':
      return { id, type: 'image', assetId: null, alt: '', caption: '', aspectRatio: 1.5, popups: [] };
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
      return { id, type: 'image', assetId: null, alt: '', caption: '', aspectRatio: 1.5, popups: [] };
    default:
      return { id, type: 'module', moduleKind: null, popups: [] };
  }
}

export function RowView({ item, settings, contentInline, contentBlock, rowIndex }: Props) {
  const ed = useEditorCtx();
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
  const dropAbove = ed?.dropTarget?.mode === 'row' && ed.dropTarget.index === rowIndex;
  const dropBelow = ed?.dropTarget?.mode === 'row' && ed.dropTarget.index === rowIndex + 1;

  const dragging = ed?.draggingRowId === row.id;

  return (
    <Slot ref={ref} $dragging={dragging}>
      {/* 落點一：插進順序裡。用絕對定位的細線，不佔版面高度——
          佔高度的話一開始拖曳，整頁的列都會跳動。 */}
      {dropAbove && <DropLine $where="start" />}
      {dropBelow && <DropLine $where="end" />}

      {/* 插入點：安靜不常駐，滑過才浮現 */}
      {ed && !ed.draggingRowId && (
        <InsertPoint
          open={ed.insertAt === rowIndex}
          onOpen={() => ed.openInsert(ed.insertAt === rowIndex ? null : rowIndex)}
        />
      )}
      {ed?.insertAt === rowIndex && (
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

      <Frame
        ref={frameRef}
        data-row-id={row.id}
        data-row-index={rowIndex}
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
              ed.startDrag(e.nativeEvent, row.id);
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

        <Columns>
          {row.columns.map((col, ci) => {
            const gaps = COLUMN_GAP * (row.columns.length - 1);
            const colInline = ((contentInline - gaps) * col.widthPct) / 100;
            return (
              <ColumnWrap key={col.id} style={{ flexBasis: `${col.widthPct}%` }}>
                {col.blocks.map((b) => (
                  <BlockView
                    key={b.id}
                    block={b}
                    settings={settings}
                    sizing={{ inlineSize: colInline, maxBlockSize: contentBlock, vertical }}
                    onEditText={
                      ed ? (fragment) => ed.editText(b.id, fragment, item.textSlice) : undefined
                    }
                    onSelect={ed ? () => ed.select(b.id) : undefined}
                  />
                ))}
                {ed && ci < row.columns.length - 1 && (
                  <Divider
                    rowId={row.id}
                    widths={row.columns.map((c) => c.widthPct)}
                    index={ci}
                    totalInline={contentInline}
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
    </Slot>
  );
}

/** 欄分隔線：只調兩欄比例，沒有對齊格線、不吸附任意座標。 */
function Divider({
  widths,
  index,
  totalInline,
  onChange,
}: {
  rowId: string;
  widths: number[];
  index: number;
  totalInline: number;
  onChange: (widths: number[]) => void;
}) {
  const start = useRef<{ pos: number; a: number; b: number } | null>(null);

  return (
    <Handle
      role="separator"
      aria-label="調整欄寬"
      onPointerDown={(e) => {
        e.currentTarget.setPointerCapture(e.pointerId);
        start.current = { pos: e.clientX, a: widths[index], b: widths[index + 1] };
      }}
      onPointerMove={(e) => {
        if (!start.current) return;
        const deltaPct = ((e.clientX - start.current.pos) / totalInline) * 100;
        const a = Math.max(20, Math.min(80, start.current.a + deltaPct));
        const b = start.current.a + start.current.b - a;
        const next = widths.slice();
        next[index] = a;
        next[index + 1] = b;
        onChange(next);
      }}
      onPointerUp={() => {
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

const ColumnWrap = styled.div`
  position: relative;
  min-inline-size: 0;
`;

const Handle = styled.div`
  position: absolute;
  inset-block: 0;
  inset-inline-end: -${COLUMN_GAP / 2}px;
  inline-size: 12px;
  cursor: col-resize;
  display: grid;
  place-items: center;
  writing-mode: horizontal-tb;
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
