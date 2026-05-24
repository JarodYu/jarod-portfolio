# 余建德 Jarod Yu 作品集網站

這是一個免費可部署的一頁式作品集網站，使用純 HTML、CSS、JavaScript 製作，不需要 React、Next.js 或任何建置工具。

## 專案結構

```text
.
├── index.html
├── style.css
├── script.js
├── assets/
│   ├── case1.png
│   ├── case2.png
│   ├── case3.png
│   ├── case4.png
│   ├── hero-live.mp4
│   ├── ig-growth.jpg
│   └── line-qr.jpg
└── README.md
```

部署作品集時只需要以上檔案與 `assets` 資料夾。

## 1. 如何在本機預覽

方法一：直接開啟檔案

1. 在資料夾中找到 `index.html`
2. 用瀏覽器開啟即可預覽

方法二：用本機伺服器預覽

如果你的電腦有 Python，可以在專案資料夾中執行：

```bash
python3 -m http.server 8000
```

接著打開：

```text
http://localhost:8000
```

## 2. 如何部署到 GitHub Pages

1. 建立一個新的 GitHub Repository
2. 將 `index.html`、`style.css`、`script.js`、`README.md` 與 `assets` 資料夾上傳到 Repository 根目錄
3. 進入 Repository 的 `Settings`
4. 點選左側 `Pages`
5. 在 `Build and deployment` 區塊選擇：
   - Source：`Deploy from a branch`
   - Branch：`main`
   - Folder：`/ (root)`
6. 儲存後等待 GitHub 產生網址

部署完成後，作品集網址通常會像這樣：

```text
https://你的帳號.github.io/你的repo名稱/
```

## 3. 如何部署到 Vercel

1. 前往 [Vercel](https://vercel.com/)
2. 使用 GitHub 帳號登入
3. 點選 `Add New Project`
4. 選擇這個作品集 Repository
5. Framework Preset 選擇 `Other`
6. Build Command 留空
7. Output Directory 留空
8. 點選 `Deploy`

部署完成後，Vercel 會提供一組可直接放在履歷上的作品集網址。

## 修改作品連結

4 個案例卡片的「觀看作品」按鈕已放入目前作品連結。之後如果要替換，只要在 `index.html` 找到：

```html
<a class="work-link" href="https://example.com" target="_blank" rel="noreferrer">觀看作品</a>
```

把 `href` 裡的網址換成新的作品網址即可。

## 修改精選成果圖片

目前精選成果圖片放在：

```text
assets/ig-growth.jpg
```

之後若要替換圖片，使用同一個檔名覆蓋即可。
