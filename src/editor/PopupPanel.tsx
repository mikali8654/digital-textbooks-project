import { createPortal } from 'react-dom';
import { useEffect } from 'react';
import styled from 'styled-components';
import { Icon } from '../components/Icon';
import { useEditorCtx } from './EditorContext';
import { findBlock } from '../model/document';
import { textOf } from '../model/document';
import { POPUP_KIND, POPUP_KINDS, missingOf, newPopup } from '../model/popups';
import { pickFile, putFile, putImage } from './assets';
import { canHavePopup } from '../model/registry';
import type { PopupItem } from '../model/types';

/**
 * 掛補充的設定面板。
 *
 * 一個元件可以掛多個，順序可調——順序就是學生在檢視器裡看到的順序。
 * 排序用上下按鈕不用拖曳：這是一份三五項的短清單，在平板上按鈕比
 * 拖曳準得多，而且拖曳已經用在版面編排上了，同一個手勢兩種意思會混淆。
 */
export function PopupPanel() {
  const ed = useEditorCtx();
  const blockId = ed?.popupFor ?? null;

  useEffect(() => {
    if (!blockId) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') ed?.openPopupPanel(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [blockId, ed]);

  if (!ed || !blockId) return null;
  const hit = findBlock(ed.doc, blockId);
  if (!hit || !canHavePopup(hit.block.type)) return null;

  const { block } = hit;
  const close = () => ed.openPopupPanel(null);
  const patch = (item: PopupItem) => ed.dispatch({ type: 'updatePopup', blockId, item });

  return createPortal(
    <Drawer role="dialog" aria-label="補充內容設定">
      <Head>
        <strong>補充內容</strong>
        <Sub>掛在「{labelOf(hit.block)}」上</Sub>
        <Spacer />
        <Ghost onClick={close} aria-label="關閉">
          <Icon name="x" size={20} label="關閉" />
        </Ghost>
      </Head>

      <Body>
        {block.popups.length === 0 && (
          <Empty>
            還沒有補充。掛上去之後，這個元件在頁面上會出現一個角標，
            學生點它就會開啟這裡設定的內容。
          </Empty>
        )}

        <List>
          {block.popups.map((item, i) => (
            <Card key={item.id}>
              <CardHead>
                <Icon name={POPUP_KIND[item.kind].icon} size={20} />
                <KindName>{POPUP_KIND[item.kind].label}</KindName>
                <Spacer />
                <Order>
                  <Ghost
                    disabled={i === 0}
                    onClick={() =>
                      ed.dispatch({ type: 'reorderPopups', blockId, from: i, to: i - 1 })
                    }
                    aria-label="往上移"
                  >
                    <Icon name="arrow-up" size={16} label="往上移" />
                  </Ghost>
                  <Ghost
                    disabled={i === block.popups.length - 1}
                    onClick={() =>
                      ed.dispatch({ type: 'reorderPopups', blockId, from: i, to: i + 1 })
                    }
                    aria-label="往下移"
                  >
                    <Icon name="arrow-down" size={16} label="往下移" />
                  </Ghost>
                </Order>
                <Ghost
                  onClick={() => ed.dispatch({ type: 'removePopup', blockId, popupId: item.id })}
                  aria-label="刪除這一項"
                >
                  <Icon name="trash" size={16} label="刪除" />
                </Ghost>
              </CardHead>

              <Field
                label="標題"
                value={item.title}
                placeholder={POPUP_KIND[item.kind].label}
                onChange={(v) => patch({ ...item, title: v })}
              />

              <Detail item={item} onChange={patch} />

              {/* 缺什麼要在編輯時就看見，不是上課點下去才發現 */}
              {missingOf(item) && <Warn>{missingOf(item)}</Warn>}
            </Card>
          ))}
        </List>

        <AddBar>
          <AddLabel>新增一項</AddLabel>
          <Kinds>
            {POPUP_KINDS.map((k) => (
              <Add
                key={k}
                onClick={() => ed.dispatch({ type: 'addPopup', blockId, item: newPopup(k) })}
                title={POPUP_KIND[k].label}
              >
                <Icon name={POPUP_KIND[k].icon} size={20} />
                {POPUP_KIND[k].label}
              </Add>
            ))}
          </Kinds>
        </AddBar>
      </Body>

      <Foot>
        {/* 老師要看得到學生看到什麼，而且看到的就是同一個元件 */}
        <Preview onClick={() => ed.previewPopups(block)}>
          <Icon name="eye" size={16} />
          預覽學生看到的
        </Preview>
      </Foot>
    </Drawer>,
    document.body
  );
}

function labelOf(block: ReturnType<typeof findBlock> extends null ? never : { type: string } & Record<string, unknown>): string {
  if (block.type === 'text') return textOf(block as never).slice(0, 12) || '空白文字';
  return String(block.type);
}

/** 每一種 kind 各自需要填的東西。 */
function Detail({
  item,
  onChange,
}: {
  item: PopupItem;
  onChange: (next: PopupItem) => void;
}) {
  const ed = useEditorCtx();

  switch (item.kind) {
    case 'text':
      return (
        <Label>
          內容
          <Area
            value={item.body}
            rows={4}
            placeholder="寫給學生看的說明"
            onChange={(e) => onChange({ ...item, body: e.target.value })}
          />
        </Label>
      );

    case 'image':
      return (
        <Upload
          done={!!item.assetId}
          label={item.assetId ? '已選好圖片，點一下換一張' : '選一張圖片'}
          onPick={async () => {
            const file = await pickFile('image/*');
            if (!file) return;
            const { assetId } = await putImage(file);
            onChange({ ...item, assetId, title: item.title || file.name });
          }}
        />
      );

    case 'audio':
      return (
        <Upload
          done={!!item.assetId}
          label={item.assetId ? '已選好音檔，點一下換一個' : '選一個音檔'}
          onPick={async () => {
            const file = await pickFile('audio/*');
            if (!file) return;
            // 聲音不必量尺寸，走不探測的那條——用 putImage 會因為
            // 拿 <img> 去讀音檔而永遠失敗，上傳看起來像沒反應
            onChange({ ...item, assetId: putFile(file), title: item.title || file.name });
          }}
        />
      );

    case 'video':
      return (
        <Field
          label="YouTube 網址或影片 ID"
          value={item.ref}
          placeholder="https://www.youtube.com/watch?v=…"
          onChange={(v) => onChange({ ...item, ref: v, source: 'youtube' })}
        />
      );

    case 'web':
      return (
        <>
          <Field
            label="網址"
            value={item.url}
            placeholder="https://…"
            onChange={(v) => onChange({ ...item, url: v })}
          />
          <Note>
            一律用新分頁開啟。能不能直接嵌在頁面裡要看對方網站允不允許，
            那是伺服器端的檢查，接上之後這裡不必改。
          </Note>
        </>
      );

    case 'jump':
      return (
        <Label>
          跳到
          <Select
            value={item.targetRowId ?? ''}
            onChange={(e) => onChange({ ...item, targetRowId: e.target.value || null })}
          >
            <option value="">還沒選</option>
            {ed?.doc.rows.map((r, i) => (
              <option key={r.id} value={r.id}>
                第 {i + 1} 段 · {rowSummary(r)}
              </option>
            ))}
          </Select>
        </Label>
      );
  }
}

function rowSummary(row: { columns: { blocks: { type: string }[] }[] }): string {
  const b = row.columns[0]?.blocks[0];
  if (!b) return '空的';
  if (b.type === 'text') return textOf(b as never).slice(0, 16) || '空白文字';
  return b.type;
}

function Field({
  label,
  value,
  placeholder,
  onChange,
}: {
  label: string;
  value: string;
  placeholder?: string;
  onChange: (v: string) => void;
}) {
  return (
    <Label>
      {label}
      <Input value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />
    </Label>
  );
}

function Upload({ done, label, onPick }: { done: boolean; label: string; onPick: () => void }) {
  return (
    <Pick $done={done} onClick={onPick}>
      <Icon name={done ? 'check' : 'upload'} size={20} />
      {label}
    </Pick>
  );
}

/** 抽屜貼在右緣，不遮住正在編的那一頁。 */
const Drawer = styled.aside`
  position: fixed;
  inset-block: 0;
  inset-inline-end: 0;
  z-index: 950;
  inline-size: min(380px, 100vw);
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

const Sub = styled.span`
  color: ${(p) => p.theme.text.tertiary};
  font-size: var(--ds-typography-label-size);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
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
  gap: ${(p) => p.theme.space.gapLg};
`;

const Empty = styled.p`
  margin: 0;
  color: ${(p) => p.theme.text.secondary};
  font-size: var(--ds-typography-body-sm-size);
  line-height: var(--ds-typography-body-sm-line-height);
`;

const List = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${(p) => p.theme.space.gapMd};
`;

const Card = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${(p) => p.theme.space.gapSm};
  border: ${(p) => p.theme.border.widthDefault} solid ${(p) => p.theme.border.subtle};
  border-radius: ${(p) => p.theme.radius.card};
  padding: ${(p) => p.theme.space.insetMd};
`;

const CardHead = styled.div`
  display: flex;
  align-items: center;
  gap: 6px;
  color: ${(p) => p.theme.text.secondary};
`;

const KindName = styled.span`
  font-size: var(--ds-typography-label-size);
`;

const Order = styled.div`
  display: flex;
`;

const Label = styled.label`
  display: flex;
  flex-direction: column;
  gap: 4px;
  font-size: var(--ds-typography-label-size);
  color: ${(p) => p.theme.text.secondary};
`;

const fieldStyle = `
  font: inherit;
  font-size: var(--ds-typography-body-sm-size);
  padding: 10px 12px;
  min-block-size: 44px;
`;

const Input = styled.input`
  ${fieldStyle}
  border: ${(p) => p.theme.border.widthDefault} solid ${(p) => p.theme.border.default};
  border-radius: ${(p) => p.theme.radius.field};
  background: ${(p) => p.theme.surface.raised};
  color: ${(p) => p.theme.text.primary};
`;

const Area = styled.textarea`
  ${fieldStyle}
  border: ${(p) => p.theme.border.widthDefault} solid ${(p) => p.theme.border.default};
  border-radius: ${(p) => p.theme.radius.field};
  background: ${(p) => p.theme.surface.raised};
  color: ${(p) => p.theme.text.primary};
  resize: vertical;
`;

const Select = styled.select`
  ${fieldStyle}
  border: ${(p) => p.theme.border.widthDefault} solid ${(p) => p.theme.border.default};
  border-radius: ${(p) => p.theme.radius.field};
  background: ${(p) => p.theme.surface.raised};
  color: ${(p) => p.theme.text.primary};
`;

const Note = styled.p`
  margin: 0;
  font-size: var(--ds-typography-label-size);
  color: ${(p) => p.theme.text.tertiary};
  line-height: 1.5;
`;

const Warn = styled.span`
  font-size: var(--ds-typography-label-size);
  color: ${(p) => p.theme.feedback.warningDefault};
`;

const Pick = styled.button<{ $done: boolean }>`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  font: inherit;
  font-size: var(--ds-typography-label-size);
  min-block-size: 44px;
  padding: 0 12px;
  cursor: pointer;
  border-radius: ${(p) => p.theme.radius.field};
  border: ${(p) => p.theme.border.widthDefault}
    ${(p) => (p.$done ? 'solid' : 'dashed')}
    ${(p) => (p.$done ? p.theme.border.accent : p.theme.border.default)};
  background: transparent;
  color: ${(p) => (p.$done ? p.theme.text.accent : p.theme.text.secondary)};
`;

const AddBar = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${(p) => p.theme.space.gapSm};
`;

const AddLabel = styled.span`
  font-size: var(--ds-typography-label-size);
  color: ${(p) => p.theme.text.tertiary};
`;

const Kinds = styled.div`
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: ${(p) => p.theme.space.gapSm};
`;

const Add = styled.button`
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font: inherit;
  font-size: var(--ds-typography-label-size);
  min-block-size: 44px;
  padding: 0 12px;
  cursor: pointer;
  border-radius: ${(p) => p.theme.radius.control};
  border: ${(p) => p.theme.border.widthDefault} solid ${(p) => p.theme.border.subtle};
  background: transparent;
  color: ${(p) => p.theme.text.secondary};

  &:hover {
    border-color: ${(p) => p.theme.border.accent};
    color: ${(p) => p.theme.text.accent};
  }
`;

const Foot = styled.footer`
  padding: ${(p) => p.theme.space.insetMd} ${(p) => p.theme.space.insetLg};
  border-block-start: ${(p) => p.theme.border.widthDefault} solid ${(p) => p.theme.border.subtle};
`;

const Preview = styled.button`
  display: inline-flex;
  align-items: center;
  gap: 8px;
  inline-size: 100%;
  justify-content: center;
  font: inherit;
  font-size: var(--ds-typography-label-size);
  min-block-size: 44px;
  cursor: pointer;
  border: none;
  border-radius: ${(p) => p.theme.radius.control};
  background: ${(p) => p.theme.action.secondaryBg};
  color: ${(p) => p.theme.action.secondaryText};

  &:hover { background: ${(p) => p.theme.action.secondaryBgHover}; }
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

  &:disabled { color: ${(p) => p.theme.action.disabledText}; cursor: default; }
  &:not(:disabled):hover { background: ${(p) => p.theme.action.ghostBgHover}; }
`;
