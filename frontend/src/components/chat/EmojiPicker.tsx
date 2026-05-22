import { useEffect, useRef } from "react";
import Picker from "@emoji-mart/react";
import data from "@emoji-mart/data";

interface Props {
  onSelect: (emoji: string) => void;
  onClose: () => void;
  theme?: "dark" | "light";
}

export function EmojiPicker({ onSelect, onClose, theme = "dark" }: Props) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [onClose]);

  return (
    <div ref={ref} className="absolute bottom-full mb-2 left-0 z-50 animate-slide-up">
      <Picker
        data={data}
        onEmojiSelect={(e: any) => { onSelect(e.native); onClose(); }}
        theme={theme}
        locale="es"
        previewPosition="none"
        skinTonePosition="none"
        set="native"
        perLine={8}
        maxFrequentRows={2}
      />
    </div>
  );
}
