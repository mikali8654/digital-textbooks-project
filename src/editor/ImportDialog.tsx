import { useState } from 'react';
import { createPortal } from 'react-dom';
import styled from 'styled-components';
import { Icon } from '../components/Icon';
import { blockRegistry, ROLE_LABEL } from '../model/registry';
import { parseMarkdown, type ImportResult } from '../model/markdown';
import type { BlockType, TextRole } from '../model/types';

type Props = {
  /** 內建範例，讓客戶不必先準備檔案就能看見結果。 */
  samples: Record<string, string>;
  onApply: (result: ImportResult) => void;
  onClose: () => void;
};

/**
 * 匯入 md。
 *
 * 關鍵在**套用之前先看報告**。md 是老師或編輯手寫的，一定會有寫錯的行；
 * 直接吃進去的話那些行會安靜地變成內文，混在課文裡看不出來——
 * 等到上課才發現某個標題沒生效。所以先把「認得的」與「沒認得的」
 * 攤開來給人看，再決定要不要套用。
 */
export function ImportDialog({ samples, onApply, onClose }: Props) {
  const [name, setName] = useState<string | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const read = (label: string, src: string) => {
    try {
      setResult(parseMarkdown(src, { autoPageBreak: true }));
      setName(label);
      setError(null);
    } catch {
      setError('這個檔案讀不進來，請確認是教材的 md 格式');
      setResult(null);
    }
  };

  const pick = async () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.md,text/markdown,text/plain';
    input.oncancel = () => undefined;
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      read(file.name, await file.text());
    };
    input.click();
  };

  return createPortal(
    <Scrim onClick={onClose}>
      <Sheet role="dialog" aria-modal="true" aria-label="匯入教材" onClick={(e) => e.stopPropagation()}>
        <Head>
          <Icon name="upload" size={20} />
          <strong>匯入教材</strong>
          <Spacer />
          <Ghost onClick={onClose} aria-label="關閉">
            <Icon name="x" size={20} label="關閉" />
          </Ghost>
        </Head>

        <Body>
          <Pickers>
            <Primary onClick={pick}>
              <Icon name="file-text" size={20} />
              選一個 md 檔
            </Primary>
            <Or>或用內建範例</Or>
            <Samples>
              {Object.keys(samples).map((k) => (
                <Sample key={k} onClick={() => read(k, samples[k])}>
                  {k}
                </Sample>
              ))}
            </Samples>
          </Pickers>

          {error && <Bad>{error}</Bad>}

          {result && (
            <Report>
              <ReportHead>
                <strong>{name}</strong>
                <Spacer />
                <Muted>{result.rows.length} 列</Muted>
              </ReportHead>

              {/* 認出什麼，用課本的詞彙講，不是型別代號 */}
              <Section>辨識結果</Section>
              <Chips>
                {countOf(result).map(([label, n]) => (
                  <Chip key={label}>
                    {label} <b>{n}</b>
                  </Chip>
                ))}
              </Chips>

              {result.footnotes.length > 0 && (
                <Muted>注釋 {result.footnotes.length} 條</Muted>
              )}

              {/*
                兩份清單的意義完全不同，所以分開列：
                一個是「你寫錯了」，一個是「我們決定不做」。
                混在一起的話老師會浪費時間去修根本不是他的問題。
              */}
              {result.unrecognized.length > 0 && (
                <>
                  <Section $warn>沒有辨識出來，會當成內文（{result.unrecognized.length} 行）</Section>
                  <Lines>
                    {result.unrecognized.slice(0, 8).map((l, i) => (
                      <li key={i}>{l}</li>
                    ))}
                    {result.unrecognized.length > 8 && <li>…還有 {result.unrecognized.length - 8} 行</li>}
                  </Lines>
                </>
              )}

              {result.skipped.length > 0 && (
                <>
                  <Section>這個版本刻意不處理（{result.skipped.length} 行）</Section>
                  <Lines>
                    {result.skipped.slice(0, 5).map((l, i) => (
                      <li key={i}>{l}</li>
                    ))}
                  </Lines>
                </>
              )}

              {result.unrecognized.length === 0 && result.skipped.length === 0 && (
                <Good>
                  <Icon name="check" size={16} />
                  每一行都認得
                </Good>
              )}
            </Report>
          )}
        </Body>

        <Foot>
          <Muted>匯入會取代目前的內容，但可以用復原退回。</Muted>
          <Spacer />
          <Ghost onClick={onClose}>取消</Ghost>
          <Apply disabled={!result} onClick={() => result && onApply(result)}>
            匯入
          </Apply>
        </Foot>
      </Sheet>
    </Scrim>,
    document.body
  );
}

/** 用課本的詞彙數，不是型別代號——老師看的是「大標 12」不是「sectionTitle 12」。 */
function countOf(result: ImportResult): [string, number][] {
  const counts = new Map<string, number>();
  const bump = (k: string) => counts.set(k, (counts.get(k) ?? 0) + 1);

  for (const row of result.rows) {
    for (const col of row.columns) {
      for (const b of col.blocks) {
        bump(b.type === 'text' ? ROLE_LABEL[b.role as TextRole] : blockRegistry[b.type as BlockType].label);
      }
    }
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1]);
}

const Scrim = styled.div`
  position: fixed;
  inset: 0;
  z-index: 1000;
  background: rgba(26, 25, 23, 0.44);
  display: grid;
  place-items: center;
  padding: ${(p) => p.theme.space.insetLg};
`;

