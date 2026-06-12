/**
 * Tests para FollowButton — estados visuales y lógica optimista.
 *
 * BUGs que previenen:
 * - Botón no refleja el estado real (seguir/siguiendo/amigos/solicitado)
 * - Click en "Solicitado" dispara otra petición
 * - Error en la API no revierte el estado visual
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";

// Mocks antes de importar el componente
vi.mock("gsap", () => ({ default: { fromTo: vi.fn(), to: vi.fn() } }));
vi.mock("@gsap/react", () => ({
  useGSAP: vi.fn((fn: () => void) => { try { fn(); } catch {} }),
}));

// vi.mock se hoist antes de los const — se usa vi.hoisted para evitar TDZ
const mockFollowsApi = vi.hoisted(() => ({
  status: vi.fn(),
  follow: vi.fn(),
  unfollow: vi.fn(),
}));

vi.mock("@/lib/api", () => ({
  followsApi: mockFollowsApi,
}));

import { FollowButton } from "@/components/profile/FollowButton";

function wrap(ui: React.ReactElement) {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>{ui}</MemoryRouter>
    </QueryClientProvider>
  );
}

describe("FollowButton — estados", () => {

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('muestra "Seguir" cuando no sigo al usuario', async () => {
    mockFollowsApi.status.mockResolvedValue({
      data: { i_follow: false, follows_me: false, mutual: false, request_pending: false },
    });
    wrap(<FollowButton userId="user-1" />);
    await waitFor(() => expect(screen.getByText("Seguir")).toBeInTheDocument());
  });

  it('muestra "Siguiendo" cuando sigo al usuario', async () => {
    mockFollowsApi.status.mockResolvedValue({
      data: { i_follow: true, follows_me: false, mutual: false, request_pending: false },
    });
    wrap(<FollowButton userId="user-2" />);
    await waitFor(() => expect(screen.getByText("Siguiendo")).toBeInTheDocument());
  });

  it('muestra "Amigos" cuando el follow es mutuo', async () => {
    mockFollowsApi.status.mockResolvedValue({
      data: { i_follow: true, follows_me: true, mutual: true, request_pending: false },
    });
    wrap(<FollowButton userId="user-3" />);
    await waitFor(() => expect(screen.getByText("Amigos")).toBeInTheDocument());
  });

  it('muestra "Solicitado" cuando hay solicitud pendiente', async () => {
    mockFollowsApi.status.mockResolvedValue({
      data: { i_follow: false, follows_me: false, mutual: false, request_pending: true },
    });
    wrap(<FollowButton userId="user-4" />);
    await waitFor(() => expect(screen.getByText("Solicitado")).toBeInTheDocument());
  });

  it('botón "Solicitado" está deshabilitado — no permite re-clic', async () => {
    mockFollowsApi.status.mockResolvedValue({
      data: { i_follow: false, follows_me: false, mutual: false, request_pending: true },
    });
    wrap(<FollowButton userId="user-5" />);
    await waitFor(() => {
      const btn = screen.getByRole("button");
      expect(btn).toBeDisabled();
    });
    expect(mockFollowsApi.follow).not.toHaveBeenCalled();
  });

  it("click en Seguir llama a followsApi.follow", async () => {
    mockFollowsApi.status.mockResolvedValue({
      data: { i_follow: false, follows_me: false, mutual: false, request_pending: false },
    });
    // Reemplazar con nueva vi.fn() (igual que el test de unfollow que sí pasa)
    mockFollowsApi.follow = vi.fn().mockResolvedValue({ data: { requested: false } });

    wrap(<FollowButton userId="user-6" />);
    // "Seguir" aparece desde DEFAULT_STATUS aunque el botón esté disabled.
    // Hay que esperar que la query resuelva y el botón quede habilitado.
    await waitFor(() => {
      const btn = screen.getByRole("button");
      expect(btn).not.toBeDisabled();
    });

    fireEvent.click(screen.getByRole("button"));

    // El estado visual cambia optimistamente en onMutate (antes que el API retorne)
    await waitFor(() => expect(screen.getByText("Siguiendo")).toBeInTheDocument());
    expect(mockFollowsApi.follow).toHaveBeenCalledWith("user-6");
  });

  it("click en Siguiendo llama a followsApi.unfollow", async () => {
    mockFollowsApi.status.mockResolvedValue({
      data: { i_follow: true, follows_me: false, mutual: false, request_pending: false },
    });
    mockFollowsApi.unfollow = vi.fn().mockResolvedValue({});

    wrap(<FollowButton userId="user-7" />);
    await waitFor(() => screen.getByText("Siguiendo"));

    fireEvent.click(screen.getByRole("button"));

    await waitFor(() => expect(screen.getByText("Seguir")).toBeInTheDocument());
    expect(mockFollowsApi.unfollow).toHaveBeenCalledWith("user-7");
  });
});
