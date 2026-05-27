import { PDFDocument } from "pdf-lib";
import { pdf } from "pdf-to-img";
import JSZip from "jszip";
import { HttpError } from "./http-error.mjs";
import { convertViaConvertApi, isOnlineDocConvertAvailable } from "./doc-convert-online.mjs";

export const DOC_MODES = {
  "pdf-to-word": { input: [".pdf"], outputExt: "docx", needsCloud: true },
  "word-to-pdf": { input: [".doc", ".docx"], outputExt: "pdf", needsCloud: true },
  "pdf-to-images": { input: [".pdf"], outputExt: "zip", needsCloud: false },
  "images-to-pdf": { input: [".png", ".jpg", ".jpeg"], outputExt: "pdf", needsCloud: false },
};

export function getDocumentCapabilities() {
  const online = isOnlineDocConvertAvailable();
  return {
    onlineConvert: online,
    modes: Object.fromEntries(
      Object.entries(DOC_MODES).map(([mode, cfg]) => [
        mode,
        {
          available: !cfg.needsCloud || online,
          needsCloud: cfg.needsCloud,
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

function assertMode(mode) {
  const cfg = DOC_MODES[mode];
  if (!cfg) throw new HttpError(400, "不支持的转换类型");
  if (cfg.needsCloud && !isOnlineDocConvertAvailable()) {
    throw new HttpError(
      503,
      "未配置云端转换。请在 .env 设置 CONVERTAPI_SECRET（免费注册 https://www.convertapi.com）",
    );
  }
  return cfg;
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
  const cfg = assertMode(mode);

  if (!files?.length) throw new HttpError(400, "请上传文件");

  if (mode === "images-to-pdf") {
    for (const f of files) {
      const ext = extOf(f.originalname);
      if (!cfg.input.includes(ext)) {
        throw new HttpError(400, "请上传 PNG 或 JPG 图片");
      }
    }
    const out = await imagesToPdf(files);
    const name = files.length === 1 ? `${baseName(files[0].originalname)}.pdf` : "images.pdf";
    return { buffer: out, filename: name, contentType: "application/pdf" };
  }

  const file = files[0];
  const ext = extOf(file.originalname);
  if (!cfg.input.includes(ext)) {
    throw new HttpError(400, `请上传 ${cfg.input.join("、")} 格式的文件`);
  }

  const stem = baseName(file.originalname);

  if (mode === "pdf-to-word") {
    const out = await convertViaConvertApi(file.buffer, ".pdf", ".docx", file.originalname);
    return {
      buffer: out,
      filename: `${stem}.docx`,
      contentType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    };
  }

  if (mode === "word-to-pdf") {
    const out = await convertViaConvertApi(file.buffer, ext, ".pdf", file.originalname);
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
