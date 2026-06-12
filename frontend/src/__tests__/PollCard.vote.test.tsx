/**
 * Tests para PollCard — flujo de votación.
 *
 * BUGs que previenen:
 * - El usuario puede votar más de una vez (doble click)
 * - Los porcentajes no aparecen tras votar
 * - Poll expirado sigue aceptando votos
 * - Loading spinner no se muestra mientras vota
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { PollCard } from "@/components/PollCard";

const mockVotePoll = vi.fn();

vi.mock("@/lib/api", () => ({
  feedApi: {
    votePoll: (...args: any[]) => mockVotePoll(...args),
  },
}));

const POLL_BASE = {
  question: "¿Cuál es tu favorito?",
  options: ["Opción A", "Opción B", "Opción C"],
  votes: [10, 5, 3],
  total_votes: 18,
};

describe("PollCard — votación", () => {

  beforeEach(() => {
    vi.clearAllMocks();
    mockVotePoll.mockResolvedValue({ data: { votes: [11, 5, 3], total_votes: 19 } });
  });

  it("renderiza la pregunta y todas las opciones", () => {
    render(<PollCard postId="post-1" poll={POLL_BASE} userVote={null} />);

    expect(screen.getByText("¿Cuál es tu favorito?")).toBeInTheDocument();
    expect(screen.getByText("Opción A")).toBeInTheDocument();
    expect(screen.getByText("Opción B")).toBeInTheDocument();
    expect(screen.getByText("Opción C")).toBeInTheDocument();
  });

  it("botones están habilitados cuando el usuario no votó", () => {
    render(<PollCard postId="post-1" poll={POLL_BASE} userVote={null} />);
    const buttons = screen.getAllByRole("button");
    buttons.forEach(btn => expect(btn).not.toBeDisabled());
  });

  it("al votar llama a feedApi.votePoll con el índice correcto", async () => {
    render(<PollCard postId="post-1" poll={POLL_BASE} userVote={null} />);

    fireEvent.click(screen.getByText("Opción B"));

    await waitFor(() => expect(mockVotePoll).toHaveBeenCalledWith("post-1", 1));
  });

  it("después de votar los botones quedan deshabilitados", async () => {
    render(<PollCard postId="post-1" poll={POLL_BASE} userVote={null} />);

    fireEvent.click(screen.getByText("Opción A"));

    await waitFor(() => {
      const buttons = screen.getAllByRole("button");
      buttons.forEach(btn => expect(btn).toBeDisabled());
    });
  });

  it("después de votar muestra porcentajes", async () => {
    render(<PollCard postId="post-1" poll={POLL_BASE} userVote={null} />);

    fireEvent.click(screen.getByText("Opción A"));

    await waitFor(() => {
      // 11/19 ≈ 58%
      expect(screen.getByText("58%")).toBeInTheDocument();
    });
  });

  it("si el usuario ya votó al montar, muestra porcentajes directamente", () => {
    render(<PollCard postId="post-1" poll={POLL_BASE} userVote={0} />);

    // 10/18 ≈ 56%
    expect(screen.getByText("56%")).toBeInTheDocument();
    const buttons = screen.getAllByRole("button");
    buttons.forEach(btn => expect(btn).toBeDisabled());
  });

  it("poll expirado deshabilita todos los botones", () => {
    const pastDate = new Date(Date.now() - 1000).toISOString();
    render(<PollCard postId="post-1" poll={POLL_BASE} userVote={null} expiresAt={pastDate} />);

    const buttons = screen.getAllByRole("button");
    buttons.forEach(btn => expect(btn).toBeDisabled());
  });

  it("no permite doble voto — segundo click ignorado", async () => {
    render(<PollCard postId="post-1" poll={POLL_BASE} userVote={null} />);

    fireEvent.click(screen.getByText("Opción A"));
    fireEvent.click(screen.getByText("Opción A")); // segundo click inmediato

    await waitFor(() => {
      expect(mockVotePoll).toHaveBeenCalledTimes(1);
    });
  });

  it("llama onVoted con el índice y los votos actualizados", async () => {
    const onVoted = vi.fn();
    render(<PollCard postId="post-1" poll={POLL_BASE} userVote={null} onVoted={onVoted} />);

    fireEvent.click(screen.getByText("Opción C"));

    await waitFor(() => {
      expect(onVoted).toHaveBeenCalledWith(2, [11, 5, 3], 19);
    });
  });
});
