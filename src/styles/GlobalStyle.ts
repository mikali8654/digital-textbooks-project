import { createGlobalStyle } from 'styled-components';

export const GlobalStyle = createGlobalStyle`
  *, *::before, *::after { box-sizing: border-box; }

  html, body, #root { height: 100%; }

  body {
    margin: 0;
    background: ${(p) => p.theme.surface.sunken};
    color: ${(p) => p.theme.text.primary};
    font-family: ${(p) => p.theme.typography.fontSans};
    font-size: ${(p) => p.theme.typography.bodyLgSize};
    line-height: ${(p) => p.theme.typography.bodyLgLineHeight};
    -webkit-font-smoothing: antialiased;
  }

  /*
   * 表單元素不繼承字體。瀏覽器給它們自己的預設字（Mac 上是 Arial）與
   * 13.33px，中文因此掉回系統字。縮圖、評論卡片、圖片替代文字、徽章
   * 都包在 <button> 裡才能點，少了這行，那些地方的字體和字級就跟
   * 畫布對不起來——同一份內容在縮圖裡和在頁面上長得不一樣。
   */
  button, input, select, textarea { font: inherit; }

  /* 只有鍵盤操作才顯示 focus 環，滑鼠點擊不觸發 */
  :focus-visible {
    outline: ${(p) => p.theme.border.widthFocus} solid ${(p) => p.theme.action.ghostFocusRing};
    outline-offset: 2px;
  }
  :focus:not(:focus-visible) { outline: none; }

  /*
   * 行內標記的樣式。
   *
   * 放在全域而不是 styled-component，因為量測用的隱形探針、編輯區、
   * 預覽、檢視台都要長得一模一樣——注音會撐高行高，四邊只要有一邊
   * 少了這段 CSS，量到的高度就跟畫出來的不一致，內容會被切掉。
   * 這跟 blockSizing 是同一條原則：量測與渲染共用同一個來源。
   */
  .ds-rich {
    white-space: pre-wrap;
    word-break: break-word;

    ruby { ruby-position: over; }

    rt {
      font-size: 0.4em;
      line-height: 1;
      color: ${(p) => p.theme.text.secondary};
      user-select: none;
    }

    /*
     * 重點詞是語意標記：生字表與全書搜尋都靠它，不是單純的底線。
     *
     * 橫排畫在字下面，直排畫在字的右側——中文的著重號本來就在右邊，
     * 直排時 block-end 是左邊，畫在那裡會變成錯的一側。
     */
    [data-kw] { border-block-end: 2px solid ${(p) => p.theme.border.accent}; }

    [data-bold] { font-weight: 700; }
    [data-color='accent'] { color: ${(p) => p.theme.text.accent}; }
    [data-color='secondary'] { color: ${(p) => p.theme.text.secondary}; }

    /*
     * 注釋號是一個原子，跟注音同一類：看得到、刪得掉，但編不進去。
     * 游標計算會跳過它（見 editor/caret.ts），所以行內標記的範圍
     * 不會因為課文裡有 25 個編號而整段位移。
     */
    sup[data-fn] {
      font-size: 0.6em;
      font-weight: 700;
      color: ${(p) => p.theme.text.accent};
      margin-inline-start: 2px;
      user-select: none;
      cursor: default;
    }
  }

  [data-vertical] .ds-rich [data-kw],
  .ds-rich[data-vertical] [data-kw] {
    border-block-end: none;
    border-block-start: 2px solid ${(p) => p.theme.border.accent};
  }

  @media (prefers-reduced-motion: reduce) {
    *, *::before, *::after {
      animation-duration: 0.01ms !important;
      transition-duration: 0.01ms !important;
    }
  }
`;
