const SHEET_NAME = "IG Leads";
const SHARED_SECRET = "change-this-secret";

function doPost(e) {
  if (SHARED_SECRET && e.parameter.secret !== SHARED_SECRET) {
    return jsonResponse({ ok: false, error: "unauthorized" });
  }

  const payload = JSON.parse(e.postData.contents || "{}");
  const lead = payload.lead || {};

  const lock = LockService.getScriptLock();
  lock.waitLock(10000);

  try {
    const sheet = getOrCreateSheet();
    ensureHeader(sheet);

    sheet.appendRow([
      lead.created_at || new Date().toISOString(),
      lead.source_channel || "",
      lead.ig_user_id || "",
      lead.name || "",
      lead.contact || "",
      lead.need || "",
      lead.budget || "",
      lead.location || "",
      lead.preferred_time || "",
      lead.intent_level || "",
      lead.needs_human ? "YES" : "NO",
      lead.summary || "",
      Array.isArray(lead.missing_fields) ? lead.missing_fields.join(", ") : ""
    ]);

    return jsonResponse({ ok: true });
  } finally {
    lock.releaseLock();
  }
}

function getOrCreateSheet() {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  return spreadsheet.getSheetByName(SHEET_NAME) || spreadsheet.insertSheet(SHEET_NAME);
}

function ensureHeader(sheet) {
  if (sheet.getLastRow() > 0) return;

  sheet.appendRow([
    "建立時間",
    "來源",
    "IG User ID",
    "姓名",
    "聯絡方式",
    "需求",
    "預算",
    "地區",
    "方便聯絡時間",
    "意向",
    "需真人",
    "摘要",
    "缺漏欄位"
  ]);
}

function jsonResponse(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}
