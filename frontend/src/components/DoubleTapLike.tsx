import { useRef, useState } from "react";
import { Heart } from "@phosphor-icons/react";

interface Props {
  onDoubleTap: () => void;
  children:    React.ReactNode;
  className?:  string;
}

interface HeartAnim { id: number; x: number; y: number; }

export function DoubleTapLike({ onDoubleTap, children, className = "" }: Props) {
  const lastTap   = useRef(0);
  const [hearts, setHearts] = useState<HeartAnim[]>([]);
  const counter   = useRef(0);

  function handleTap(e: React.MouseEvent) {
    const now  = Date.now();
    const diff = now - lastTap.current;

    if (diff < 350 && diff > 0) {
      // Double tap / double click — dispara like y resetea
      onDoubleTap();
      lastTap.current = 0;

      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
      const x = ((e.clientX - rect.left) / rect.width)  * 100;
      const y = ((e.clientY - rect.top)  / rect.height) * 100;

      const id = ++counter.current;
      setHearts(h => [...h, { id, x, y }]);
      setTimeout(() => setHearts(h => h.filter(h => h.id !== id)), 900);
      return;
    }

    lastTap.current = now;
  }

  return (
    <div
      className={`relative ${className}`}
      onClick={handleTap}
    >
      {children}

      {/* Floating hearts */}
      {hearts.map(heart => (
        <div
          key={heart.id}
          className="absolute pointer-events-none z-20"
          style={{
            left:      `${heart.x}%`,
            top:       `${heart.y}%`,
            transform: "translate(-50%, -50%)",
          }}
        >
          <Heart
            size={72}
            fill="#ef4444"
            className="text-red-500 drop-shadow-lg"
            style={{ animation: "heart-pop 0.85s ease-out forwards" }}
          />
        </div>
      ))}

      <style>{`
        @keyframes heart-pop {
          0%   { transform: translate(-50%,-50%) scale(0.2); opacity: 0.9; }
          40%  { transform: translate(-50%,-50%) scale(1.3); opacity: 1; }
          70%  { transform: translate(-50%,-50%) scale(1.0); opacity: 1; }
          100% { transform: translate(-50%,-60%) scale(0.9); opacity: 0; }
        }
      `}</style>
    </div>
  );
}
