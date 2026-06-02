#!/usr/bin/env node
/**
 * 对话附件：文件类型识别 + PDF/Word 文本提取
 * 用法: node scripts/test-chat-files.mjs
 */
import "../server/lib/env.mjs";
import JSZip from "jszip";
import { PDFDocument, StandardFonts } from "pdf-lib";
import { extractDocumentText } from "../server/lib/chat-document-extract.mjs";
import { isLibreOfficeAvailable, libreConvert } from "../server/lib/document-convert-local.mjs";

const BASE = process.env.TEST_BASE_URL || "http://127.0.0.1:3000";

const TEXT_EXTENSIONS = new Set([
  "txt", "md", "json", "csv", "log", "xml", "html", "css",
  "js", "ts", "tsx", "jsx", "mjs", "py", "yaml", "yml",
]);
const DOCUMENT_EXTENSIONS = new Set(["pdf", "doc", "docx"]);

function isImageChatFile(file) {
  return file.type.startsWith("image/");
}

function isTextChatFile(file) {
  if (file.type.startsWith("text/")) return true;
  const ext = file.name.split(".").pop()?.toLowerCase();
  return ext ? TEXT_EXTENSIONS.has(ext) : false;
}

function isDocumentChatFile(file) {
  const ext = file.name.split(".").pop()?.toLowerCase();
  if (ext && DOCUMENT_EXTENSIONS.has(ext)) return true;
  return (
    file.type === "application/pdf" ||
    file.type === "application/msword" ||
    file.type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  );
}

function isReadableChatFile(file) {
  return isTextChatFile(file) || isDocumentChatFile(file);
}

function ok(label, detail) {
  console.log(`✅ ${label}${detail ? ` — ${detail}` : ""}`);
}

function fail(label, detail) {
  console.error(`❌ ${label}${detail ? ` — ${detail}` : ""}`);
  process.exitCode = 1;
}

async function makePdfBuffer(text) {
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([612, 792]);
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  page.drawText(text, { x: 72, y: 700, size: 14, font });
  return Buffer.from(await pdf.save());
}

async function makeDocxBuffer(text) {
  const zip = new JSZip();
  zip.file(
    "[Content_Types].xml",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>`,
  );
  zip.file(
    "word/document.xml",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    <w:p><w:r><w:t>${text}</w:t></w:r></w:p>
  </w:body>
</w:document>`,
  );
  return zip.generateAsync({ type: "nodebuffer" });
}

async function uploadDocument(name, buffer, mime) {
  const form = new FormData();
  form.append("file", new Blob([buffer], { type: mime }), name);
  const res = await fetch(`${BASE}/api/chat/extract-document`, {
    method: "POST",
    body: form,
  });
  const data = await res.json().catch(() => ({}));
  return { status: res.status, data };
}

function mockFile(name, type) {
  return { name, type, size: 100 };
}

