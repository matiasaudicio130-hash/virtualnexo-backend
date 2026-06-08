import { useInfiniteQuery } from "@tanstack/react-query";
import { feedApi } from "@/lib/api";
import type { Post } from "@/types";

export type ProfileFeedTab = "posts" | "reels" | "saved" | "tagged";

const PAGE_SIZE = 18;

interface PageResult {
  posts: Post[];
}

async function fetchPage(tab: ProfileFeedTab, userId: string, offset: number): Promise<PageResult> {
  const params = { limit: PAGE_SIZE, offset };
  switch (tab) {
    case "reels":
      return (await feedApi.getUserPosts(userId, { ...params, kind: "video" })).data;
    case "saved":
      return (await feedApi.getSaved(params)).data;
    case "tagged":
      return (await feedApi.getTagged(userId, params)).data;
    case "posts":
    default:
      return (await feedApi.getUserPosts(userId, params)).data;
  }
}

/** Paginación infinita por tab del perfil — cada tab mantiene su propia caché y offset. */
export function useInfiniteUserPosts(userId: string | undefined, tab: ProfileFeedTab) {
  return useInfiniteQuery({
    queryKey: ["userPosts", userId, tab],
    queryFn: ({ pageParam }) => fetchPage(tab, userId!, pageParam),
    initialPageParam: 0,
    getNextPageParam: (lastPage, allPages) =>
      lastPage.posts.length === PAGE_SIZE ? allPages.length * PAGE_SIZE : undefined,
    enabled: !!userId,
    staleTime: 1000 * 30,
  });
}
