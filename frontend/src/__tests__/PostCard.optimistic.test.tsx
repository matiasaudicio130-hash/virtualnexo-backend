import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { PostCard } from "@/components/PostCard";

// ── Mocks de dependencias externas ─────────────────────────────────────────

vi.mock("@/lib/api", () => ({
  feedApi: {
    react:      vi.fn(),
    savePost:   vi.fn(),
    deletePost: vi.fn(),
  },
}));

vi.mock("@/components/ProtectedImage", () => ({
  ProtectedAvatar: ({ size }: { size: number }) =>
    <div data-testid="avatar" style={{ width: size, height: size }} />,
}));

vi.mock("@/components/Comments", () => ({
  CommentsSection: () => <div data-testid="comments" />,
}));

vi.mock("@/components/DoubleTapLike", () => ({
  DoubleTapLike: ({ children }: any) => <div>{children}</div>,
}));

vi.mock("@/components/Carousel",     () => ({ Carousel: () => null }));
vi.mock("@/components/ShareModal",   () => ({ ShareModal: () => null }));
vi.mock("@/components/ReportModal",  () => ({ ReportModal: () => null }));
vi.mock("@/components/PostStatsModal", () => ({ PostStatsModal: () => null }));
vi.mock("@/components/PollCard",     () => ({ PollCard: () => null }));

const mockPost = {
  id:         "post-1",
  user_id:    "author-1",
  type:       "text",
  content:    "Hola mundo",
  created_at: new Date().toISOString(),
  reactions:  { heart: 3, fire: 1 },
  viewer_reaction: undefined,
  author: {
    id:      "author-1",
    name:    "Ana García",
    avatar:  "",
  },
  extra_data: {},
};

function renderPost(overrides = {}) {
  const { feedApi } = require("@/lib/api");
  feedApi.react.mockResolvedValue({ data: { action: "added", type: "heart" } });

  render(
    <MemoryRouter>
      <PostCard post={{ ...mockPost, ...overrides }} currentUserId="viewer-1" />
    </MemoryRouter>
  );
}

describe("PostCard — optimistic like (BUG: delay en me gusta)", () => {

  beforeEach(() => vi.clearAllMocks());

  it("actualiza el contador de ❤️ inmediatamente al hacer click, sin esperar la API", async () => {
    const { feedApi } = await import("@/lib/api");
    // API lenta (500ms) — el contador debe aparecer ANTES de que resuelva
    (feedApi.react as any).mockImplementation(
      () => new Promise(res => setTimeout(() => res({ data: { action: "added", type: "heart" } }), 500))
    );

    render(
      <MemoryRouter>
        <PostCard post={mockPost} currentUserId="viewer-1" />
      </MemoryRouter>
    );

    // Antes del click: 3 hearts
    expect(screen.getByText("3")).toBeInTheDocument();

    // Click en "Me gusta"
    fireEvent.click(screen.getByLabelText("Me gusta"));

    // Inmediatamente (sin await) debe mostrar 4 — optimistic update
    expect(screen.getByText("4")).toBeInTheDocument();
  });

  it("hace rollback del contador si la API falla", async () => {
    const { feedApi } = await import("@/lib/api");
    (feedApi.react as any).mockRejectedValue(new Error("network error"));

    render(
      <MemoryRouter>
        <PostCard post={mockPost} currentUserId="viewer-1" />
      </MemoryRouter>
    );

    expect(screen.getByText("3")).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText("Me gusta"));

    // Optimistic: sube a 4
    expect(screen.getByText("4")).toBeInTheDocument();

    // Esperar que la promesa rechazada se resuelva
    await vi.waitFor(() => {
      expect(screen.getByText("3")).toBeInTheDocument();
    });
  });

  it("no permite doble-click mientras procesa", async () => {
    const { feedApi } = await import("@/lib/api");
    (feedApi.react as any).mockResolvedValue({ data: { action: "added", type: "heart" } });

    render(
      <MemoryRouter>
        <PostCard post={mockPost} currentUserId="viewer-1" />
      </MemoryRouter>
    );

    const btn = screen.getByLabelText("Me gusta");
    fireEvent.click(btn);
    fireEvent.click(btn); // segundo click mientras loading=true

    // La API debe haberse llamado sólo una vez
    expect(feedApi.react).toHaveBeenCalledTimes(1);
  });
});
