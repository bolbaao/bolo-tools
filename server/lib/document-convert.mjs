import { PDFDocument } from "pdf-lib";
import { pdf } from "pdf-to-img";
import JSZip from "jszip";
import { HttpError } from "./http-error.mjs";
import { convertViaConvertApi, isOnlineDocConvertAvailable } from "./doc-convert-online.mjs";
import { isLibreOfficeAvailable, libreConvert } from "./document-convert-local.mjs";

export const DOC_MODES = {
  "pdf-to-word": { input: [".pdf"], outputExt: "docx", needsOffice: true },
  "word-to-pdf": { input: [".doc", ".docx"], outputExt: "pdf", needsOffice: true },
  "pdf-to-images": { input: [".pdf"], outputExt: "zip", needsOffice: false },
  "images-to-pdf": { input: [".png", ".jpg", ".jpeg"], outputExt: "pdf", needsOffice: false },
};

export function getDocumentCapabilities() {
  const online = isOnlineDocConvertAvailable();
  const libre = isLibreOfficeAvailable();
  return {
    onlineConvert: online,
    libreOffice: libre,
    modes: Object.fromEntries(
      Object.entries(DOC_MODES).map(([mode, cfg]) => [
        mode,
        {
          available: !cfg.needsOffice || online || libre,
          needsOffice: cfg.needsOffice,
        },
      ]),
    ),
  };
}

function extOf(name) {
  const i = name.lastIndexOf(".");
  return i >= 0 ? name.slice(i).toLowerCase() : "";
}

function baseName(name) {
  const i = name.lastIndexOf(".");
  return i >= 0 ? name.slice(0, i) : name;
}

function isCloudUnreachable(err) {
  const msg = err instanceof Error ? err.message : String(err);
  return (
    err instanceof HttpError &&
    (err.status === 502 ||
      err.status === 504 ||
      /fetch failed|ENOTFOUND|ECONNREFUSED|ETIMEDOUT|network|无法连接云端/i.test(msg))
  );
}

function assertMode(mode) {
  const cfg = DOC_MODES[mode];
  if (!cfg) throw new HttpError(400, "不支持的转换类型");
  if (cfg.needsOffice && !isOnlineDocConvertAvailable() && !isLibreOfficeAvailable()) {
    throw new HttpError(
      503,
      "PDF ↔ Word 需要云端 API（CONVERTAPI_SECRET）或本地 LibreOffice（./scripts/download-libreoffice.sh）",
    );
  }
  return cfg;
}

/** 云端优先，国内网络不可达时自动改用本地 LibreOffice */
async function convertOfficeFile(buffer, fromExt, toExt, originalName) {
  const from = fromExt.startsWith(".") ? fromExt : `.${fromExt}`;
  const to = toExt.startsWith(".") ? toExt : `.${toExt}`;

  if (isOnlineDocConvertAvailable()) {
    try {
      return await convertViaConvertApi(buffer, from, to, originalName);
    } catch (e) {
      if (!isCloudUnreachable(e) || !isLibreOfficeAvailable()) throw e;
    }
  }

  if (!isLibreOfficeAvailable()) {
    throw new HttpError(
      502,
      "无法连接云端转换（国内常需代理）。请在 .env 配置 HTTPS_PROXY，或运行 ./scripts/download-libreoffice.sh 使用本地转换",
    );
  }

  if (from === ".pdf" && to === ".docx") {
    return libreConvert(buffer, "docx", ".pdf", {
      sofficeAdditionalArgs: ["--infilter=writer_pdf_import"],
    });
  }
  if (to === ".pdf") {
    return libreConvert(buffer, "pdf", from);
  }
  throw new HttpError(400, "不支持的转换组合");
}

async function pdfToImages(buffer, { scale = 2, format = "png" } = {}) {
  const doc = await pdf(buffer, { scale });
  const zip = new JSZip();
  let page = 1;
  for await (const image of doc) {
    const name = `page-${String(page).padStart(3, "0")}.${format === "jpeg" ? "jpg" : "png"}`;
    zip.file(name, image);
    page += 1;
  }
  if (page === 1) throw new HttpError(422, "PDF 没有可导出的页面");
  return zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });
}

async function imagesToPdf(files) {
  const pdfDoc = await PDFDocument.create();
  for (const file of files) {
    const ext = extOf(file.originalname);
    let image;
    if (ext === ".png") {
      image = await pdfDoc.embedPng(file.buffer);
    } else if (ext === ".jpg" || ext === ".jpeg") {
      image = await pdfDoc.embedJpg(file.buffer);
    } else {
      throw new HttpError(400, `不支持的图片格式：${ext || "未知"}`);
    }
    const { width, height } = image.scale(1);
    const page = pdfDoc.addPage([width, height]);
    page.drawImage(image, { x: 0, y: 0, width, height });
  }
  return Buffer.from(await pdfDoc.save());
}

/**
 * @param {string} mode
 * @param {import('multer').File[]} files
 * @param {{ scale?: number, imageFormat?: string }} opts
 */
export async function convertDocuments(mode, files, opts = {}) {
  assertMode(mode);

  if (!files?.length) throw new HttpError(400, "请上传文件");

  if (mode === "images-to-pdf") {
    for (const f of files) {
      const ext = extOf(f.originalname);
      if (!DOC_MODES["images-to-pdf"].input.includes(ext)) {
        throw new HttpError(400, "请上传 PNG 或 JPG 图片");
      }
    }
    const out = await imagesToPdf(files);
    const name = files.length === 1 ? `${baseName(files[0].originalname)}.pdf` : "images.pdf";
    return { buffer: out, filename: name, contentType: "application/pdf" };
  }

  const file = files[0];
  const ext = extOf(file.originalname);
  const cfg = DOC_MODES[mode];
  if (!cfg.input.includes(ext)) {
    throw new HttpError(400, `请上传 ${cfg.input.join("、")} 格式的文件`);
  }

  const stem = baseName(file.originalname);

  if (mode === "pdf-to-word") {
    const out = await convertOfficeFile(file.buffer, ".pdf", ".docx", file.originalname);
    return {
      buffer: out,
      filename: `${stem}.docx`,
      contentType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    };
  }

  if (mode === "word-to-pdf") {
    const out = await convertOfficeFile(file.buffer, ext, ".pdf", file.originalname);
    return {
      buffer: out,
      filename: `${stem}.pdf`,
      contentType: "application/pdf",
    };
  }

  if (mode === "pdf-to-images") {
    const scale = Math.min(4, Math.max(1, Number(opts.scale) || 2));
    const format = opts.imageFormat === "jpeg" ? "jpeg" : "png";
    const out = await pdfToImages(file.buffer, { scale, format });
    return {
      buffer: out,
      filename: `${stem}-pages.zip`,
      contentType: "application/zip",
    };
  }

  throw new HttpError(400, "不支持的转换类型");
}
