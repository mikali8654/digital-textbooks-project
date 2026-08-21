import { iconPaths, type IconName } from '../assets/icons.generated';

export type IconSize = 16 | 20 | 24;

type Props = {
  name: IconName;
  /** 只允許設計系統的三個尺寸（--ds-size-icon-sm/md/lg）。 */
  size?: IconSize;
  /** 有意義的圖示要給 label；純裝飾留空，會標成 aria-hidden。 */
  label?: string;
  className?: string;
};

/**
 * 線條色永遠是 currentColor，由外層的文字色決定，所以圖示會自動
 * 跟著按鈕／膠囊的狀態變色，不需要為每個狀態各做一顆。
 */
export function Icon({ name, size = 24, label, className }: Props) {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="var(--ds-border-width-icon)"
      strokeLinecap="round"
      strokeLinejoin="round"
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      focusable="false"
      dangerouslySetInnerHTML={{ __html: iconPaths[name] }}
    />
  );
}
