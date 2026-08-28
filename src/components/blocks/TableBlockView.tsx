import styled from 'styled-components';
import { TABLE_ROW, tableOverflow, type SizingContext } from '../../model/blockSizing';
import type { TableBlock } from '../../model/types';

type Props = {
  block: TableBlock;
  boxStyle?: React.CSSProperties;
  /** 跟量測用的是同一組尺寸，用來判斷有沒有列放不下。 */
  sizing: SizingContext;
  onSelect?: () => void;
};

/**
 * 表格。
 *
 * 資料是真的（md 的 `| 甲 | 乙 |` 解析出來的），所以照著畫，不做示意方塊。
 *
 * 尺寸從列數算，不是固定值——社會第一張表有 11 列，用固定高度會量少
 * 一半，畫出來就撐破頁面。這個算式跟量測共用 blockSizing 的常數。
 *
 * ⚠️ 每一格只有一行，過長會截斷不會換行。要支援換行必須讓量測器真的
 * 去量表格（見 HANDOVER 的已知限制）——目前的教材裡表格都是短的數值格。
 */
export function TableBlockView({ block, boxStyle, sizing, onSelect }: Props) {
  const [head, ...body] = block.cells;
  // 比一頁還高的表格只能截斷（切一半的表格在下一頁沒有表頭，看不懂），
  // 但一定要說出來——少幾列而沒人發現，學生看到的就是缺資料的課本
  const over = tableOverflow(block, sizing);
  const rows = block.hasHeader ? body : block.cells;
  const shown = over ? rows.slice(0, over.shown) : rows;

  return (
    <Wrap style={boxStyle} onPointerDown={onSelect}>
      <Grid $cols={block.cols}>
        {block.hasHeader && head && (
          <thead>
            <tr>
              {head.map((c, i) => (
                <th key={i}>{c}</th>
              ))}
            </tr>
          </thead>
        )}
        <tbody>
          {shown.map((row, r) => (
            <tr key={r}>
              {Array.from({ length: block.cols }, (_, c) => (
                <td key={c}>{row[c] ?? ''}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </Grid>
      {over && (
        <Cut>
          還有 {over.hidden} 列放不下這一頁。表格不能跨頁，請拆成兩個表格。
        </Cut>
      )}
    </Wrap>
  );
}

const Wrap = styled.div`
  box-sizing: border-box;
  overflow: hidden;
  border: ${(p) => p.theme.border.widthDefault} solid ${(p) => p.theme.border.subtle};
  border-radius: ${(p) => p.theme.radius.card};
  padding: 8px;
  /* 格線永遠是橫著的，即使課文是直排——表格是資料不是行文 */
  writing-mode: horizontal-tb;
`;

const Grid = styled.table<{ $cols: number }>`
  inline-size: 100%;
  border-collapse: collapse;
  table-layout: fixed;
  font-size: var(--ds-typography-body-sm-size);

  th,
  td {
    block-size: ${TABLE_ROW}px;
    padding: 0 10px;
    text-align: start;
    border-block-end: ${(p) => p.theme.border.widthDefault} solid ${(p) => p.theme.border.subtle};
    /* 一格一行。截斷是已知限制，不是沒想到 */
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  th {
    color: ${(p) => p.theme.text.secondary};
    font-weight: 600;
    background: ${(p) => p.theme.surface.sunken};
  }

  tr:last-child td {
    border-block-end: none;
  }
`;

const Cut = styled.div`
  display: flex;
  align-items: center;
  block-size: ${TABLE_ROW}px;
  padding: 0 10px;
  font-size: var(--ds-typography-label-size);
  color: ${(p) => p.theme.feedback.warningDefault};
`;
