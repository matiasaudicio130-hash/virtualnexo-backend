import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { feedApi } from "@/lib/api";
import type { Story } from "@/types";

interface Props {
  province?: string;
  onSelectStory: (story: Story) => void;
}

export function StoryBar({ province, onSelectStory }: Props) {
  const navigate = useNavigate();
  const [stories, setStories] = useState<Story[]>([]);

  useEffect(() => {
    feedApi.getStories(province).then(r => setStories(r.data)).catch(() => {});
  }, [province]);

  if (stories.length === 0) return null;

  return (
    <div className="flex gap-3 overflow-x-auto pb-1 px-1 scrollbar-none">
      {stories.map((s) => (
        <div key={s.user_id} className="flex flex-col items-center gap-1 flex-shrink-0 group">
          <button
            onClick={() => onSelectStory(s)}
            className="block"
            onContextMenu={e => { e.preventDefault(); navigate(`/profile/${s.user_id}`); }}
          >
          {/* Anillo de gradiente */}
          <div className="p-0.5 rounded-full bg-gradient-to-tr from-accent-purple via-accent-pink to-yellow-400">
            <div className="p-0.5 rounded-full bg-bg-base">
              <div className="w-14 h-14 rounded-full overflow-hidden bg-bg-muted">
                {s.avatar ? (
                  <img
                    src={s.avatar}
                    alt={s.name}
                    draggable={false}
                    className="w-full h-full object-cover pointer-events-none select-none"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-2xl">
                    {s.name.charAt(0).toUpperCase()}
                  </div>
                )}
              </div>
            </div>
          </div>
          </button>
          <button
            onClick={() => navigate(`/profile/${s.user_id}`)}
            className="text-[10px] text-text-secondary truncate w-14 text-center hover:text-accent-purple transition-colors"
          >
            {s.name.split(" ")[0]}
          </button>
        </div>
      ))}
    </div>
  );
}
