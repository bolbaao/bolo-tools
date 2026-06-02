# 静态资源

## `kgm.mask`

酷狗 `.kgm` / `.vpr` 解密所需数据文件。首次使用酷狗解锁前请运行：

```bash
chmod +x scripts/download-kgm-mask.sh
./scripts/download-kgm-mask.sh
```

网易云 `.ncm`、酷我 `.kwm`、虾米 `.xm` 无需此文件。

## `pdf.worker.min.mjs`

PDF 文本提取（首页对话上传 PDF）所需。`./start.sh` 会从 `node_modules/pdfjs-dist` 自动同步；若缺失可手动执行：

```bash
cp node_modules/pdfjs-dist/legacy/build/pdf.worker.min.mjs public/static/pdf.worker.min.mjs
```
