import styled from 'styled-components';
import { Icon } from './components/Icon';
import { iconNames } from './assets/icons.generated';

/**
 * D0 的煙霧測試畫面：確認 token、圖示、styled-components 三條線都通了。
 * D1 開始會被真正的編輯器取代。
 */
export function App() {
  return (
    <Page>
      <h1>V1 自編編輯器 · 環境檢查</h1>
      <Note>
        這頁只是確認設計 token 與圖示管線正常。所有顏色都來自 <code>tokens.css</code>，
        改配色不需要動任何元件。
      </Note>

      <h2>圖示 · {iconNames.length} 個</h2>
      <IconGrid>
        {iconNames.map((name) => (
          <IconCell key={name}>
            <Icon name={name} label={name} />
            <span>{name}</span>
          </IconCell>
        ))}
      </IconGrid>

      <h2>文字角色 · 九階</h2>
      <Roles>
        <Role $token="heading1">課名 48 / 700</Role>
        <Role $token="heading2">大標 36 / 700</Role>
        <Role $token="heading3">中標 28 / 700</Role>
        <Role $token="heading4">小標 24 / 700</Role>
        <Role $token="lead">導言 20 / 500</Role>
        <Role $token="bodyLg">內文 18 / 400</Role>
        <Role $token="body">補充 16 / 400</Role>
        <Role $token="bodySm">注釋 14 / 400</Role>
        <Role $token="caption">圖說 12 / 400</Role>
      </Roles>
    </Page>
  );
}

const Page = styled.main`
  max-width: 960px;
  margin: 0 auto;
  padding: ${(p) => p.theme.space.insetXl};
  display: flex;
  flex-direction: column;
  gap: ${(p) => p.theme.space.stackLg};

  h1 {
    margin: 0;
    font-size: ${(p) => p.theme.typography.heading3Size};
    line-height: ${(p) => p.theme.typography.heading3LineHeight};
    font-weight: ${(p) => p.theme.typography.heading3Weight};
  }
  h2 {
    margin: 0;
    font-size: ${(p) => p.theme.typography.uiLabelSize};
    line-height: ${(p) => p.theme.typography.uiLabelLineHeight};
    font-weight: ${(p) => p.theme.typography.uiLabelWeight};
    color: ${(p) => p.theme.text.secondary};
  }
`;

const Note = styled.p`
  margin: 0;
  max-width: 60ch;
  color: ${(p) => p.theme.text.secondary};
  font-size: ${(p) => p.theme.typography.bodySmSize};
  line-height: ${(p) => p.theme.typography.bodySmLineHeight};
`;

const IconGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(104px, 1fr));
  gap: ${(p) => p.theme.space.gapSm};
`;

const IconCell = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: ${(p) => p.theme.space.gapXs};
  padding: ${(p) => p.theme.space.insetSm};
  background: ${(p) => p.theme.surface.raised};
  border: ${(p) => p.theme.border.widthDefault} solid ${(p) => p.theme.border.subtle};
  border-radius: ${(p) => p.theme.radius.tile};
  color: ${(p) => p.theme.icon.default};

  span {
    font-size: ${(p) => p.theme.typography.labelSize};
    line-height: ${(p) => p.theme.typography.labelLineHeight};
    color: ${(p) => p.theme.text.tertiary};
    text-align: center;
    word-break: break-all;
  }
`;

const Roles = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${(p) => p.theme.space.gapSm};
  padding: ${(p) => p.theme.space.insetLg};
  background: ${(p) => p.theme.surface.raised};
  border-radius: ${(p) => p.theme.radius.card};
`;

type RoleToken =
  | 'heading1' | 'heading2' | 'heading3' | 'heading4'
  | 'lead' | 'bodyLg' | 'body' | 'bodySm' | 'caption';

const Role = styled.p<{ $token: RoleToken }>`
  margin: 0;
  font-size: ${(p) => p.theme.typography[`${p.$token}Size` as const]};
  line-height: ${(p) => p.theme.typography[`${p.$token}LineHeight` as const]};
  font-weight: ${(p) => p.theme.typography[`${p.$token}Weight` as const]};
`;
