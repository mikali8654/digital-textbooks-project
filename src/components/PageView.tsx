import styled from 'styled-components';
import { PAGE_PADDING, PAGE_SIZE } from '../model/pageSize';
import { GAP } from '../model/spacing';
import { BlockView } from './BlockView';
import type { Page } from '../model/paginate';
import type { DocSettings } from '../model/types';

type Props = {
  page: Page;
  settings: DocSettings;
  /** 整頁縮放倍率。分頁在頁座標裡算完，這裡只負責把它縮到螢幕上。 */
  scale: number;
};

/**
 * 一頁。
 *
 * 頁面本身永遠是固定尺寸，靠 transform 等比縮放——
 * 不是重新排版。所以任何螢幕上看到的都是同一份分頁結果。
 */
export function PageView({ page, settings, scale }: Props) {
  const size = PAGE_SIZE[settings.aspectRatio];
  return (
    <Frame style={{ width: size.width * scale, height: size.height * scale }}>
      <Sheet
        $vertical={settings.writingMode === 'vertical'}
        style={{
          width: size.width,
          height: size.height,
          transform: `scale(${scale})`,
        }}
      >
        {page.items.map((item) => (
          <Row key={item.row.id} style={{ marginBlockStart: item.gapBefore }}>
            {item.continuedFromPrev && <Continues>接上頁</Continues>}
            <Columns>
              {item.row.columns.map((col) => (
                <Column key={col.id} style={{ flexBasis: `${col.widthPct}%` }}>
                  {col.blocks.map((b) => (
                    <BlockView key={b.id} block={b} settings={settings} />
                  ))}
                </Column>
              ))}
            </Columns>
            {item.continuesOnNext && <Continues $end>接下頁</Continues>}
          </Row>
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

const Row = styled.div`
  display: flex;
  flex-direction: column;
`;

const Columns = styled.div`
  display: flex;
  gap: 24px;
  align-items: flex-start;
`;

const Column = styled.div`
  min-inline-size: 0;
`;

const Continues = styled.div<{ $end?: boolean }>`
  font-size: var(--ds-typography-caption-size);
  line-height: var(--ds-typography-caption-line-height);
  color: ${(p) => p.theme.text.tertiary};
  margin-block: ${(p) => (p.$end ? `${GAP.tight}px 0` : `0 ${GAP.tight}px`)};

  &::before {
    content: '${(p) => (p.$end ? '↓ ' : '↑ ')}';
  }
`;

const PageNumber = styled.div`
  position: absolute;
  inset-block-end: -28px;
  inset-inline-start: 0;
  font-size: var(--ds-typography-caption-size);
  color: ${(p) => p.theme.text.tertiary};
  font-variant-numeric: tabular-nums;
`;
