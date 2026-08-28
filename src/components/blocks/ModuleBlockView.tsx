import styled from 'styled-components';
import { Icon } from '../Icon';
import type { ModuleBlock } from '../../model/types';

type Props = {
  block: ModuleBlock;
  boxStyle?: React.CSSProperties;
  onSelect?: () => void;
};

/**
 * 互動模組。
 *
 * 這是客戶要的「預留擴充空間」落地的地方：版面上跨課重複出現、由系統
 * 產生的元件，例如國文頁側的朝代時間軸——它每一課都出現，只是反白的
 * 朝代不同。
 *
 * MVP 只認得它、量得準它、排得動它，**不實作任何一種模組的內容**。
 * 參數原樣保留給模組自己解讀，所以之後接上真的模組時，不需要重新匯入
 * 教材，也不需要改資料結構。
 *
 * 畫面上刻意看得出是預留的，不做成「好像已經會動」的假畫面——
 * 假的互動在課堂上被點下去才是災難。
 */
export function ModuleBlockView({ block, boxStyle, onSelect }: Props) {
  const params = Object.entries(block.params ?? {});

  return (
    <Frame style={boxStyle} onPointerDown={onSelect}>
      <Head>
        <Icon name="puzzle" size={20} />
        <strong>{block.title || '互動模組'}</strong>
        {block.moduleKind && <Kind>{block.moduleKind}</Kind>}
      </Head>

      {params.length > 0 && (
        <Params>
          {params.map(([k, v]) => (
            <Param key={k}>
              {k}
              <b>{v}</b>
            </Param>
          ))}
        </Params>
      )}

      <Note>這一格由系統的模組填入。教材這邊只保留它的種類與參數。</Note>
    </Frame>
  );
}

const Frame = styled.div`
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 8px;
  padding: 16px;
  border: ${(p) => p.theme.border.widthDefault} dashed ${(p) => p.theme.border.default};
  border-radius: ${(p) => p.theme.radius.card};
  background: ${(p) => p.theme.surface.sunken};
  writing-mode: horizontal-tb;
`;

const Head = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  color: ${(p) => p.theme.text.secondary};
  font-size: var(--ds-typography-body-sm-size);
`;

const Kind = styled.span`
  font-family: var(--ds-typography-font-display);
  font-size: var(--ds-typography-label-size);
  color: ${(p) => p.theme.text.tertiary};
`;

const Params = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
`;

const Param = styled.span`
  display: inline-flex;
  gap: 6px;
  font-size: var(--ds-typography-label-size);
  color: ${(p) => p.theme.text.tertiary};
  background: ${(p) => p.theme.surface.raised};
  border-radius: ${(p) => p.theme.radius.control};
  padding: 3px 10px;

  b { color: ${(p) => p.theme.text.secondary}; }
`;

const Note = styled.span`
  font-size: var(--ds-typography-label-size);
  color: ${(p) => p.theme.text.tertiary};
`;