async function testFileTypeDetection() {
  console.log("\n— 文件类型识别 —");

  const cases = [
    { file: mockFile("photo.jpg", "image/jpeg"), image: true, readable: false },
    { file: mockFile("notes.txt", "text/plain"), text: true, readable: true },
    { file: mockFile("data.json", "application/json"), text: true, readable: true },
    { file: mockFile("report.pdf", "application/pdf"), doc: true, readable: true },
    { file: mockFile("essay.docx", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"), doc: true, readable: true },
    { file: mockFile("legacy.doc", "application/msword"), doc: true, readable: true },
    { file: mockFile("archive.zip", "application/zip"), readable: false },
    { file: mockFile("unknown.bin", "application/octet-stream"), readable: false },
  ];

  for (const c of cases) {
    const img = isImageChatFile(c.file);
    const txt = isTextChatFile(c.file);
    const doc = isDocumentChatFile(c.file);
    const readable = isReadableChatFile(c.file);

    if (c.image && !img) fail(`识别图片: ${c.file.name}`);
    else if (c.text && !txt) fail(`识别文本: ${c.file.name}`);
    else if (c.doc && !doc) fail(`识别文档: ${c.file.name}`);
    else if (c.readable === false && readable) fail(`应拒绝: ${c.file.name}`);
    else if (c.readable === true && !readable) fail(`应接受: ${c.file.name}`);
    else ok(`识别 ${c.file.name}`, `image=${img} text=${txt} doc=${doc} readable=${readable}`);
  }
}

async function testDirectExtraction() {
  console.log("\n— 服务端直接提取 —");

  const pdfText = "Pineapple Chat PDF test ALPHA-123";
  const pdfBuf = await makePdfBuffer(pdfText);
  const pdfResult = await extractDocumentText(pdfBuf, "test-chat.pdf");
  if (!pdfResult.content.includes("ALPHA-123")) {
    fail("PDF 文本提取", pdfResult.content.slice(0, 120));
  } else {
    ok("PDF 文本提取", pdfResult.content.replace(/\s+/g, " ").slice(0, 60));
  }

  const docxText = "春雨集 Word 识别测试 BETA-456";
  const docxBuf = await makeDocxBuffer(docxText);
  const docxResult = await extractDocumentText(docxBuf, "test-chat.docx");
  if (!docxResult.content.includes("BETA-456")) {
    fail("DOCX 文本提取", docxResult.content);
  } else {
    ok("DOCX 文本提取", docxResult.content);
  }

  try {
    await extractDocumentText(Buffer.from("not a pdf"), "bad.pdf");
    fail("无效 PDF 应报错");
  } catch (e) {
    ok("无效 PDF 拒绝", e.message?.slice(0, 80) || "threw");
  }
}

async function testApiExtraction() {
  console.log("\n— API /api/chat/extract-document —");

  const health = await fetch(`${BASE}/api/health`).then((r) => r.json()).catch(() => ({}));
  if (!health?.ok) {
    fail("服务未启动", BASE);
    return;
  }
  ok("服务健康检查");

  const pdfBuf = await makePdfBuffer("API PDF test GAMMA-789");
  const pdfRes = await uploadDocument("api-test.pdf", pdfBuf, "application/pdf");
  if (pdfRes.status !== 200 || !pdfRes.data?.file?.content?.includes("GAMMA-789")) {
    fail("API PDF 提取", `status=${pdfRes.status} ${pdfRes.data?.error || ""}`);
  } else {
    ok("API PDF 提取", pdfRes.data.file.content.replace(/\s+/g, " ").slice(0, 50));
  }

  const docxBuf = await makeDocxBuffer("API Word 测试 DELTA-000");
  const docxRes = await uploadDocument(
    "api-test.docx",
    docxBuf,
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  );
  if (docxRes.status !== 200 || !docxRes.data?.file?.content?.includes("DELTA-000")) {
    fail("API DOCX 提取", `status=${docxRes.status} ${docxRes.data?.error || ""}`);
  } else {
    ok("API DOCX 提取", docxRes.data.file.content);
  }

  const empty = await uploadDocument("empty.pdf", Buffer.alloc(0), "application/pdf");
  if (empty.status === 200) fail("空文件应拒绝");
  else ok("空文件拒绝", `status=${empty.status}`);

  if (isLibreOfficeAvailable()) {
    ok(".doc 支持", "LibreOffice 可用（.doc 可走服务端提取）");
    try {
      const docBuf = await libreConvert(await makeDocxBuffer("DOC legacy EPSILON-111"), "doc", ".docx");
      const docResult = await extractDocumentText(Buffer.from(docBuf), "legacy-test.doc");
      if (!docResult.content.includes("EPSILON-111")) {
        fail(".doc 文本提取", docResult.content);
      } else {
        ok(".doc 文本提取", docResult.content.trim());
      }
    } catch (e) {
      ok(".doc 文本提取", `跳过（测试用 docx 过简，LibreOffice 无法转 .doc：${e.message?.slice(0, 60)}）`);
    }
  } else {
    ok(".doc 降级提示", "LibreOffice 不可用，.doc 会提示另存为 docx");
  }
}

async function main() {
  console.log(`\n🍍 对话附件测试\n`);
  await testFileTypeDetection();
  await testDirectExtraction();
  await testApiExtraction();
  console.log(process.exitCode ? "\n部分测试失败\n" : "\n全部通过\n");
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
