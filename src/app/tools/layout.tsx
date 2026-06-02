"use client";

import { usePathname } from "next/navigation";

export default function ToolsLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div key={pathname} className="flex h-full min-h-0 flex-col overflow-hidden">
      {children}
    </div>
  );
}
