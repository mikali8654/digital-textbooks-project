import styled from 'styled-components';
import { Icon } from '../Icon';
import { pickFile, putFile, urlOf } from '../../editor/assets';
import type { BlockPatch } from '../../model/actions';
import type { AudioBlock } from '../../model/types';

type Props = {
  block: AudioBlock;
  boxStyle?: React.CSSProperties;
  onPatch?: (patch: BlockPatch) => void;
  onSelect?: () => void;
};

/**
 * 聲音。課文朗讀、國文的範讀都走這裡。
 *
 * 編輯畫面上不掛播放器，跟影片同一個理由：一頁多個播放器會拖慢編輯，
 * 而且它們的非同步版面會攪亂分頁量測。真的播放在補充的檢視器裡。
 */
export function AudioBlockView({ block, boxStyle, onPatch, onSelect }: Props) {
  const ready = !!urlOf(block.assetId);

  return (
    <Bar style={boxStyle} onPointerDown={onSelect}>
      <Play $ready={ready}>
        <Icon name="play" size={20} />
      </Play>
      <Body>
        <Title>{block.title || '未命名音檔'}</Title>
        {!ready && <Missing>還沒選音檔</Missing>}
      </Body>
      {onPatch && (
        <Pick
          onClick={async (e) => {
            e.stopPropagation();
            const file = await pickFile('audio/*');
            if (!file) return;
            onPatch({ assetId: putFile(file), title: block.title || file.name });
          }}
        >
          <Icon name="upload" size={16} />
          {ready ? '換一個' : '選音檔'}
        </Pick>
      )}
    </Bar>
  );
}

const Bar = styled.div`
  box-sizing: border-box;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 0 12px;
  border: ${(p) => p.theme.border.widthDefault} solid ${(p) => p.theme.border.subtle};
  border-radius: 999px;
  background: ${(p) => p.theme.surface.sunken};
  writing-mode: horizontal-tb;
`;

const Play = styled.span<{ $ready: boolean }>`
  display: grid;
  place-items: center;
  inline-size: 36px;
  block-size: 36px;
  flex: none;
  border-radius: 999px;
  background: ${(p) => (p.$ready ? p.theme.brand.primary : p.theme.surface.disabled)};
  color: ${(p) => (p.$ready ? p.theme.text.onBrand : p.theme.text.disabled)};
`;

const Body = styled.div`
  flex: 1;
  min-inline-size: 0;
`;

const Title = styled.div`
  font-size: var(--ds-typography-body-sm-size);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

const Missing = styled.div`
  font-size: var(--ds-typography-label-size);
  color: ${(p) => p.theme.feedback.warningDefault};
`;

const Pick = styled.button`
  flex: none;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font: inherit;
  font-size: var(--ds-typography-label-size);
  min-block-size: 32px;
  padding: 0 12px;
  cursor: pointer;
  border-radius: 999px;
  border: ${(p) => p.theme.border.widthDefault} solid ${(p) => p.theme.border.subtle};
  background: ${(p) => p.theme.surface.raised};
  color: ${(p) => p.theme.text.secondary};
`;
