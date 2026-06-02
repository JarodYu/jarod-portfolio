import crypto from "node:crypto";

const GRAPH_BASE_URL = process.env.META_GRAPH_BASE_URL || "https://graph.instagram.com";
const GRAPH_VERSION = process.env.META_GRAPH_VERSION || "v23.0";
const OPENAI_MODEL = process.env.OPENAI_MODEL || "gpt-5-mini";

const recentReplies = new Map();

export const config = {
  api: {
    bodyParser: false
  }
};

export default async function handler(req, res) {
  const request = await toWebRequest(req);
  const response =
    req.method === "GET"
      ? await GET(request)
      : req.method === "POST"
        ? await POST(request)
        : new Response("Method not allowed", { status: 405 });

  await sendWebResponse(res, response);
}

export function GET(request) {
  const url = new URL(request.url);
  const mode = url.searchParams.get("hub.mode");
  const token = url.searchParams.get("hub.verify_token");
  const challenge = url.searchParams.get("hub.challenge");

  if (mode === "subscribe" && token === process.env.META_VERIFY_TOKEN) {
    return new Response(challenge || "", { status: 200 });
  }

  return Response.json({ error: "Webhook verification failed" }, { status: 403 });
}

export async function POST(request) {
  const rawBody = await request.text();

  if (!verifyMetaSignature(rawBody, request.headers.get("x-hub-signature-256"))) {
    return Response.json({ error: "Invalid Meta signature" }, { status: 401 });
  }

  let body;
  try {
    body = JSON.parse(rawBody);
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  try {
    await handleWebhookBody(body);
    return Response.json({ status: "EVENT_RECEIVED" });
  } catch (error) {
    console.error("IG webhook error", safeError(error));
    return Response.json({ error: "Webhook handler failed" }, { status: 500 });
  }
}

async function handleWebhookBody(body) {
  const entries = Array.isArray(body.entry) ? body.entry : [];

  for (const entry of entries) {
    const messagingEvents = Array.isArray(entry.messaging) ? entry.messaging : [];
    for (const event of messagingEvents) {
      await handleMessagingEvent(event);
    }

    const changes = Array.isArray(entry.changes) ? entry.changes : [];
    for (const change of changes) {
      await handleChangeEvent(change);
    }
  }
}

async function handleMessagingEvent(event) {
  if (event.message?.is_echo || event.read || event.delivery) return;

  const senderId = event.sender?.id;
  const text = normalizeText(event.message?.text);
  if (!senderId || !text) return;

  if (isCoolingDown(`dm:${senderId}`)) return;

  const decision = await askOpenAI({
    channel: "instagram_dm",
    userId: senderId,
    text
  });

  await deliverLead(decision, {
    channel: "instagram_dm",
    userId: senderId,
    sourceText: text,
    rawEvent: event
  });

  if (!decision.should_reply) return;

  const reply = clampReply(decision.reply_text || process.env.HUMAN_HANDOFF_TEXT);
  if (!reply) return;

  if (process.env.AUTO_REPLY_ENABLED !== "true") {
    console.log("AUTO_REPLY_DISABLED", { senderId, reply });
    return;
  }

  await sendInstagramMessage(senderId, reply);
  markReply(`dm:${senderId}`);
}

async function handleChangeEvent(change) {
  const field = change.field || "";
  const value = change.value || {};

  if (!field.includes("comment")) return;

  const commentId = value.comment_id || value.id;
  const commenterId = value.from?.id || value.from_id;
  const text = normalizeText(value.text || value.message);

  if (!commentId || !text || isCoolingDown(`comment:${commentId}`)) return;

  const decision = await askOpenAI({
    channel: "instagram_comment",
    userId: commenterId || "unknown",
    text
  });

  await deliverLead(decision, {
    channel: "instagram_comment",
    userId: commenterId || "unknown",
    commentId,
    sourceText: text,
    rawEvent: change
  });

  if (!decision.should_reply || process.env.COMMENT_REPLY_ENABLED !== "true") return;

  const reply = clampReply(decision.comment_reply_text || decision.reply_text);
  if (!reply) return;

  await replyToInstagramComment(commentId, reply);
  markReply(`comment:${commentId}`);
}

async function askOpenAI({ channel, userId, text }) {
  assertEnv("OPENAI_API_KEY");

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: OPENAI_MODEL,
      input: [
        {
          role: "system",
          content: buildSystemPrompt()
        },
        {
          role: "user",
          content: JSON.stringify({
            channel,
            user_id: userId,
            message: text
          })
        }
      ],
      text: {
        format: {
          type: "json_schema",
          name: "instagram_bot_decision",
          strict: true,
          schema: decisionSchema()
        }
      }
    })
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(`OpenAI request failed: ${data.error?.message || response.status}`);
  }

  return parseDecision(extractOutputText(data));
}

