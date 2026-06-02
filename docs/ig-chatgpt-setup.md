# IG 串接 ChatGPT 自動回覆設定步驟

這份是第一版 MVP：Instagram 官方 Webhook 收到私訊或留言，交給 OpenAI 判斷回覆與名單欄位，再透過 Meta 官方 API 回覆，並把有效名單送到 Google Sheets、Make、Zapier 或 CRM webhook。

## 1. 本機環境檔

已建立 `.env.local` 保存 OpenAI API key。請再依照 `.env.example` 補上 Meta 設定：

```text
META_VERIFY_TOKEN=自己取一組隨機字串
META_APP_SECRET=Meta App Secret
META_ACCESS_TOKEN=Instagram / Page access token
IG_ACCOUNT_ID=你的 Instagram professional account id
AUTO_REPLY_ENABLED=false
COMMENT_REPLY_ENABLED=false
LEADS_WEBHOOK_URL=
```

先保持 `AUTO_REPLY_ENABLED=false`，測試確認正常後再改成 `true`。

## 2. Meta 後台建立 App

1. 到 Meta for Developers 建立 App。
2. App 類型選 Business 相關類型。
3. 加入 Instagram 相關產品或 Messenger API for Instagram。
4. 將 IG 帳號切成 Professional / Business，並確認它在你的 Business Portfolio 裡。
5. 申請訊息與留言需要的權限，例如：
   - `instagram_business_basic`
   - `instagram_business_manage_messages`
   - `instagram_business_manage_comments`
   - 若走舊版 Facebook Page 連接模式，可能還會用到 Page messaging 相關權限。

Meta 版本與權限名稱會調整，後台審核頁面顯示的名稱以當下為準。

## 3. 設定 Webhook

部署後，你的 webhook URL 會是：

```text
https://你的網域/api/ig-webhook
```

在 Meta Webhook 設定填入：

```text
Callback URL: https://你的網域/api/ig-webhook
Verify token: .env.local 裡的 META_VERIFY_TOKEN
```

訂閱 Instagram 訊息與留言事件。常見會用到：

```text
messages
messaging_postbacks
comments
```

實際可選事件以 Meta App Dashboard 當下顯示為準。

## 4. 先測 webhook 驗證

這台目前可以不用安裝套件，直接用 Node 跑測試伺服器：

```bash
META_VERIFY_TOKEN=你設定的token node tools/dev-ig-webhook-server.mjs
```

本機網址會是：

```text
http://localhost:8787/api/ig-webhook
```

如果之後有安裝 Vercel CLI，也可以跑：

```bash
npm run dev
```

用 ngrok 或 Cloudflare Tunnel 把本機網址公開給 Meta。確認 Meta 後台 webhook 驗證通過後，再測試私訊。

## 5. 打開自動回覆

測試時先看伺服器紀錄，不直接回 IG：

```text
AUTO_REPLY_ENABLED=false
COMMENT_REPLY_ENABLED=false
```

確認 AI 回覆內容沒問題後：

```text
AUTO_REPLY_ENABLED=true
```

留言公開自動回覆建議晚一點再開：

```text
COMMENT_REPLY_ENABLED=true
```

公開留言不要要求電話或 Line，應該只引導對方私訊。

## 6. 名單送到 Google Sheets

最簡單做法是建立一個 Google Apps Script Web App，接收 `LEADS_WEBHOOK_URL`。

1. 建立一個 Google Sheet。
2. 點「擴充功能」→「Apps Script」。
3. 貼上 `docs/google-sheets-leads-apps-script.js` 的內容。
4. 設定 `SHARED_SECRET`。
5. 部署成 Web App，存取權限選你要接收 webhook 的設定。
6. 把部署 URL 填進 `.env.local`：

```text
LEADS_WEBHOOK_URL=https://script.google.com/macros/s/.../exec?secret=你的SHARED_SECRET
```

它會收到這種資料：

```json
{
  "lead": {
    "ig_user_id": "123",
    "name": "王小明",
    "contact": "0912...",
    "need": "想了解短影音代操",
    "budget": "3-5萬",
    "location": "台北",
    "preferred_time": "下午",
    "summary": "想找團隊經營 IG Reels",
    "missing_fields": [],
    "source_channel": "instagram_dm",
    "intent_level": "hot",
    "created_at": "2026-06-02T..."
  }
}
```

也可以把 `LEADS_WEBHOOK_URL` 換成 Make、Zapier、n8n、HubSpot、Notion、Airtable 或自己的 CRM。

## 7. 上線前檢查

- 不要把 `.env.local` 上傳。
- Meta App 要切 Live，正式用戶才會進來。
- 隱私權政策要寫清楚會處理 IG 訊息、用 AI 協助客服、保存名單資料。
- 保留人工接手流程。
- 不要主動大量私訊陌生人。
- 名單只收必要欄位，避免收敏感資料。
