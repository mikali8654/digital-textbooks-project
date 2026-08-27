import { createPortal } from 'react-dom';
import { useEffect } from 'react';
import styled from 'styled-components';
import { Icon } from '../components/Icon';
import type { Doc, DocSettings } from '../model/types';

type Props = {
  doc: Doc;
  onPatch: (patch: Partial<DocSettings>) => void;
  onTitle: (title: string) => void;
  onClose: () => void;
};

/**
 * 教材設定。
 *
 * 這裡的三項都是**整本**的設定，不是逐段調整——學生用平板看全版面的
 * 前提是每一頁的字級與比例一致。老師覺得字太小就整本放大，
 * 而不是把某一段拉大。
 *
 * 改任何一項都會讓整份重新分頁，頁數當場就會變，所以面板裡直接顯示頁數。
 */
export function BookSettings({ doc, onPatch, onTitle, onClose }: Props) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const s = doc.settings;
  const meta = doc.meta;
  const facts = [
    ['出版社', meta.publisher],
    ['學制年級', [meta.stage, meta.grade, meta.term].filter(Boolean).join(' ')],
    ['科目', meta.subject],
    ['單元', meta.unit],
    ['紙本頁碼', meta.printPageRange?.join('–')],
  ].filter(([, v]) => v) as [string, string][];

  return createPortal(
    <Drawer role="dialog" aria-label="教材設定">
      <Head>
        <Icon name="settings" size={20} />
        <strong>教材設定</strong>
        <Spacer />
        <Ghost onClick={onClose} aria-label="關閉">
          <Icon name="x" size={20} label="關閉" />
        </Ghost>
      </Head>

      <Body>
        <Label>
          教材名稱
          <Input
            value={doc.title}
            onChange={(e) => onTitle(e.target.value)}
            placeholder="未命名教材"
          />
        </Label>

        <Group>
          <GroupLabel>書寫方向</GroupLabel>
          <Segmented>
            <Seg $on={s.writingMode === 'horizontal'} onClick={() => onPatch({ writingMode: 'horizontal' })}>
              橫排
            </Seg>
            <Seg $on={s.writingMode === 'vertical'} onClick={() => onPatch({ writingMode: 'vertical' })}>
              直排
            </Seg>
          </Segmented>
          <Hint>
            直排的內容由右往左流，翻頁方向也跟著反過來。國文用直排，其餘科目用橫排。
          </Hint>
        </Group>

        <Group>
          <GroupLabel>頁面比例</GroupLabel>
          <Segmented>
            {(['4:3', '16:9'] as const).map((r) => (
              <Seg key={r} $on={s.aspectRatio === r} onClick={() => onPatch({ aspectRatio: r })}>
                {r}
              </Seg>
            ))}
          </Segmented>
          <Hint>
            比例決定一頁裝得下多少，所以改了頁數就會變。學生端不論裝置大小都是整頁等比縮放，
            所以老師的第 12 頁就是學生的第 12 頁。
          </Hint>
        </Group>

        <Group>
          <GroupLabel>字級</GroupLabel>
          <Segmented>
            {([['sm', '小'], ['md', '標準'], ['lg', '大']] as const).map(([k, label]) => (
              <Seg key={k} $on={s.textScale === k} onClick={() => onPatch({ textScale: k })}>
                {label}
              </Seg>
            ))}
          </Segmented>
          <Hint>
            九種角色一起等比縮放，相對關係不變——不會出現內文比標題大的情形。
          </Hint>
        </Group>

        {/* frontmatter 帶進來的書目資料。這些是課本的事實，不是設定，
            所以只顯示不編輯——要改是改 md，不是在這裡改。 */}
        {facts.length > 0 && (
          <Group>
            <GroupLabel>來自 md 的書目資料</GroupLabel>
            <Facts>
              {facts.map(([k, v]) => (
                <Fact key={k}>
                  <dt>{k}</dt>
                  <dd>{v}</dd>
                </Fact>
              ))}
            </Facts>
          </Group>
        )}
      </Body>
    </Drawer>,
    document.body
  );
}

