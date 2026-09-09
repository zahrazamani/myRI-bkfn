import React from 'react';
import {
  type HeroProfile,
  VIRTUE_ORDER,
  VIRTUE_META,
  rankFor,
  nextRank,
} from '../services/heroProfile';

interface HeroCardProps {
  profile: HeroProfile;
  /** live session points (starts at the stored total, grows during play) */
  points: number;
}

const HeroCard: React.FC<HeroCardProps> = ({ profile, points }) => {
  const rank = rankFor(points);
  const next = nextRank(points);
  const span = next ? next.min - rank.min : 1;
  const pct = next ? Math.min(100, Math.round(((points - rank.min) / span) * 100)) : 100;

  return (
    <div className="px-4 py-3 bg-gradient-to-r from-indigo-50 to-purple-50 border-b border-indigo-100">
      <div className="flex items-center gap-3">
        <span className="text-2xl leading-none" aria-hidden>{profile.emblem || '🦸'}</span>
        <div className="min-w-0">
          <div className="font-bold text-indigo-800 text-sm truncate">
            {profile.heroName || 'New Hero'}
          </div>
          <div className="text-xs text-indigo-500">
            {rank.icon} {rank.name} · Visit #{profile.visitCount}
          </div>
        </div>
        <div className="ml-auto flex items-center gap-1.5 bg-yellow-100 border border-yellow-300 rounded-full px-2.5 py-1">
          <span aria-hidden>🪙</span>
          <span className="font-bold text-yellow-800 text-sm">{points}</span>
        </div>
      </div>

      <div className="mt-2 h-1.5 w-full rounded-full bg-indigo-100 overflow-hidden">
        <div className="h-full bg-indigo-500 transition-all duration-500" style={{ width: `${pct}%` }} />
      </div>
      <div className="mt-0.5 text-[10px] text-indigo-400 text-right">
        {next ? `${next.min - points} points to ${next.name}` : 'Top rank reached'}
      </div>

      <div className="mt-2 flex items-center gap-2">
        {VIRTUE_ORDER.map(v => {
          const on = profile.virtues[v];
          return (
            <span
              key={v}
              title={`${VIRTUE_META[v].label}${on ? ' — earned' : ' — locked'}`}
              className={`text-lg transition-opacity ${on ? 'opacity-100' : 'opacity-25 grayscale'}`}
            >
              {VIRTUE_META[v].icon}
            </span>
          );
        })}
      </div>
    </div>
  );
};

export default HeroCard;
