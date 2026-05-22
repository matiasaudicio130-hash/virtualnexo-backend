import { useRef, useState } from "react";
import { Heart } from "lucide-react";

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

  function handleTap(e: React.MouseEvent | React.TouchEvent) {
    const now  = Date.now();
    const diff = now - lastTap.current;

    if (diff < 300 && diff > 0) {
      // Double tap!
      onDoubleTap();

      // Get position relative to element
      let x = 50, y = 50;
      if ("touches" in e && e.changedTouches[0]) {
        const rect = (e.target as HTMLElement).getBoundingClientRect();
        x = ((e.changedTouches[0].clientX - rect.left) / rect.width)  * 100;
        y = ((e.changedTouches[0].clientY - rect.top)  / rect.height) * 100;
      } else if ("clientX" in e) {
        const rect = (e.target as HTMLElement).getBoundingClientRect();
        x = ((e.clientX - rect.left) / rect.width)  * 100;
        y = ((e.clientY - rect.top)  / rect.height) * 100;
      }

      const id = ++counter.current;
      setHearts(h => [...h, { id, x, y }]);
      setTimeout(() => setHearts(h => h.filter(h => h.id !== id)), 900);
    }

    lastTap.current = now;
  }

  return (
    <div
      className={`relative ${className}`}
      onClick={handleTap}
      onTouchEnd={handleTap}
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
