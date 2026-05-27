"use client";

import ToolPageLayout from "@/components/ToolPageLayout";
import ImageStudioRedirect from "@/components/tools/ImageStudioRedirect";
import { getToolById } from "@/lib/tools";
import { Suspense } from "react";

export default function ImageCompressRedirectPage() {
  const tool = getToolById("image-studio")!;
  return (
    <ToolPageLayout tool={tool}>
      <Suspense fallback={<p className="text-center text-sm text-white/40 py-12">跳转中…</p>}>
        <ImageStudioRedirect tab="compress" />
      </Suspense>
    </ToolPageLayout>
  );
}
