import { useEffect, useRef } from 'react';

type Props = {
  value: string;
  onChange: (next: string) => void;
  className?: string;
  style?: React.CSSProperties;
  placeholder?: string;
  onFocus?: () => void;
};

/**
 * 可以直接打字的文字。
 *
 * 刻意做成「非受控」：打字時不把 React 的值寫回 DOM，
 * 否則每按一鍵都會重設 textContent，游標會跳回開頭。
 * 只有在沒有焦點、而且值真的不一樣時才同步——那是外部改動
 * （復原、匯入、換教材）造成的。
 */
export function EditableText({ value, onChange, className, style, placeholder, onFocus }: Props) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (document.activeElement === el) return;
    if (el.textContent !== value) el.textContent = value;
  }, [value]);

  return (
    <div
      ref={ref}
      className={className}
      style={style}
      contentEditable
      suppressContentEditableWarning
      role="textbox"
      aria-multiline="true"
      data-placeholder={placeholder}
      onFocus={onFocus}
      onInput={(e) => onChange(e.currentTarget.textContent ?? '')}
      onPaste={(e) => {
        // 貼上一律轉純文字：保留段落，丟掉來源的字體大小顏色。
        // 帶格式貼上會讓內容重新變成「有樣式的文字」而不是「有分類的內容」，
        // 那正是這次改版要解決的問題。
        e.preventDefault();
        const text = e.clipboardData.getData('text/plain');
        document.execCommand('insertText', false, text);
      }}
    />
  );
}
