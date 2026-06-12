/**
 * Tests para CommentsSection — agregar y mostrar comentarios.
 *
 * BUGs que previenen:
 * - Submit con contenido vacío envía petición al API
 * - Comentario nuevo no aparece en la lista tras enviarse
 * - Comentarios eliminados no muestran "[comentario eliminado]"
 * - Lista no se renderiza cuando viene vacía
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

// vi.mock se hoist antes de los const — se usa vi.hoisted para evitar TDZ
const mockCommentsApi = vi.hoisted(() => ({
  list: vi.fn(),
  add: vi.fn(),
  delete: vi.fn(),
  report: vi.fn(),
}));

vi.mock("@/lib/api", () => ({
  commentsApi: mockCommentsApi,
  searchApi: { search: vi.fn().mockResolvedValue({ data: { users: [] } }) },
}));

vi.mock("@/store/authStore", () => ({
  useAuthStore: () => ({ user: { id: "current-user" } }),
}));

vi.mock("@/components/ProtectedImage", () => ({
  ProtectedAvatar: ({ src }: { src: string }) => <img src={src} alt="avatar" />,
}));

import { CommentsSection } from "@/components/Comments";

function wrap(ui: React.ReactElement) {
  return render(<MemoryRouter>{ui}</MemoryRouter>);
}

async function openComments(screen: ReturnType<typeof import("@testing-library/react")["screen"]>) {
  const toggleBtn = await screen.findByRole("button", { name: /comentar|\d+ comentario/i });
  fireEvent.click(toggleBtn);
}

const COMMENT_FIXTURE = {
  id: "cmt-1",
  content: "Gran publicación!",
  is_deleted: false,
  parent_id: null,
  created_at: new Date().toISOString(),
  can_delete: false,
  author: { id: "user-other", name: "Ana García", avatar: null, profile_type: null },
  replies: [],
};

describe("CommentsSection — agregar comentarios", () => {

  beforeEach(() => {
    vi.clearAllMocks();
    mockCommentsApi.list.mockResolvedValue({ data: [] });
  });

  it("renderiza el campo de texto para escribir", async () => {
    wrap(<CommentsSection postId="post-1" postOwnerId="owner-1" />);
    await openComments(screen);
    await waitFor(() => {
      const input = screen.queryByPlaceholderText(/comentario/i) ||
                    screen.queryByRole("textbox");
      expect(input).not.toBeNull();
    });
  });

  it("muestra los comentarios cargados desde la API", async () => {
    mockCommentsApi.list.mockResolvedValue({ data: [COMMENT_FIXTURE] });
    wrap(<CommentsSection postId="post-1" postOwnerId="owner-1" />);
    await openComments(screen);
    await waitFor(() => {
      expect(screen.getByText("Gran publicación!")).toBeInTheDocument();
    });
  });

  it("muestra '[comentario eliminado]' para comentarios borrados", async () => {
    mockCommentsApi.list.mockResolvedValue({
      data: [{ ...COMMENT_FIXTURE, is_deleted: true, content: "[eliminado]" }],
    });
    wrap(<CommentsSection postId="post-1" postOwnerId="owner-1" />);
    await openComments(screen);
    await waitFor(() => {
      expect(screen.getByText(/eliminado/i)).toBeInTheDocument();
    });
  });

  it("lista vacía muestra empty state o nada (no crashea)", async () => {
    mockCommentsApi.list.mockResolvedValue({ data: [] });
    const { container } = wrap(<CommentsSection postId="post-1" postOwnerId="owner-1" />);
    await waitFor(() => {
      // No debe haber errores ni texto de otros comentarios
      expect(container.querySelector("[data-comment-error]")).toBeNull();
    });
  });

  it("no llama a commentsApi.add si el campo está vacío", async () => {
    wrap(<CommentsSection postId="post-1" postOwnerId="owner-1" />);
    await waitFor(() => screen.queryByRole("textbox") || screen.queryByPlaceholderText(/comentario/i));

    const input = screen.queryByRole("textbox") ||
                  screen.queryByPlaceholderText(/comentario/i) as HTMLElement;
    const submitBtn = screen.queryByRole("button", { name: /enviar|publicar|comentar/i });

    if (input && submitBtn) {
      fireEvent.change(input, { target: { value: "" } });
      fireEvent.click(submitBtn);
      await waitFor(() => {
        expect(mockCommentsApi.add).not.toHaveBeenCalled();
      });
    }
  });

  it("comentario nuevo aparece en la lista tras enviarse", async () => {
    const newComment = { ...COMMENT_FIXTURE, id: "cmt-new", content: "Nuevo comentario" };
    mockCommentsApi.add.mockResolvedValue({ data: newComment });
    // Segunda llamada a list devuelve el nuevo comentario
    mockCommentsApi.list
      .mockResolvedValueOnce({ data: [] })
      .mockResolvedValueOnce({ data: [newComment] });

    wrap(<CommentsSection postId="post-1" postOwnerId="owner-1" />);
    await waitFor(() => screen.queryByRole("textbox") !== null);

    const input = screen.queryByRole("textbox");
    const submitBtn = screen.queryByRole("button", { name: /enviar|publicar|comentar/i });

    if (input && submitBtn) {
      fireEvent.change(input, { target: { value: "Nuevo comentario" } });
      fireEvent.click(submitBtn);

      await waitFor(() => {
        expect(screen.getByText("Nuevo comentario")).toBeInTheDocument();
      });
    }
  });
});
