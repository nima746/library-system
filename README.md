# 書嶼 FOLIO｜圖書管理系統

繁體中文圖書管理介面，以原生 HTML、CSS 與 JavaScript 建立，無需安裝前端依賴。

## 功能

- 館藏新增、編輯、搜尋、分類與分頁
- 借書、歸還、續借與逾期追蹤
- 讀者名冊新增、編輯與搜尋
- 館藏統計與 JSON 資料匯出
- 響應式版面

## 本機執行

在專案目錄啟動靜態伺服器，例如已安裝 Python 時：

```sh
python -m http.server 8000 --directory dist
```

瀏覽 http://localhost:8000 。亦可使用 VS Code Live Server 開啟 dist/index.html。

## 檔案結構

```text
dist/
  index.html  # 介面入口
  style.css   # 樣式與響應式版面
  app.js      # 館藏、讀者、借閱與資料儲存邏輯
```

## 資料與限制

本版本使用瀏覽器 localStorage（folio-v1）儲存資料，初始館藏、讀者與館藏編號為示範資料。不同瀏覽器、裝置與網站來源之間不會同步。清除網站資料會移除紀錄，請定期使用「匯出資料」下載 JSON 備份。目前未提供備份匯入、伺服器資料庫、登入權限與多人協作。

每個實體複本使用唯一館藏編號；預設借期 14 天，未逾期書籍可續借一次並延長 14 天。

Google Fonts 為外部字型來源，離線時使用系統備用字型。

## 設計參考

借閱流程參考 [Koha 借閱管理文件](https://koha-community.org/manual/22.05/en/html/circulation.html)，介面為書嶼原創設計。
