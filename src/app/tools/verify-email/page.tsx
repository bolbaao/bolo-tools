import { Suspense } from "react";
import WorkspaceFrame from "@/components/workspace/WorkspaceFrame";
import VerifyEmailPageClient from "./VerifyEmailPageClient";

export default function VerifyEmailPage() {
  return (
    <Suspense
      fallback={
        <div className="tool-workspace flex h-full min-h-0 flex-col overflow-hidden">
          <div className="workspace-light flex flex-1 items-center justify-center py-16 text-sm text-black/40">
            加载中…
          </div>
        </div>
      }
    >
      <div className="tool-workspace flex h-full min-h-0 flex-col overflow-hidden">
        <WorkspaceFrame variant="tool" dialogPlaceholder="验证完成后可在此提问…">
          <VerifyEmailPageClient />
        </WorkspaceFrame>
      </div>
    </Suspense>
  );
}
