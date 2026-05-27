import ToolPageLayout from "@/components/ToolPageLayout";
import DocumentConvertForm from "@/components/tools/DocumentConvertForm";
import { getToolById } from "@/lib/tools";

export default function DocConvertPage() {
  const tool = getToolById("doc-convert")!;
  return (
    <ToolPageLayout tool={tool}>
      <DocumentConvertForm />
    </ToolPageLayout>
  );
}
