import { useRef, useLayoutEffect } from "react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import { UserPlus, Check, Clock, Users } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { useFollow, type FollowStatus } from "@/hooks/useFollow";

interface Props {
  userId: string;
  isPrivateAccount?: boolean;
  size?: "sm" | "md";
  onChange?: (next: FollowStatus, prev: FollowStatus) => void;
}

const reduceMotion = () =>
  typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

type VisualState = "follow" | "following" | "pending" | "mutual";

function resolveState(status: FollowStatus): VisualState {
  if (status.request_pending) return "pending";
  if (status.i_follow && status.mutual) return "mutual";
  if (status.i_follow) return "following";
  return "follow";
}

const COPY: Record<VisualState, { label: string; icon: typeof UserPlus; variant: "primary" | "ghost" }> = {
  follow:    { label: "Seguir",    icon: UserPlus, variant: "primary" },
  following: { label: "Siguiendo", icon: Check,    variant: "ghost"   },
  mutual:    { label: "Amigos",    icon: Users,    variant: "ghost"   },
  pending:   { label: "Solicitado", icon: Clock,   variant: "ghost"   },
};

/** Botón de follow con 4 estados animados (Seguir / Siguiendo / Amigos / Solicitado) y mutación optimista. */
export function FollowButton({ userId, isPrivateAccount = false, size = "sm", onChange }: Props) {
  const { status, toggle, isLoading } = useFollow(userId, { isPrivateAccount, onChange });
  const visual = resolveState(status);
  const { label, icon: Icon, variant } = COPY[visual];

  const labelRef = useRef<HTMLSpanElement>(null);
  const iconWrapRef = useRef<HTMLSpanElement>(null);
  const prevVisual = useRef(visual);

  useGSAP(() => {
    if (prevVisual.current === visual) return;
    prevVisual.current = visual;
    if (reduceMotion() || !labelRef.current || !iconWrapRef.current) return;

    gsap.fromTo(labelRef.current, { opacity: 0, y: 6 }, { opacity: 1, y: 0, duration: 0.22, ease: "power2.out" });
    gsap.fromTo(iconWrapRef.current, { opacity: 0, scale: 0 }, { opacity: 1, scale: 1, duration: 0.32, ease: "back.out(2)" });
  }, { dependencies: [visual] });

  useLayoutEffect(() => {
    prevVisual.current = visual;
  }, []);

  return (
    <Button
      variant={variant}
      size={size}
      onClick={toggle}
      disabled={isLoading || visual === "pending"}
      style={{ minWidth: 118, position: "relative" }}
    >
      <span ref={iconWrapRef} style={{ display: "inline-flex" }}>
        <Icon size={13} strokeWidth={1.5} />
      </span>
      <span ref={labelRef}>{label}</span>
    </Button>
  );
}