function buildSystemPrompt() {
  return [
    process.env.BUSINESS_PROFILE ||
      "你是品牌的 IG AI 助手，負責回答服務內容、預約流程，並收集客戶名單。",
    "你只能協助品牌客服、諮詢、預約、報價前初步了解需求。不要主動推銷無關內容。",
    "若訊息涉及醫療、法律、金融投資、仇恨、色情、暴力、自傷、未成年人敏感議題，請停止深入回答並轉真人。",
    "回覆要自然、簡短、使用繁體中文。每次最多問一個問題。",
    "第一次對話或適合時，簡短說明你是品牌 AI 助手。",
    "目標是收集名單欄位：姓名、電話或 Line、需求、預算、地區、方便聯絡時間。",
    "如果資訊不足，下一句優先詢問最重要的缺漏欄位。",
    "公開留言不要索取電話；公開留言只引導對方私訊。"
  ].join("\n");
}

function decisionSchema() {
  return {
    type: "object",
    additionalProperties: false,
    properties: {
      should_reply: { type: "boolean" },
      reply_text: { type: "string" },
      comment_reply_text: { type: "string" },
      needs_human: { type: "boolean" },
      intent_level: { type: "string", enum: ["hot", "warm", "cold", "not_relevant"] },
      lead_ready: { type: "boolean" },
      lead: {
        type: "object",
        additionalProperties: false,
        properties: {
          ig_user_id: { type: "string" },
          name: { type: "string" },
          contact: { type: "string" },
          need: { type: "string" },
          budget: { type: "string" },
          location: { type: "string" },
          preferred_time: { type: "string" },
          summary: { type: "string" },
          missing_fields: {
            type: "array",
            items: { type: "string" }
          }
        },
        required: [
          "ig_user_id",
          "name",
          "contact",
          "need",
          "budget",
          "location",
          "preferred_time",
          "summary",
          "missing_fields"
        ]
      }
    },
    required: [
      "should_reply",
      "reply_text",
      "comment_reply_text",
      "needs_human",
      "intent_level",
      "lead_ready",
      "lead"
    ]
  };
}

async function sendInstagramMessage(recipientId, text) {
  assertEnv("META_ACCESS_TOKEN");
  assertEnv("IG_ACCOUNT_ID");

  const endpoint = `${GRAPH_BASE_URL}/${GRAPH_VERSION}/${process.env.IG_ACCOUNT_ID}/messages`;
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${process.env.META_ACCESS_TOKEN}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      recipient: { id: recipientId },
      message: { text }
    })
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(`Meta send message failed: ${data.error?.message || response.status}`);
  }
  return data;
}

async function replyToInstagramComment(commentId, message) {
  assertEnv("META_ACCESS_TOKEN");

  const endpoint = `${GRAPH_BASE_URL}/${GRAPH_VERSION}/${commentId}/replies`;
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${process.env.META_ACCESS_TOKEN}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ message })
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(`Meta comment reply failed: ${data.error?.message || response.status}`);
  }
  return data;
}

