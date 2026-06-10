"use client";

import { useAuth } from "@/contexts/AuthContext";
import {
  getQuickChatPrompts,
  getSiteTagline,
  getSiteValueProps,
  getToolDescription,
  getToolDialogPlaceholder,
  getToolHeroSubtitle,
  getToolHighlights,
  type SiteValueProp,
} from "@/lib/site-content";

export function useIsAdminViewer(): boolean {
  const { user, loading } = useAuth();
  return !loading && Boolean(user?.isAdmin);
}

export function useDisplayContent() {
  const isAdmin = useIsAdminViewer();

  return {
    isAdmin,
    siteTagline: getSiteTagline(isAdmin),
    siteValueProps: getSiteValueProps(isAdmin),
    quickChatPrompts: getQuickChatPrompts(isAdmin),
    getToolDescription: (toolId: string) => getToolDescription(toolId, isAdmin),
    getToolHeroSubtitle: (toolId: string) => getToolHeroSubtitle(toolId, isAdmin),
    getToolHighlights: (toolId: string) => getToolHighlights(toolId, isAdmin),
    getToolDialogPlaceholder: (toolId: string, title: string) =>
      getToolDialogPlaceholder(toolId, title, isAdmin),
  };
}

export type { SiteValueProp };
