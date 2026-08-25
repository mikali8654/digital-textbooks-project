import styled from 'styled-components';
import { Icon } from '../Icon';
import { youtubeId } from '../../editor/assets';
import type { BlockPatch } from '../../model/actions';
import type { VideoBlock } from '../../model/types';

type Props = {
  block: VideoBlock;
  boxStyle?: React.CSSProperties;
  onPatch?: (patch: BlockPatch) => void;
  onSelect?: () => void;
};

/**
 * 影片。
 *
 * 編輯時只放縮圖與標題，不掛 iframe——一頁上有五支影片就是五個外部
 * 播放器同時載入，編輯會整個卡住，而且分頁量測會被 iframe 的非同步
 * 版面改變攪亂。真正的播放在檢視台，那時候一次只有一支。
 *
 * YouTube 的縮圖是靜態圖片，沒有這個問題。
 */
export function VideoBlockView({ block, boxStyle, onSelect }: Props) {
  const id = block.source === 'youtube' ? youtubeId(block.ref) : null;
  const poster = id ? `https://i.ytimg.com/vi/${id}/hqdefault.jpg` : null;

  return (
    <figure style={{ margin: 0 }} onPointerDown={onSelect}>
      <Frame style={boxStyle} $poster={poster}>
        <Play>
          <Icon name="play" size={24} />
        </Play>
        {!poster && <Missing>{block.source === 'youtube' ? '影片網址無法辨識' : '待上傳影片'}</Missing>}
      </Frame>
      {block.title && <Title>{block.title}</Title>}
      {/* 字幕是無障礙需求，沒有就要看得出來缺 */}
      {!block.captionsRef && <NoCaptions>未附字幕</NoCaptions>}
    </figure>
  );
}

const Frame = styled.div<{ $poster: string | null }>`
  position: relative;
  display: grid;
  place-items: center;
  border-radius: ${(p) => p.theme.radius.field};
  background: ${(p) => p.theme.surface.media}
    ${(p) => (p.$poster ? `center / cover url(${p.$poster})` : '')};
  overflow: hidden;
`;

const Play = styled.span`
  display: grid;
  place-items: center;
  inline-size: 56px;
  block-size: 56px;
  border-radius: 999px;
  background: ${(p) => p.theme.surface.raised};
  color: ${(p) => p.theme.text.accent};
  box-shadow: 0 6px 18px rgba(26, 25, 23, 0.28);
`;

const Missing = styled.span`
  position: absolute;
  inset-block-end: 8px;
  font-size: var(--ds-typography-caption-size);
  color: ${(p) => p.theme.text.secondary};
`;

const Title = styled.figcaption`
  margin-block-start: 12px;
  font-size: var(--ds-typography-caption-size);
  line-height: var(--ds-typography-caption-line-height);
  color: ${(p) => p.theme.text.secondary};
`;

const NoCaptions = styled.span`
  display: inline-block;
  margin-block-start: 4px;
  font-size: var(--ds-typography-label-size);
  color: ${(p) => p.theme.text.tertiary};
`;