const Sheet = styled.div`
  inline-size: min(600px, 100%);
  max-block-size: min(80vh, 720px);
  display: flex;
  flex-direction: column;
  background: ${(p) => p.theme.surface.raised};
  border-radius: ${(p) => p.theme.radius.panel};
  box-shadow: 0 24px 64px rgba(26, 25, 23, 0.28);
  overflow: hidden;
`;

const Head = styled.header`
  display: flex;
  align-items: center;
  gap: ${(p) => p.theme.space.gapSm};
  padding: ${(p) => p.theme.space.insetMd} ${(p) => p.theme.space.insetLg};
  border-block-end: ${(p) => p.theme.border.widthDefault} solid ${(p) => p.theme.border.subtle};
`;

const Body = styled.div`
  flex: 1;
  overflow-y: auto;
  padding: ${(p) => p.theme.space.insetLg};
  display: flex;
  flex-direction: column;
  gap: ${(p) => p.theme.space.gapLg};
`;

const Pickers = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: ${(p) => p.theme.space.gapSm};
`;

const Primary = styled.button`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  inline-size: 100%;
  font: inherit;
  min-block-size: 52px;
  cursor: pointer;
  border: ${(p) => p.theme.border.widthDefault} dashed ${(p) => p.theme.border.default};
  border-radius: ${(p) => p.theme.radius.field};
  background: transparent;
  color: ${(p) => p.theme.text.secondary};

  &:hover { border-color: ${(p) => p.theme.border.accent}; color: ${(p) => p.theme.text.accent}; }
`;

const Or = styled.span`
  font-size: var(--ds-typography-label-size);
  color: ${(p) => p.theme.text.tertiary};
`;

const Samples = styled.div`
  display: flex;
  gap: ${(p) => p.theme.space.gapSm};
  flex-wrap: wrap;
  justify-content: center;
`;

const Sample = styled.button`
  font: inherit;
  font-size: var(--ds-typography-label-size);
  min-block-size: 40px;
  padding: 0 16px;
  cursor: pointer;
  border-radius: 999px;
  border: ${(p) => p.theme.border.widthDefault} solid ${(p) => p.theme.border.subtle};
  background: transparent;
  color: ${(p) => p.theme.text.secondary};

  &:hover { border-color: ${(p) => p.theme.border.accent}; color: ${(p) => p.theme.text.accent}; }
`;

const Report = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${(p) => p.theme.space.gapSm};
  border: ${(p) => p.theme.border.widthDefault} solid ${(p) => p.theme.border.subtle};
  border-radius: ${(p) => p.theme.radius.card};
  padding: ${(p) => p.theme.space.insetMd};
`;

const ReportHead = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
`;

const Section = styled.div<{ $warn?: boolean }>`
  font-size: var(--ds-typography-label-size);
  color: ${(p) => (p.$warn ? p.theme.feedback.warningDefault : p.theme.text.tertiary)};
  margin-block-start: 4px;
`;

const Chips = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
`;

const Chip = styled.span`
  font-size: var(--ds-typography-label-size);
  color: ${(p) => p.theme.text.secondary};
  background: ${(p) => p.theme.surface.sunken};
  border-radius: ${(p) => p.theme.radius.control};
  padding: 4px 10px;

  b { color: ${(p) => p.theme.text.primary}; margin-inline-start: 2px; }
`;

const Lines = styled.ul`
  margin: 0;
  padding-inline-start: 18px;
  font-family: var(--ds-typography-font-display);
  font-size: var(--ds-typography-label-size);
  color: ${(p) => p.theme.text.secondary};
  display: flex;
  flex-direction: column;
  gap: 2px;

  li {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
`;

const Good = styled.div`
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: var(--ds-typography-label-size);
  color: ${(p) => p.theme.feedback.successDefault};
`;

const Bad = styled.p`
  margin: 0;
  font-size: var(--ds-typography-body-sm-size);
  color: ${(p) => p.theme.feedback.errorDefault};
`;

const Muted = styled.span`
  font-size: var(--ds-typography-label-size);
  color: ${(p) => p.theme.text.tertiary};
`;

const Spacer = styled.span`
  flex: 1;
`;

const Foot = styled.footer`
  display: flex;
  align-items: center;
  gap: ${(p) => p.theme.space.gapSm};
  padding: ${(p) => p.theme.space.insetMd} ${(p) => p.theme.space.insetLg};
  border-block-start: ${(p) => p.theme.border.widthDefault} solid ${(p) => p.theme.border.subtle};
`;

const Ghost = styled.button`
  display: inline-flex;
  align-items: center;
  gap: 6px;
  border: none;
  background: transparent;
  color: ${(p) => p.theme.action.ghostText};
  font: inherit;
  font-size: var(--ds-typography-label-size);
  cursor: pointer;
  border-radius: ${(p) => p.theme.radius.control};
  padding: 0 12px;
  min-block-size: 44px;

  &:hover { background: ${(p) => p.theme.action.ghostBgHover}; }
`;

const Apply = styled.button`
  font: inherit;
  font-size: var(--ds-typography-label-size);
  min-block-size: 44px;
  padding: 0 20px;
  cursor: pointer;
  border: none;
  border-radius: ${(p) => p.theme.radius.control};
  background: ${(p) => p.theme.action.primaryBg};
  color: ${(p) => p.theme.action.primaryText};

  &:disabled {
    background: ${(p) => p.theme.action.disabledBg};
    color: ${(p) => p.theme.action.disabledText};
    cursor: default;
  }
  &:not(:disabled):hover { background: ${(p) => p.theme.action.primaryBgHover}; }
`;
