import type { Emblem as EmblemName } from '../../types';
import { EMBLEM_PATHS } from './emblemPaths';

// The emblem shapes are defined once per page (<EmblemDefs />) and referenced with <use>,
// since a guide can show the detailed palmetto dozens of times.
const symbolId = (name: EmblemName) => `ugl-emblem-${name}`;

export function EmblemDefs() {
  return (
    <svg width="0" height="0" aria-hidden="true" className="absolute">
      <defs>
        {(Object.keys(EMBLEM_PATHS) as EmblemName[]).map((name) => (
          <symbol key={name} id={symbolId(name)} viewBox={EMBLEM_PATHS[name].viewBox}>
            <path d={EMBLEM_PATHS[name].d} fillRule="evenodd" />
          </symbol>
        ))}
      </defs>
    </svg>
  );
}

// A team's mark: its uploaded logo (Phase 2), else its built-in emblem, else nothing. Sized by
// className like the emblem. A logo keeps its own shape and colors, so it sits on a small white disc
// to show on any team color; faint watermarks (plate false) leave it bare.
export function TeamEmblem({ team, className = '', plate = true }: { team: { emblem?: EmblemName; logo?: string }; className?: string; plate?: boolean }) {
  if (team.logo && !plate) return <img src={team.logo} alt="" className={`${className} object-contain`} />;
  if (team.logo) {
    return (
      <span className={`${className} flex items-center justify-center rounded-full bg-white`}>
        <img src={team.logo} alt="" className="w-[78%] h-[78%] object-contain" />
      </span>
    );
  }
  if (team.emblem) return <Emblem name={team.emblem} className={className} />;
  return null;
}

export default function Emblem({ name, className }: { name: EmblemName; className?: string }) {
  return (
    <svg fill="currentColor" aria-hidden="true" className={className}>
      <use href={`#${symbolId(name)}`} />
    </svg>
  );
}
