import { Suspense } from "react";
import VerifyEmailPageClient from "./VerifyEmailPageClient";

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={<div className="py-16 text-center text-sm text-white/40">加载中…</div>}>
      <VerifyEmailPageClient />
    </Suspense>
  );
}
