# 書嶼 FOLIO｜圖書管理系統

以原生 HTML、CSS 與 JavaScript 建立的圖書管理介面，支援 **繁體中文、English、日本語**，無需安裝前端依賴。

## 多語言

在右上角選擇介面語言。選單、表單、分類、借閱狀態、提示訊息、使用說明與日期顯示會同步切換，並使用 `folio-language` 記住選擇。預設為繁體中文。

書名、作者、館藏編號與讀者資料保留原文。分類以既有識別值儲存、依語言顯示，因此切換語言不會改寫既有 `folio-v1` 資料。

## 功能

- 館藏新增、編輯、搜尋、分類與分頁
- 借書、歸還、續借與逾期追蹤
- 讀者名冊新增、編輯與搜尋
- 館藏統計與 JSON 資料匯出
- 響應式版面與三種介面語言

## 本機執行

在專案目錄啟動靜態伺服器，例如已安裝 Python 時：

```sh
python -m http.server 8000 --directory dist
```

瀏覽 <http://localhost:8000>，或使用 VS Code Live Server 開啟 `dist/index.html`。

## 檔案結構

```text
dist/
  index.html  # 介面入口與語言選擇器
  style.css   # 樣式與響應式版面
  i18n.js     # 繁中、英文、日文翻譯與語系設定
  app.js      # 初始資料與應用狀態
  ui.js       # 頁面、表單、借閱及資料儲存邏輯
tests/
  i18n.test.cjs
```

## 測試

使用 Node.js 18 以上版本執行（不需安裝套件）：

```sh
node --test tests/i18n.test.cjs
```

涵蓋翻譯鍵與參數完整性、語系記憶、原有資料保留，以及三種語言的頁面、表單與借還流程。這些測試不包含瀏覽器視覺驗證。

## 資料與限制

本版本使用瀏覽器 localStorage（`folio-v1`）儲存資料，初始館藏、讀者與館藏編號為示範資料。不同瀏覽器、裝置與網站來源之間不會同步。清除網站資料會移除紀錄，請定期使用「匯出資料」下載 JSON 備份。目前未提供備份匯入、伺服器資料庫、登入權限與多人協作。

每個實體複本使用唯一館藏編號；預設借期 14 天，未逾期書籍可續借一次並延長 14 天。

Google Fonts 為外部字型來源，離線時使用系統備用字型。

## English

FOLIO is a browser-based library management app built with plain HTML, CSS and JavaScript. Use the language selector at the top right to switch between Traditional Chinese, English and Japanese. Your preference is remembered; catalog and patron data stay in their original language.

Run `python -m http.server 8000 --directory dist` from the project directory, then open <http://localhost:8000>. Features include catalog search and editing, patron management, checkout, returns, renewals, overdue tracking and JSON exports.

Records are stored in this browser's localStorage. There is no shared database, authentication, backup import or multi-user synchronization. Clearing site data removes records. Export backups regularly. Initial records are demonstration data.

## 日本語

FOLIOは、HTML・CSS・JavaScriptで構築したブラウザー用の図書管理アプリです。右上の言語選択で繁体字中国語・英語・日本語を切り替えられます。選択した言語は保存され、書名・著者・利用者情報は原文のまま保持されます。

プロジェクトのフォルダーで `python -m http.server 8000 --directory dist` を実行し、<http://localhost:8000> を開いてください。蔵書検索・編集、利用者管理、貸出・返却・延長、期限超過の確認、JSONエクスポートに対応しています。

データはこのブラウザーのlocalStorageに保存されます。共有データベース・認証・バックアップのインポート・複数利用者間の同期には対応していません。サイトデータを削除すると記録も消えるため、定期的にエクスポートしてください。初期データはデモ用です。

## 設計參考 / Reference / 参考資料

借閱流程參考 [Koha 借閱管理文件](https://koha-community.org/manual/22.05/en/html/circulation.html)，介面為書嶼原創設計。
