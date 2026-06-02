export type DocConvertMode =
  | "pdf-to-word"
  | "word-to-pdf"
  | "pdf-to-images"
  | "images-to-pdf";

export type DocConvertModeMeta = {
  id: DocConvertMode;
  label: string;
  hint: string;
  accept: string;
  multiple: boolean;
  needsOffice: boolean;
};

export const DOC_CONVERT_MODES: DocConvertModeMeta[] = [
  {
    id: "pdf-to-word",
    label: "PDF 转 Word",
    hint: "上传 PDF，自动转换为可编辑的 Word 文档",
    accept: ".pdf,application/pdf",
    multiple: false,
    needsOffice: true,
  },
  {
    id: "word-to-pdf",
    label: "Word 转 PDF",
    hint: "上传 .doc / .docx，自动转换",
    accept: ".doc,.docx,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    multiple: false,
    needsOffice: true,
  },
  {
    id: "pdf-to-images",
    label: "PDF 转图片",
    hint: "每一页导出为 PNG，打包为 ZIP 下载",
    accept: ".pdf,application/pdf",
    multiple: false,
    needsOffice: false,
  },
  {
    id: "images-to-pdf",
    label: "图片转 PDF",
    hint: "支持多张 PNG / JPG，按顺序合并为一个 PDF",
    accept: ".png,.jpg,.jpeg,image/png,image/jpeg",
    multiple: true,
    needsOffice: false,
  },
];

export type DocCapabilities = {
  onlineConvert: boolean;
  libreOffice: boolean;
  modes: Record<string, { available: boolean; needsOffice: boolean }>;
};
