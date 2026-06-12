import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ChatInput } from "@/components/chat/ChatInput";

vi.mock("@/lib/api", () => ({
  chatMediaApi: {
    upload:       vi.fn(),
    updateOnline: vi.fn(),
    getOnline:    vi.fn(),
  },
}));

// GifPicker hace fetch a Tenor — lo mockeamos globalmente
vi.mock("@/components/chat/GifPicker", () => ({
  GifPicker: ({ onSelect, onClose }: { onSelect: (g: any) => void; onClose: () => void }) => (
    <div data-testid="gif-picker">
      <button
        data-testid="gif-item"
        onClick={() => onSelect({ id: "1", url: "https://media.tenor.com/test.gif", preview: "", title: "Funny cat" })}
      >
        Funny cat
      </button>
      <button data-testid="gif-close" onClick={onClose}>Cerrar</button>
    </div>
  ),
}));

vi.mock("@/components/chat/EmojiPicker", () => ({
  EmojiPicker: () => <div data-testid="emoji-picker" />,
}));

vi.mock("@/components/chat/AudioRecorder", () => ({
  AudioRecorder: () => <div data-testid="audio-recorder" />,
}));

describe("ChatInput — GIF confirmation (BUG: GIF se enviaba sin confirmar)", () => {

  beforeEach(() => vi.clearAllMocks());

  it("seleccionar un GIF muestra preview y NO llama onSend inmediatamente", () => {
    const onSend = vi.fn();
    const { container } = render(<ChatInput onSend={onSend} />);

    // Abrir panel GIF
    fireEvent.click(screen.getByText("GIF"));
    expect(screen.getByTestId("gif-picker")).toBeInTheDocument();

    // Seleccionar un GIF
    fireEvent.click(screen.getByTestId("gif-item"));

    // El panel debe cerrarse
    expect(screen.queryByTestId("gif-picker")).not.toBeInTheDocument();

    // onSend NO debe haberse llamado todavía
    expect(onSend).not.toHaveBeenCalled();

    // El preview del GIF debe estar visible (img en el área de preview)
    const previewImg = container.querySelector('img[src="https://media.tenor.com/test.gif"]');
    expect(previewImg).not.toBeNull();
  });

  it("el GIF se envía sólo cuando el usuario presiona el botón Send", () => {
    const onSend = vi.fn();
    const { container } = render(<ChatInput onSend={onSend} />);

    // Seleccionar GIF
    fireEvent.click(screen.getByText("GIF"));
    fireEvent.click(screen.getByTestId("gif-item"));

    // El preview debe estar ahí antes de enviar
    expect(container.querySelector('img[src="https://media.tenor.com/test.gif"]')).not.toBeNull();

    // Presionar el botón Send (tiene clase shadow-glow-sm = el send button con gradiente)
    const sendBtn = container.querySelector("button.shadow-glow-sm") as HTMLButtonElement;
    expect(sendBtn).not.toBeNull();
    fireEvent.click(sendBtn);

    expect(onSend).toHaveBeenCalledOnce();
    expect(onSend).toHaveBeenCalledWith(
      expect.objectContaining({
        media_url:  "https://media.tenor.com/test.gif",
        media_type: "image",
      })
    );
  });

  it("el usuario puede cancelar el GIF antes de enviarlo", () => {
    const onSend = vi.fn();
    const { container } = render(<ChatInput onSend={onSend} />);

    // Seleccionar GIF → aparece preview
    fireEvent.click(screen.getByText("GIF"));
    fireEvent.click(screen.getByTestId("gif-item"));
    expect(container.querySelector('img[src="https://media.tenor.com/test.gif"]')).not.toBeNull();

    // Cancelar (primer botón sin accessible name = el X del preview)
    const xBtn = container.querySelector('button.text-text-muted') as HTMLButtonElement;
    if (xBtn) fireEvent.click(xBtn);

    // Después de cancelar, onSend no debe haberse llamado
    expect(onSend).not.toHaveBeenCalled();

    // El preview debe haber desaparecido
    expect(container.querySelector('img[src="https://media.tenor.com/test.gif"]')).toBeNull();
  });
});
