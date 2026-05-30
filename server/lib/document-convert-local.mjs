import libre from "libreoffice-convert";
import { HttpError } from "./http-error.mjs";
import { getLibreOfficePath, isLibreOfficeAvailable } from "./libreoffice-bin.mjs";

export { isLibreOfficeAvailable };

export function libreConvert(buffer, targetExt, sourceExt, { sofficeAdditionalArgs = [] } = {}) {
  const soffice = getLibreOfficePath();
  if (!soffice) {
    throw new HttpError(
      503,
      "本地 LibreOffice 不可用。请运行 ./scripts/download-libreoffice.sh",
    );
  }

  const format = targetExt.replace(/^\./, "");
  const ext = sourceExt.startsWith(".") ? sourceExt : `.${sourceExt}`;
  const options = {
    sofficeBinaryPaths: [soffice],
    fileName: `source${ext}`,
    sofficeAdditionalArgs,
    execOptions: {
      env: {
        ...process.env,
        LANG: "zh_CN.UTF-8",
        LC_ALL: "zh_CN.UTF-8",
      },
    },
  };

  return new Promise((resolve, reject) => {
    libre.convertWithOptions(buffer, format, undefined, options, (err, result) => {
      if (err) reject(err);
      else resolve(result);
    });
  }).catch((e) => {
    const msg = e instanceof Error ? e.message : String(e);
    if (/Could not find soffice|ENOENT/i.test(msg)) {
      throw new HttpError(503, "本地 LibreOffice 不可用。请运行 ./scripts/download-libreoffice.sh");
    }
    throw new HttpError(422, `本地转换失败：${msg.slice(0, 240)}`);
  });
}
