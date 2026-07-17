import { StorageImg } from "@/components/storage-img";
import { ageBand } from "@/lib/mission";

export type PersonLite = {
  display_name?: string | null;
  birth_year?: number | null;
  region?: string | null;
  photo?: string | null; // first photo path (answers bucket) when revealed
};

/**
 * Small identity card used on the note / sheet.
 * `withPhoto=false` → locked silhouette (profile hidden until mutual OK):
 * the man sees only nickname · age · region before opening.
 */
export function IdentityCard({ person, withPhoto }: { person: PersonLite; withPhoto: boolean }) {
  const name = person.display_name ?? "상대";
  const age = (person.birth_year ? ageBand(person.birth_year) : "") ?? "";
  return (
    <div className="fl-idc">
      {withPhoto ? (
        person.photo ? (
          <div className="fl-av">
            <StorageImg src={person.photo} alt="" />
          </div>
        ) : (
          <div className="fl-av">{name.slice(0, 1)}</div>
        )
      ) : (
        <div className="fl-av locked" aria-label="비공개">
          <svg viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20 21a8 8 0 10-16 0" />
            <circle cx="12" cy="8" r="4" />
          </svg>
        </div>
      )}
      <div>
        <div className="nm">{age ? `${name} · ${age}` : name}</div>
        {person.region && <div className="loc">{person.region}</div>}
      </div>
    </div>
  );
}