const Drawer = styled.aside`
  position: fixed;
  inset-block: 0;
  inset-inline-end: 0;
  z-index: 950;
  inline-size: min(360px, 100vw);
  display: flex;
  flex-direction: column;
  background: ${(p) => p.theme.surface.raised};
  border-inline-start: ${(p) => p.theme.border.widthDefault} solid ${(p) => p.theme.border.subtle};
  box-shadow: -16px 0 40px rgba(26, 25, 23, 0.14);
`;

const Head = styled.header`
  display: flex;
  align-items: center;
  gap: ${(p) => p.theme.space.gapSm};
  padding: ${(p) => p.theme.space.insetMd} ${(p) => p.theme.space.insetLg};
  border-block-end: ${(p) => p.theme.border.widthDefault} solid ${(p) => p.theme.border.subtle};
`;

const Spacer = styled.span`
  flex: 1;
`;

const Body = styled.div`
  flex: 1;
  overflow-y: auto;
  padding: ${(p) => p.theme.space.insetLg};
  display: flex;
  flex-direction: column;
  gap: ${(p) => p.theme.space.stackMd};
`;

const Label = styled.label`
  display: flex;
  flex-direction: column;
  gap: 6px;
  font-size: var(--ds-typography-label-size);
  color: ${(p) => p.theme.text.secondary};
`;

const Input = styled.input`
  font: inherit;
  font-size: var(--ds-typography-body-sm-size);
  min-block-size: 44px;
  padding: 0 12px;
  border: ${(p) => p.theme.border.widthDefault} solid ${(p) => p.theme.border.default};
  border-radius: ${(p) => p.theme.radius.field};
  background: ${(p) => p.theme.surface.raised};
  color: ${(p) => p.theme.text.primary};
`;

const Group = styled.div`
  display: flex;
  flex-direction: column;
  gap: 6px;
`;

const GroupLabel = styled.span`
  font-size: var(--ds-typography-label-size);
  color: ${(p) => p.theme.text.secondary};
`;

const Segmented = styled.div`
  display: flex;
  gap: 4px;
  padding: 4px;
  border-radius: ${(p) => p.theme.radius.control};
  background: ${(p) => p.theme.surface.sunken};
`;

const Seg = styled.button<{ $on: boolean }>`
  flex: 1;
  font: inherit;
  font-size: var(--ds-typography-label-size);
  min-block-size: 40px;
  cursor: pointer;
  border: none;
  border-radius: ${(p) => p.theme.radius.control};
  background: ${(p) => (p.$on ? p.theme.surface.raised : 'transparent')};
  color: ${(p) => (p.$on ? p.theme.text.accent : p.theme.text.secondary)};
  box-shadow: ${(p) => (p.$on ? '0 1px 3px rgba(26, 25, 23, 0.14)' : 'none')};
`;

const Hint = styled.p`
  margin: 0;
  font-size: var(--ds-typography-label-size);
  line-height: 1.6;
  color: ${(p) => p.theme.text.tertiary};
`;

const Facts = styled.dl`
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
`;

const Fact = styled.div`
  display: flex;
  gap: 8px;
  font-size: var(--ds-typography-label-size);

  dt { color: ${(p) => p.theme.text.tertiary}; inline-size: 96px; flex: none; }
  dd { margin: 0; color: ${(p) => p.theme.text.secondary}; }
`;

const Ghost = styled.button`
  display: inline-flex;
  align-items: center;
  border: none;
  background: transparent;
  color: ${(p) => p.theme.action.ghostText};
  cursor: pointer;
  border-radius: ${(p) => p.theme.radius.control};
  padding: 8px;
  min-block-size: 40px;

  &:hover { background: ${(p) => p.theme.action.ghostBgHover}; }
`;
