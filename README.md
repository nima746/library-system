# 書嶼 FOLIO｜全端圖書管理系統 v2

繁體中文 / English / 日本語。原生 JavaScript 前端、REST API、持久化 SQL 資料庫，以及 Sites 提供的 ChatGPT 登入。無需安裝 npm 依賴。

## 已完成功能

- 登入帳號專屬的雲端館藏，跨裝置存取；伺服器逐筆檢查資料所有權
- 館藏與讀者新增、修改、搜尋、分類、封存與恢復
- 借出、歸還、續借、逾期追蹤與統計儀表板
- 資料庫防止同一本書重複借出，版本號防止舊資料覆蓋新修改
- 資料庫自動記錄操作履歷
- JSON 備份匯出、空白帳號備份匯入，以及舊版本機資料移行
- 三語介面、日期在地化、語言偏好記憶、載入與連線錯誤狀態
- 真實 SQLite 整合測試及 GitHub Actions 自動檢查

## 架構

```text
瀏覽器（三語介面）
    → 同來源 REST API
    → Sites 身分驗證與帳號所有權檢查
    → Cloudflare D1（正式）／SQLite（本機）
```

每個登入帳號擁有獨立圖書資料，並管理該帳號的全部館藏。此版不包含共用館藏、員工邀請或讀者自行登入。既有私人網站的存取範圍不變。

## 本機啟動

需要 Node.js 22.13 以上（使用內建 node:sqlite）。在專案目錄執行：

```sh
npm run dev
```

開啟終端機顯示的 http://127.0.0.1:8000 。本機伺服器只監聽 loopback，使用本機開發者身分，資料保存於 `.local/library.sqlite`。正式版本沒有這個開發者身分；登入由 Sites 處理。請勿將本機開發伺服器公開。

這是全端應用，不能再用 Python 靜態伺服器或直接開啟 HTML 完整使用。

```sh
npm test
npm run build
```

建置會把前端資源嵌入 `dist/server/index.js`，產生可部署的 Worker ES Module。

## 正式部署

沿用既有 Sites，`.openai/hosting.json` 宣告 D1 綁定 `DB`。SQL migration 位於 `drizzle/`，由 Sites 部署流程在上傳 Worker 前套用。正式環境不可在請求中建立或修改資料表。已套用的 migration 不可修改，後續結構變更應新增 migration。

正式端點依賴 Sites 驗證並注入的身分標頭。不要另開可接受客戶端偽造標頭的公開 Worker 入口；若移往其他平台，必須實作該平台的身分驗證。網站登入與登出路由由 Sites 提供，專案沒有預設密碼或自行保存的密碼資料。

## 從 v1 移行

1. 登入原本的網站與帳號。
2. 開啟「資料與帳號」。
3. 選擇「匯入舊版本機資料」，或選取之前匯出的 JSON 備份。
4. 檢查筆數並確認匯入。資料會整批保存到目前帳號；舊版 localStorage 不會被刪除。

匯入僅限尚無資料、也未曾匯入的帳號；最多 2 MB、2,000 筆。匯入不會合併或覆蓋現有館藏。封存仍視為既有資料。新帳號也可選擇「加入示範資料」，示範資料不會自動加入正式館藏。

備份含讀者聯絡資料，請自行妥善保管。書名、作者、讀者姓名及分類儲存值保留原文，切換語言不會改寫資料。

## 借閱規則

每個實體複本使用唯一館藏編號，同帳號內讀者證號也不可重複。預設借期 14 天，可選今天至 60 天內的應還日；未逾期借閱可續借一次、延長 14 天。歸還或修改需符合目前版本號。借閱中的書籍及讀者不能封存。

## 原始碼

| 路徑 | 用途 |
| --- | --- |
| `dist/index.html`, `style.css` | 前端入口與響應式樣式（作者來源檔） |
| `dist/i18n.js` | 三語字典與語言偏好 |
| `dist/app.js`, `ui.js`, `backend.js` | 前端狀態、畫面、API 與移行流程 |
| `server/api.mjs` | 身分、權限、驗證與業務 API |
| `server/sqlite.mjs` | 本機／測試 D1 相容 SQLite adapter |
| `drizzle/` | 正式資料庫結構遷移與索引／稽核 triggers |
| `scripts/` | 本機開發與 Worker 建置 |
| `tests/` | API／SQL 整合、持久化與三語畫面邏輯測試 |
| `docs/API.md` | API 規格、安全邊界與錯誤碼 |

## 目前範圍

適合小型館藏。畫面載入帳號資料快照後在前端分頁；大型部署應補上伺服器搜尋分頁、備份排程、監控與資料保存政策。目前未提供員工角色協作、郵件通知、罰款金流、MARC 編目或條碼硬體整合。自動化測試不等於完整瀏覽器視覺驗證。

Google Fonts 為外部字型來源，離線時使用系統備用字型。

## English

FOLIO v2 is a full-stack library app with a multilingual JavaScript frontend, authenticated REST API and persistent SQL storage. Sites supplies production ChatGPT authentication; every record is scoped to the signed-in account. This version provides an account-owned library rather than shared staff workspaces or patron logins.

Use Node.js 22.13+ and run `npm run dev` for the loopback-only development server with persistent local SQLite. Run `npm test` and `npm run build` for validation and Worker output. Production uses Sites and its D1 binding `DB`. Never expose the production Worker outside the trusted Sites authentication gateway without implementing verified authentication.

Use Data & account to export backups or import legacy browser records into an empty, never-imported account. Import is atomic, up to 2 MB / 2,000 records, and never deletes the legacy browser data. See [API documentation](docs/API.md) for ownership, concurrency rules and current limitations.

## 日本語

FOLIO v2は、3言語対応のJavaScript画面、認証付きREST API、永続SQLデータベースを備えた全端図書管理アプリです。正式環境のChatGPTログインはSitesが提供し、データはアカウントごとに分離されます。職員間での共用館や利用者自身のログインには未対応です。

Node.js 22.13以上で `npm run dev` を実行すると、loopback限定の開発サーバーと永続SQLiteを利用できます。`npm test` で検証し、`npm run build` でWorkerを生成します。正式環境はSitesの認証ゲートウェイとD1バインディング `DB` を利用します。別の公開入口を追加する場合は、検証済み認証の実装が必要です。

「データ・アカウント」でバックアップを出力し、未使用の空のアカウントに旧版データを移行できます。インポートは最大2 MB・2,000件の一括処理で、旧版のブラウザーデータは削除しません。詳細は [API仕様](docs/API.md) を参照してください。

## 設計參考

借閱流程參考 [Koha 借閱管理文件](https://koha-community.org/manual/22.05/en/html/circulation.html)，介面為書嶼原創設計。
