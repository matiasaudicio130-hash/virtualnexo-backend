import { useRef } from "react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import { Images } from "@phosphor-icons/react";
import { useInfiniteUserPosts, type ProfileFeedTab } from "@/hooks/useInfiniteUserPosts";
import { useInView } from "@/hooks/useInView";
import { GridItem } from "./GridItem";
import { GridSkeleton } from "./GridSkeleton";
import type { Post } from "@/types";

interface Props {
  userId: string;
  tab: ProfileFeedTab;
  isOwn: boolean;
  pinnedPostId?: string | null;
  pinLoading?: boolean;
  onTogglePin?: (postId: string) => void;
  onSelectPost: (post: Post) => void;
}

const reduceMotion = () =>
  typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

const EMPTY_COPY: Record<ProfileFeedTab, string> = {
  posts:  "Sin publicaciones aún",
  reels:  "Sin reels aún",
  saved:  "Sin guardados aún",
  tagged: "Sin etiquetas aún",
};

const GRID_STYLE = { display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 2 } as const;

/** Grilla del perfil con scroll infinito — consume useInfiniteUserPosts(tab) y anima la entrada de cada página. */
export function ProfileGrid({ userId, tab, isOwn, pinnedPostId, pinLoading, onTogglePin, onSelectPost }: Props) {
  const scope = useRef<HTMLDivElement>(null);
  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading } = useInfiniteUserPosts(userId, tab);

  const sentinelRef = useInView(() => {
    if (hasNextPage && !isFetchingNextPage) fetchNextPage();
  }, { enabled: !!hasNextPage });

  const posts = (data?.pages.flatMap(p => p.posts) ?? []) as Post[];
  const sorted = pinnedPostId
    ? [...posts].sort((a, b) => (a.id === pinnedPostId ? -1 : b.id === pinnedPostId ? 1 : 0))
    : posts;

  useGSAP(() => {
    if (reduceMotion() || !scope.current) return;
    const items = scope.current.querySelectorAll<HTMLElement>(".grid-item-cell");
    if (items.length) gsap.from(items, { opacity: 0, y: 12, stagger: 0.02, duration: 0.4, ease: "power2.out" });
  }, { scope, dependencies: [tab, posts.length] });

  if (isLoading) {
    return <div style={GRID_STYLE}><GridSkeleton count={9} /></div>;
  }

  if (posts.length === 0) {
    return (
      <div style={{ padding: "40px 0", textAlign: "center" }}>
        <Images size={28} style={{ color: "var(--ash)", margin: "0 auto 8px" }}/>
        <p style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--mist)", letterSpacing: "0.14em", textTransform: "uppercase" }}>
          {EMPTY_COPY[tab]}
        </p>
      </div>
    );
  }

  return (
    <div ref={scope}>
      <div style={GRID_STYLE}>
        {sorted.map(post => (
          <GridItem
            key={post.id}
            className="grid-item-cell"
            post={post}
            isPinned={post.id === pinnedPostId}
            pinBadgeEnabled={tab === "posts"}
            pinButtonEnabled={tab === "posts" && isOwn}
            pinLoading={pinLoading}
            onTogglePin={() => onTogglePin?.(post.id)}
            onClick={() => onSelectPost(post)}
          />
        ))}
      </div>
      {hasNextPage && (
        <div ref={sentinelRef} style={GRID_STYLE}>
          {isFetchingNextPage && <GridSkeleton count={3} />}
        </div>
      )}
    </div>
  );
}
