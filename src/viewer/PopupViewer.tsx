import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';
import styled from 'styled-components';
import { Icon } from '../components/Icon';
import { POPUP_KIND, missingOf, titleOf } from '../model/popups';
import { urlOf, youtubeId } from '../editor/assets';
import type { Block, PopupItem } from '../model/types';

type Ctx = {
  /** 打開某個元件的補充。點角標就是呼叫這個。 */
  open: (block: Block) => void;
  /**
   * 掛上「從檢視器直接去編輯」的入口。
   *
   * 由編輯器自己註冊，因為只有它知道怎麼開設定面板；
   * 預覽與學生端沒有人註冊，那顆按鈕就不會出現。
   */
  registerEdit: (fn: ((blockId: string) => void) | null) => void;
};

const ViewerCtx = createContext<Ctx | null>(null);

export const usePopupViewer = () => useContext(ViewerCtx);

/**
 * 補充內容的檢視器。老師編的時候與學生上課看到的是同一個元件——
 * 兩邊各做一份，遲早會不一樣，而不一樣的那天是在課堂上。
 */
export function PopupViewerProvider({
  children,
  onJump,
}: {
  children: ReactNode;
  /** 「跳到某一段」要由外層決定怎麼跳：預覽是換頁，編輯是捲動。 */
  onJump?: (rowId: string) => void;
}) {
  const [block, setBlock] = useState<Block | null>(null);
  const [onEdit, setOnEdit] = useState<((blockId: string) => void) | null>(null);
  const open = useCallback((b: Block) => setBlock(b), []);
  const close = useCallback(() => setBlock(null), []);
  // 包一層函式，否則 setState 會把傳進來的函式當成 updater 執行掉
  const registerEdit = useCallback(
    (fn: ((blockId: string) => void) | null) => setOnEdit(() => fn),
    []
  );
  const ctx = useMemo(() => ({ open, registerEdit }), [open, registerEdit]);

  // Esc 關閉。上課中老師常常一手拿平板，鍵盤與觸控都要能收起來
  useEffect(() => {
    if (!block) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        close();
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [block, close]);

  return (
    <ViewerCtx.Provider value={ctx}>
      {children}
      {block &&
        createPortal(
          <Scrim onClick={close}>
            <Sheet
              role="dialog"
              aria-modal="true"
              aria-label="補充內容"
              onClick={(e) => e.stopPropagation()}
            >
              <Head>
                <Icon name="popup" size={20} />
                <strong>補充內容</strong>
                <Count>{block.popups.length} 項</Count>
                <Spacer />
                {onEdit && (
                  <Ghost onClick={() => { close(); onEdit(block.id); }}>
                    <Icon name="pencil" size={16} />
                    編輯
                  </Ghost>
                )}
                <Ghost onClick={close} aria-label="關閉">
                  <Icon name="x" size={20} label="關閉" />
                </Ghost>
              </Head>

              <List>
                {block.popups.map((item) => (
                  <Item key={item.id} item={item} onJump={onJump} onClose={close} />
                ))}
              </List>
            </Sheet>
          </Scrim>,
          document.body
        )}
    </ViewerCtx.Provider>
  );
}

/** 每一項的行動鈕依它自己的 kind 決定，不看它旁邊有幾項。 */
function Item({
  item,
  onJump,
  onClose,
}: {
  item: PopupItem;
  onJump?: (rowId: string) => void;
  onClose: () => void;
}) {
  const [openBody, setOpenBody] = useState(false);
  const meta = POPUP_KIND[item.kind];
  const missing = missingOf(item);

  return (
    <Row>
      <Kind>
        <Icon name={meta.icon} size={20} />
      </Kind>
      <Body>
        <Title>{titleOf(item)}</Title>
        {missing ? (
          <Missing>{missing}</Missing>
        ) : (
          <Kindly>{meta.label}</Kindly>
        )}

        {openBody && item.kind === 'text' && <Text>{item.body}</Text>}
        {openBody && item.kind === 'image' && <Media src={urlOf(item.assetId)} alt={item.title} />}
        {openBody && item.kind === 'video' && <VideoBody item={item} />}
        {openBody && item.kind === 'audio' && (
          <audio controls src={urlOf(item.assetId)} style={{ width: '100%' }} />
        )}
      </Body>

      {!missing && (
        <Action
          onClick={() => {
            if (item.kind === 'jump') {
              onClose();
              if (item.targetRowId) onJump?.(item.targetRowId);
              return;
            }
            if (item.kind === 'web') {
              // embeddable 恆為 false，所以一律開新分頁。接上客戶的
              // 檢查 API 之後，可嵌入的就改成在這裡展開頁內瀏覽
              window.open(item.url, '_blank', 'noopener,noreferrer');
              return;
            }
            setOpenBody((v) => !v);
          }}
        >
          {openBody && item.kind !== 'web' && item.kind !== 'jump' ? '收起' : meta.action}
        </Action>
      )}
    </Row>
  );
}

/**
 * 影片只有在這裡才真的載入播放器——一次一支。
 * 編輯畫面上放 iframe 會讓一頁同時載入好幾個外部播放器，
 * 而且它們的非同步版面會攪亂分頁量測。
 */
function VideoBody({ item }: { item: Extract<PopupItem, { kind: 'video' }> }) {
  if (item.source === 'youtube') {
    const id = youtubeId(item.ref);
    if (!id) return <Missing>影片網址無法辨識</Missing>;
    return (
      <Embed
        src={`https://www.youtube-nocookie.com/embed/${id}`}
        title={item.title || '影片'}
        allow="accelerometer; clipboard-write; encrypted-media; picture-in-picture"
        allowFullScreen
      />
    );
  }
  // 上傳的影片：ref 存的是 assetId
  const src = urlOf(item.ref || null);
  return src ? <video controls src={src} style={{ width: '100%' }} /> : <Missing>影片還沒上傳</Missing>;
}

/* 遮罩需要半透明，但設計系統目前沒有 scrim token——
   Figma 那一包補上之後改成 token（見 HANDOVER 的待補清單）。 */
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
  inline-size: min(560px, 100%);
  max-block-size: min(72vh, 640px);
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

const Spacer = styled.span`
  flex: 1;
`;

const Count = styled.span`
  color: ${(p) => p.theme.text.tertiary};
  font-size: var(--ds-typography-label-size);
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
  padding: 8px 10px;
  min-block-size: 40px;

  &:hover { background: ${(p) => p.theme.action.ghostBgHover}; }
`;

const List = styled.ul`
  margin: 0;
  padding: ${(p) => p.theme.space.insetSm} 0;
  list-style: none;
  overflow-y: auto;
`;

const Row = styled.li`
  display: flex;
  align-items: flex-start;
  gap: ${(p) => p.theme.space.gapMd};
  padding: ${(p) => p.theme.space.insetSm} ${(p) => p.theme.space.insetLg};
`;

const Kind = styled.span`
  display: grid;
  place-items: center;
  inline-size: 40px;
  block-size: 40px;
  flex: none;
  border-radius: ${(p) => p.theme.radius.field};
  background: ${(p) => p.theme.surface.sunken};
  color: ${(p) => p.theme.text.secondary};
`;

const Body = styled.div`
  flex: 1;
  min-inline-size: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding-block-start: 2px;
`;

const Title = styled.div`
  font-size: var(--ds-typography-body-sm-size);
  font-weight: 600;
`;

const Kindly = styled.span`
  font-size: var(--ds-typography-label-size);
  color: ${(p) => p.theme.text.tertiary};
`;

const Missing = styled.span`
  font-size: var(--ds-typography-label-size);
  color: ${(p) => p.theme.feedback.warningDefault};
`;

const Text = styled.p`
  margin: 8px 0 0;
  font-size: var(--ds-typography-body-sm-size);
  line-height: var(--ds-typography-body-sm-line-height);
  color: ${(p) => p.theme.text.secondary};
  white-space: pre-wrap;
`;

const Media = styled.img`
  margin-block-start: 8px;
  max-inline-size: 100%;
  border-radius: ${(p) => p.theme.radius.field};
`;

const Embed = styled.iframe`
  margin-block-start: 8px;
  inline-size: 100%;
  aspect-ratio: 16 / 9;
  border: none;
  border-radius: ${(p) => p.theme.radius.field};
`;

const Action = styled.button`
  flex: none;
  border: ${(p) => p.theme.border.widthDefault} solid ${(p) => p.theme.action.secondaryBorder};
  background: ${(p) => p.theme.action.secondaryBg};
  color: ${(p) => p.theme.action.secondaryText};
  font: inherit;
  font-size: var(--ds-typography-label-size);
  border-radius: ${(p) => p.theme.radius.control};
  /* 上課用平板點的，觸控目標不能小於 44 */
  min-block-size: 44px;
  padding: 0 16px;
  cursor: pointer;

  &:hover { background: ${(p) => p.theme.action.secondaryBgHover}; }
`;