async function deliverLead(decision, context) {
  if (!decision.lead_ready && decision.intent_level !== "hot") return;

  const lead = {
    ...decision.lead,
    ig_user_id: decision.lead?.ig_user_id || context.userId,
    source_channel: context.channel,
    needs_human: decision.needs_human,
    intent_level: decision.intent_level,
    created_at: new Date().toISOString()
  };

  if (!process.env.LEADS_WEBHOOK_URL) {
    console.log("LEAD_READY", lead);
    return;
  }

  const headers = { "Content-Type": "application/json" };
  if (process.env.LEADS_WEBHOOK_SECRET) {
    headers.Authorization = `Bearer ${process.env.LEADS_WEBHOOK_SECRET}`;
  }

  const response = await fetch(process.env.LEADS_WEBHOOK_URL, {
    method: "POST",
    headers,
    body: JSON.stringify({ lead, context })
  });

  if (!response.ok) {
    throw new Error(`Lead webhook failed: ${response.status}`);
  }
}

function verifyMetaSignature(rawBody, signatureHeader) {
  if (!process.env.META_APP_SECRET) return true;
  if (!signatureHeader?.startsWith("sha256=")) return false;

  const expected =
    "sha256=" +
    crypto
      .createHmac("sha256", process.env.META_APP_SECRET)
      .update(rawBody)
      .digest("hex");

  return timingSafeEqual(signatureHeader, expected);
}

function timingSafeEqual(a, b) {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  if (left.length !== right.length) return false;
  return crypto.timingSafeEqual(left, right);
}

function extractOutputText(data) {
  if (typeof data.output_text === "string") return data.output_text;

  const parts = [];
  for (const item of data.output || []) {
    for (const content of item.content || []) {
      if (content.type === "output_text" && typeof content.text === "string") {
        parts.push(content.text);
      }
    }
  }
  return parts.join("");
}

function parseDecision(text) {
  try {
    return JSON.parse(text);
  } catch (error) {
    throw new Error(`OpenAI returned invalid JSON: ${error.message}`);
  }
}

function clampReply(text) {
  const max = Number(process.env.MAX_REPLY_CHARS || 450);
  const cleaned = normalizeText(text);
  if (!cleaned) return "";
  return cleaned.length > max ? `${cleaned.slice(0, max - 1)}…` : cleaned;
}

function normalizeText(value) {
  return String(value || "")
    .replace(/\s+/g, " ")
    .trim();
}

function isCoolingDown(key) {
  const cooldownMs = Number(process.env.REPLY_COOLDOWN_MS || 20_000);
  const last = recentReplies.get(key) || 0;
  return Date.now() - last < cooldownMs;
}

function markReply(key) {
  recentReplies.set(key, Date.now());
}

function assertEnv(name) {
  if (!process.env[name]) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
}

function safeError(error) {
  return {
    name: error?.name,
    message: error?.message
  };
}

async function toWebRequest(req) {
  const protocol = req.headers["x-forwarded-proto"] || "https";
  const host = req.headers.host || "localhost";
  const headers = new Headers();

  for (const [key, value] of Object.entries(req.headers)) {
    if (Array.isArray(value)) {
      for (const item of value) headers.append(key, item);
    } else if (value !== undefined) {
      headers.set(key, value);
    }
  }

  const init = { method: req.method, headers };
  if (req.method !== "GET" && req.method !== "HEAD") {
    init.body = await readNodeRequestBody(req);
  }

  return new Request(`${protocol}://${host}${req.url}`, init);
}

function readNodeRequestBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", chunk => chunks.push(chunk));
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

async function sendWebResponse(res, response) {
  res.statusCode = response.status;
  for (const [key, value] of response.headers.entries()) {
    res.setHeader(key, value);
  }
  res.end(Buffer.from(await response.arrayBuffer()));
}
