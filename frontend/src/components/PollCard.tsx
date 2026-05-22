/**
 * PollCard — muestra un poll con opciones votables y barra de resultados.
 * Si el usuario ya votó, muestra los porcentajes con la opción elegida destacada.
 */
import { useState } from "react";
import { BarChart2, Users, Clock } from "lucide-react";
import { feedApi } from "@/lib/api";

interface PollData {
  question: string;
  options: string[];
  votes: number[];
  total_votes: number;
  duration_hours?: number;
}

interface Props {
  postId: string;
  poll: PollData;
  userVote?: number | null;   // índice de la opción que votó, o null si no votó
  expiresAt?: string | null;
  onVoted?: (optionIndex: number, votes: number[], total: number) => void;
}

function pct(votes: number[], idx: number): number {
  const total = votes.reduce((a, b) => a + b, 0);
  if (total === 0) return 0;
  return Math.round((votes[idx] / total) * 100);
}

function timeLeft(expiresAt: string): string {
  const diff = new Date(expiresAt).getTime() - Date.now();
  if (diff <= 0) return "Cerrado";
  const h = Math.floor(diff / 3600000);
  if (h < 1) return `${Math.floor(diff / 60000)}m restantes`;
  if (h < 24) return `${h}h restantes`;
  return `${Math.floor(h / 24)}d restantes`;
}

export function PollCard({ postId, poll, userVote: initialVote, expiresAt, onVoted }: Props) {
  const [userVote, setUserVote] = useState<number | null>(initialVote ?? null);
  const [votes, setVotes]       = useState(poll.votes?.length === poll.options.length ? poll.votes : poll.options.map(() => 0));
  const [total, setTotal]       = useState(poll.total_votes ?? 0);
  const [loading, setLoading]   = useState<number | null>(null);

  const hasVoted = userVote !== null;
  const expired  = expiresAt ? new Date(expiresAt).getTime() < Date.now() : false;

  async function handleVote(idx: number) {
    if (hasVoted || expired || loading !== null) return;
    setLoading(idx);
    try {
      const { data } = await feedApi.votePoll(postId, idx);
      setUserVote(idx);
      setVotes(data.votes);
      setTotal(data.total_votes);
      onVoted?.(idx, data.votes, data.total_votes);
    } catch (e: any) {
      if (e?.response?.status === 409) {
        setUserVote(idx);
      }
    }
    setLoading(null);
  }

  return (
    <div className="px-4 py-3 space-y-3">
      {/* Pregunta */}
      <div className="flex items-start gap-2">
        <BarChart2 size={15} className="text-accent-purple mt-0.5 flex-shrink-0" />
        <p className="font-semibold text-sm leading-snug">{poll.question}</p>
      </div>

      {/* Opciones */}
      <div className="space-y-2">
        {poll.options.map((opt, idx) => {
          const p = pct(votes, idx);
          const isChosen  = userVote === idx;
          const isLeading = hasVoted && votes[idx] === Math.max(...votes) && votes[idx] > 0;

          return (
            <button
              key={idx}
              onClick={() => handleVote(idx)}
              disabled={hasVoted || expired || loading !== null}
              className={`relative w-full rounded-xl text-left overflow-hidden transition-all
                ${!hasVoted && !expired ? "hover:border-accent-purple/60 active:scale-[0.98]" : ""}
                ${isChosen ? "border-accent-purple" : "border-border"}
                border`}
            >
              {/* Barra de progreso (solo visible tras votar) */}
              {hasVoted && (
                <div
                  className={`absolute inset-y-0 left-0 transition-all duration-700 ease-out rounded-xl
                    ${isChosen ? "bg-accent-purple/20" : "bg-bg-muted"}`}
                  style={{ width: `${p}%` }}
                />
              )}

              <div className="relative flex items-center justify-between px-3 py-2.5 gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  {/* Bullet / check */}
                  <span className={`w-4 h-4 rounded-full border flex items-center justify-center flex-shrink-0 text-[9px] font-bold transition-colors
                    ${isChosen ? "border-accent-purple bg-accent-purple text-white" : "border-border"}`}>
                    {isChosen ? "✓" : ""}
                  </span>
                  <span className={`text-sm truncate ${isChosen ? "font-semibold text-accent-purple" : "text-text-primary"}`}>
                    {opt}
                  </span>
                  {isLeading && hasVoted && (
                    <span className="text-[9px] text-accent-purple font-medium px-1.5 py-0.5 bg-accent-purple/10 rounded-full flex-shrink-0">
                      + votos
                    </span>
                  )}
                </div>

                {hasVoted && (
                  <span className={`text-xs font-bold tabular-nums flex-shrink-0 ${isChosen ? "text-accent-purple" : "text-text-muted"}`}>
                    {p}%
                  </span>
                )}

                {loading === idx && (
                  <div className="w-3.5 h-3.5 border-2 border-accent-purple/30 border-t-accent-purple rounded-full animate-spin flex-shrink-0" />
                )}
              </div>
            </button>
          );
        })}
      </div>

      {/* Footer: votos totales + tiempo restante */}
      <div className="flex items-center gap-3 text-[11px] text-text-muted pt-0.5">
        <span className="flex items-center gap-1">
          <Users size={10} />
          {total} {total === 1 ? "voto" : "votos"}
        </span>
        {expiresAt && (
          <span className="flex items-center gap-1">
            <Clock size={10} />
            {timeLeft(expiresAt)}
          </span>
        )}
        {!hasVoted && !expired && (
          <span className="ml-auto text-accent-purple/70">Tocá para votar</span>
        )}
        {expired && <span className="ml-auto text-status-error/70">Cerrado</span>}
      </div>
    </div>
  );
}
