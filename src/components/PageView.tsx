import styled from 'styled-components';
import { PAGE_PADDING, PAGE_SIZE, contentBox } from '../model/pageSize';
import { RowView } from './RowView';
import type { Page } from '../model/paginate';
import type { DocSettings } from '../model/types';

type Props = {
  page: Page;
  settings: DocSettings;
  /** 整頁縮放倍率。分頁在頁座標裡算完，這裡只負責把它縮到螢幕上。 */
  scale: number;
  /** 這一列在 doc.rows 裡的位置。插入與拖曳都要用它。唯讀時不傳。 */
  rowIndexOf?: (rowId: string) => number;
  /** 全文共幾列。最後一列要多畫一個「加在結尾」的插入點。 */
  rowCount?: number;
};

/**
 * 一頁。
 *
 * 頁面本身永遠是固定尺寸，靠 transform 等比縮放——
 * 不是重新排版。所以任何螢幕上看到的都是同一份分頁結果。
 */
export function PageView({ page, settings, scale, rowIndexOf, rowCount = 0 }: Props) {
  const size = PAGE_SIZE[settings.aspectRatio];
  const vertical = settings.writingMode === 'vertical';
  const box = contentBox(settings);
  // 邏輯軸：橫排的 inline 是寬、直排的 inline 是高
  const contentInline = vertical ? box.height : box.width;
  const contentBlock = vertical ? box.width : box.height;

  return (
    // 只有可編輯的那一份掛頁碼，否則縮圖列會先被 querySelector 找到
    <Frame
      data-page-index={rowIndexOf ? page.index : undefined}
      style={{ width: size.width * scale, height: size.height * scale }}
    >
      <Sheet
        $vertical={vertical}
        data-vertical={vertical || undefined}
        style={{ width: size.width, height: size.height, transform: `scale(${scale})` }}
      >
        {page.items.map((item) => (
          <RowView
            key={item.row.id}
            item={item}
            settings={settings}
            contentInline={contentInline}
            contentBlock={contentBlock}
            rowIndex={rowIndexOf ? rowIndexOf(item.row.id) : -1}
            rowCount={rowCount}
          />
        ))}
      </Sheet>
      <PageNumber>{page.index + 1}</PageNumber>
    </Frame>
  );
}

const Frame = styled.div`
  position: relative;
  flex: none;
`;

const Sheet = styled.div<{ $vertical: boolean }>`
  transform-origin: top left;
  background: ${(p) => p.theme.surface.raised};
  border: ${(p) => p.theme.border.widthDefault} solid ${(p) => p.theme.border.subtle};
  /* 近直角，模擬紙張 */
  border-radius: 2px;
  padding: ${PAGE_PADDING}px;
  overflow: hidden;
  writing-mode: ${(p) => (p.$vertical ? 'vertical-rl' : 'horizontal-tb')};
  display: flex;
  flex-direction: column;
`;

const PageNumber = styled.div`
  position: absolute;
  inset-block-end: -28px;
  inset-inline-start: 0;
  font-size: var(--ds-typography-caption-size);
  color: ${(p) => p.theme.text.tertiary};
  font-variant-numeric: tabular-nums;
`;
