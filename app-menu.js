
(() => {
  "use strict";

  // ==========================================
  // 1. アイコン画像の保存場所
  // ==========================================

  const scriptUrl = document.currentScript?.src;

  if (!scriptUrl) return;

  const assetUrl = (filename) => {
    return new URL(filename, scriptUrl).href;
  };


  // ==========================================
  // 2. アプリ一覧
  // ==========================================

  const APPS = [
    {
      name: "活動記録表",
      icon: "activity.png",
      url: "https://kotom0919.github.io/Activity-Log-ver.2/"
    },
    {
      name: "服薬管理",
      icon: "medication.png",
      url: "https://kotom0919.github.io/Medication-management-app/"
    },
    {
      name: "睡眠体調管理アプリ1",
      icon: "sleep1.png",
      url: "https://kotom0919.github.io/Sleep-and-Mood-Tracking-ver.1/"
    },
    {
      name: "睡眠体調管理アプリ2",
      icon: "sleep2.png",
      url: "https://kotom0919.github.io/Sleep-and-Mood-Tracking-ver2-/"
    }
  ];


  // ==========================================
  // 3. メニューのデザイン
  // ==========================================

  const CSS = `
    #shared-app-menu-root {
      font-family: system-ui, -apple-system,
        "Noto Sans JP", sans-serif;
    }

    #shared-app-menu-root,
    #shared-app-menu-root * {
      box-sizing: border-box;
    }

    /* アプリ一覧ボタン */
    #shared-app-menu-button {
      position: fixed;
      right: 14px;
      bottom: calc(86px + env(safe-area-inset-bottom, 0px));
      z-index: 2147483000;

      border: 0;
      border-radius: 999px;
      padding: 12px 16px;

      background: #276b55;
      color: white;

      font-size: 14px;
      font-weight: 700;

      box-shadow: 0 4px 16px #0003;
      cursor: pointer;
    }

    /* 背景 */
    #shared-app-menu-overlay[hidden] {
      display: none !important;
    }

    #shared-app-menu-overlay {
      position: fixed;
      inset: 0;
      z-index: 2147483001;

      display: flex;
      align-items: center;
      justify-content: center;

      padding: 16px;
      background: rgb(0 0 0 / 58%);
    }

    /* メニュー本体 */
    #shared-app-menu-dialog {
      width: min(100%, 460px);
      max-height: min(85dvh, 760px);
      overflow-y: auto;

      border-radius: 22px;
      padding: 20px;

      background: white;
      color: #20242a;

      box-shadow: 0 16px 56px #0005;
    }

    /* タイトル */
    #shared-app-menu-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;

      margin-bottom: 20px;
    }

    #shared-app-menu-title {
      margin: 0;
      font-size: 21px;
      font-weight: 700;
    }

    /* 閉じるボタン */
    #shared-app-menu-close {
      display: grid;
      place-items: center;

      width: 42px;
      height: 42px;

      padding: 0;
      border: 0;
      border-radius: 50%;

      background: #f0f1f3;
      color: #222;

      font-size: 26px;
      cursor: pointer;
    }

    /* アプリを2列×2行に配置 */
    #shared-app-menu-grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 22px 14px;
    }

    /* 各アプリ */
    .shared-app-menu-link {
      display: flex;
      flex-direction: column;
      align-items: center;

      gap: 10px;
      padding: 5px;

      border-radius: 14px;
      text-decoration: none;

      color: inherit;
      text-align: center;

      font-size: 14px;
      font-weight: 650;
      line-height: 1.45;

      overflow-wrap: anywhere;
    }

    /* アプリアイコン */
    .shared-app-menu-icon {
      display: block;

      width: min(100%, 140px);
      aspect-ratio: 1;

      object-fit: contain;
      border-radius: 22%;
    }

    /* マウスを乗せたとき */
    .shared-app-menu-link:hover {
      background: #f1f7f4;
    }

    /* 現在開いているアプリ */
    .shared-app-menu-link[aria-current="page"] {
      background: #e9f5ef;
    }

    /* キーボード操作 */
    .shared-app-menu-link:focus-visible,
    #shared-app-menu-button:focus-visible,
    #shared-app-menu-close:focus-visible {
      outline: 3px solid #e4a027;
      outline-offset: 3px;
    }

    /* スマホ対応 */
    @media (max-width: 380px) {
      #shared-app-menu-dialog {
        padding: 16px;
      }

      #shared-app-menu-grid {
        gap: 16px 8px;
      }

      .shared-app-menu-link {
        font-size: 12px;
      }
    }
  `;


  // ==========================================
  // 4. メニューを作成
  // ==========================================

  function init() {

    // 二重作成を防止
    if (document.getElementById("shared-app-menu-root")) {
      return;
    }

    const root = document.createElement("div");
    root.id = "shared-app-menu-root";

    // CSSを追加
    const style = document.createElement("style");
    style.textContent = CSS;
    root.append(style);


    // ========================================
    // 5. アプリ一覧ボタン
    // ========================================

    const button = document.createElement("button");

    button.id = "shared-app-menu-button";
    button.type = "button";
    button.textContent = "▦ アプリ一覧";

    button.setAttribute("aria-haspopup", "dialog");
    button.setAttribute("aria-expanded", "false");


    // ========================================
    // 6. ポップアップ画面
    // ========================================

    const overlay = document.createElement("div");

    overlay.id = "shared-app-menu-overlay";
    overlay.hidden = true;

    const dialog = document.createElement("div");

    dialog.id = "shared-app-menu-dialog";

    dialog.setAttribute("role", "dialog");
    dialog.setAttribute("aria-modal", "true");
    dialog.setAttribute(
      "aria-labelledby",
      "shared-app-menu-title"
    );


    // ========================================
    // 7. タイトルと閉じるボタン
    // ========================================

    const header = document.createElement("div");
    header.id = "shared-app-menu-header";

    const title = document.createElement("h2");

    title.id = "shared-app-menu-title";
    title.textContent = "アプリ一覧";

    const close = document.createElement("button");

    close.id = "shared-app-menu-close";
    close.type = "button";
    close.textContent = "×";

    close.setAttribute("aria-label", "閉じる");

    header.append(title, close);


    // ========================================
    // 8. アプリのアイコンと名前を表示
    // ========================================

    const grid = document.createElement("div");
    grid.id = "shared-app-menu-grid";

    for (const app of APPS) {

      const link = document.createElement("a");

      link.className = "shared-app-menu-link";
      link.href = app.url;

      // アイコン画像
      const img = document.createElement("img");

      img.className = "shared-app-menu-icon";
      img.src = assetUrl(app.icon);
      img.alt = "";
      img.loading = "lazy";

      // アプリ名
      const label = document.createElement("span");
      label.textContent = app.name;

      link.append(img, label);

      // 現在のアプリを識別
      const currentPath = location.pathname
        .replace(/\/$/, "")
        .toLowerCase();

      const appPath = new URL(app.url).pathname
        .replace(/\/$/, "")
        .toLowerCase();

      if (
        location.origin === new URL(app.url).origin &&
        currentPath === appPath
      ) {
        link.setAttribute("aria-current", "page");
      }

      grid.append(link);
    }


    // ========================================
    // 9. ページに追加
    // ========================================

    dialog.append(header, grid);
    overlay.append(dialog);

    root.append(button, overlay);

    document.body.append(root);


    // ========================================
    // 10. メニューを開く・閉じる
    // ========================================

    let lastFocus = null;

    function openMenu() {

      lastFocus = document.activeElement;

      overlay.hidden = false;

      button.setAttribute("aria-expanded", "true");

      close.focus();
    }

    function closeMenu() {

      overlay.hidden = true;

      button.setAttribute("aria-expanded", "false");

      if (
        lastFocus &&
        typeof lastFocus.focus === "function"
      ) {
        lastFocus.focus();
      }
    }


    // ========================================
    // 11. ボタン操作
    // ========================================

    // アプリ一覧を開く
    button.addEventListener("click", openMenu);

    // ×で閉じる
    close.addEventListener("click", closeMenu);

    // 背景を押すと閉じる
    overlay.addEventListener("click", (event) => {

      if (event.target === overlay) {
        closeMenu();
      }

    });

    // Escキーで閉じる
    document.addEventListener("keydown", (event) => {

      if (overlay.hidden) return;

      if (event.key === "Escape") {
        closeMenu();
        return;
      }

      if (event.key !== "Tab") return;

      const focusables = [
        ...dialog.querySelectorAll('button, a[href]')
      ];

      const first = focusables[0];
      const last = focusables[focusables.length - 1];

      if (
        event.shiftKey &&
        document.activeElement === first
      ) {
        event.preventDefault();
        last.focus();
      } else if (
        !event.shiftKey &&
        document.activeElement === last
      ) {
        event.preventDefault();
        first.focus();
      }

    });

  }


  // ==========================================
  // 12. ページ読み込み後に実行
  // ==========================================

  if (document.readyState === "loading") {

    document.addEventListener(
      "DOMContentLoaded",
      init,
      { once: true }
    );

  } else {

    init();

  }

})();
