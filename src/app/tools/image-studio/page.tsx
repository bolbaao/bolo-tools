"use client";

import ToolPageLayout from "@/components/ToolPageLayout";
import ImageStudioForm from "@/components/tools/ImageStudioForm";
import { getToolById } from "@/lib/tools";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";

function tabFromParam(value: string | null) {
  if (value === "compress" || value === "sharpen" || value === "cutout" || value === "generate") {
    return value;
  }
  return undefined;
}

function ImageStudioPageInner() {
  const tool = getToolById("image-studio")!;
  const searchParams = useSearchParams();
  const initialTab = tabFromParam(searchParams.get("tab"));

  return (
    <ToolPageLayout tool={tool}>
      <ImageStudioForm initialTab={initialTab} />
    </ToolPageLayout>
  );
}

export default function ImageStudioPage() {
  return (
    <Suspense
      fallback={
        <div className="text-center text-sm text-white/40 py-12">加载图像工坊…</div>
      }
    >
      <ImageStudioPageInner />
    </Suspense>
  );
}
