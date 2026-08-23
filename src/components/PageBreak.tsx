import styled from 'styled-components';
import type { Page } from '../model/paginate';

type Props = {
  startedBy: Page['startedBy'];
  onToggle?: () => void;
};

/**
 * 兩種換頁線。
 *
 * 使用者放的：橘色實線，位置固定，前面的內容增減都不影響它。
 * 系統放的：灰色虛線，排滿了就換，內容一改就移動。
 *
 * 設計指引明說這兩種必須一眼分得出來——使用者需要知道
 * 哪一條自己控制得了。所以標籤直接把機制寫在上面，不用猜。
 */
export function PageBreak({ startedBy, onToggle }: Props) {
  const manual = startedBy === 'manual';
  return (
    <Wrap $manual={manual}>
      <Line $manual={manual} />
      <Label $manual={manual} onClick={onToggle} type="button" disabled={!onToggle}>
        {manual ? '手動換頁 · 位置固定' : '自動換頁 · 隨內容移動'}
      </Label>
      <Line $manual={manual} />
    </Wrap>
  );
}

const Wrap = styled.div<{ $manual: boolean }>`
  display: flex;
  align-items: center;
  gap: ${(p) => p.theme.space.gapMd};
  width: 100%;
  max-width: 1024px;
  /* 換頁記號的上下留白用間距階最大的那幾階 */
  margin-block: ${(p) => p.theme.space.gapSm};
`;

const Line = styled.div<{ $manual: boolean }>`
  flex: 1;
  height: 0;
  border-block-start: ${(p) => (p.$manual ? '2px solid' : '1.5px dashed')}
    ${(p) => (p.$manual ? p.theme.border.accent : p.theme.border.default)};
`;

const Label = styled.button<{ $manual: boolean }>`
  flex: none;
  border: none;
  font-family: inherit;
  font-size: var(--ds-typography-label-size);
  line-height: var(--ds-typography-label-line-height);
  letter-spacing: 0.06em;
  padding: 4px 12px;
  border-radius: ${(p) => p.theme.radius.control};
  color: ${(p) => (p.$manual ? p.theme.text.accent : p.theme.text.tertiary)};
  background: ${(p) => (p.$manual ? p.theme.brand.primaryTint : p.theme.surface.sunken)};
  cursor: ${(p) => (p.disabled ? 'default' : 'pointer')};
`;
