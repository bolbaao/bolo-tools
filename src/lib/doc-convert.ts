export type DocConvertMode =
  | "pdf-to-word"
  | "word-to-pdf"
  | "pdf-to-images"
  | "images-to-pdf"
  | "pdf-merge"
  | "pdf-split"
  | "pdf-compress";

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
    hint: "上传 Word 文件，自动转成 PDF",
    accept: ".doc,.docx,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    multiple: false,
    needsOffice: true,
  },
  {
    id: "pdf-to-images",
    label: "PDF 转图片",
    hint: "每一页变成图片，打包下载",
    accept: ".pdf,application/pdf",
    multiple: false,
    needsOffice: false,
  },
  {
    id: "images-to-pdf",
    label: "图片转 PDF",
    hint: "多张图片按顺序合成一份 PDF",
    accept: ".png,.jpg,.jpeg,image/png,image/jpeg",
    multiple: true,
    needsOffice: false,
  },
  {
    id: "pdf-merge",
    label: "PDF 合并",
    hint: "按顺序合并多份 PDF 为一份",
    accept: ".pdf,application/pdf",
    multiple: true,
    needsOffice: false,
  },
  {
    id: "pdf-split",
    label: "PDF 拆分",
    hint: "按页拆成多份 PDF，打包下载",
    accept: ".pdf,application/pdf",
    multiple: false,
    needsOffice: false,
  },
  {
    id: "pdf-compress",
    label: "PDF 压缩",
    hint: "减小 PDF 体积（本机有 Ghostscript 时效果更佳）",
    accept: ".pdf,application/pdf",
    multiple: false,
    needsOffice: false,
  },
];

export type DocCapabilities = {
  onlineConvert: boolean;
  libreOffice: boolean;
  modes: Record<string, { available: boolean; needsOffice: boolean }>;
};
