import styled from 'styled-components';
import type { ShapeBlock } from '../../model/types';

type Props = {
  block: ShapeBlock;
  boxStyle?: React.CSSProperties;
  onSelect?: () => void;
};

/** 圖案。課本上用來框住重點、標示區域的色塊。 */
export function ShapeBlockView({ block, boxStyle, onSelect }: Props) {
  return (
    <Frame style={boxStyle} onPointerDown={onSelect}>
      <Body $round={block.shape === 'circle'}>{block.label}</Body>
    </Frame>
  );
}

const Frame = styled.div`
  box-sizing: border-box;
  display: grid;
  place-items: center;
  writing-mode: horizontal-tb;
`;

const Body = styled.div<{ $round: boolean }>`
  inline-size: 100%;
  block-size: 100%;
  display: grid;
  place-items: center;
  text-align: center;
  padding: 12px;
  box-sizing: border-box;
  background: ${(p) => p.theme.brand.primaryTint};
  color: ${(p) => p.theme.text.accent};
  font-size: var(--ds-typography-body-sm-size);
  border-radius: ${(p) => (p.$round ? '999px' : p.theme.radius.card)};
`;
