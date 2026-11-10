import { useState } from 'react';
import { espnGameUrl, parseEspnEventId } from '../../../espn';
import type { GuideFootball } from '../../../types';
import { EditorCard, FormField } from './editorParts';
import { inputClass, isDate, useSaving } from './editorUtils';

// The game: who, when, the line and where, and its ESPN game. With an ESPN game linked, the card
// shows its live details; these show until then, or when ESPN can't be reached.
export default function FootballEditor({ football, onSave, onCancel }: { football: GuideFootball; onSave: (football: GuideFootball) => Promise<void>; onCancel: () => void }) {
  const [away, setAway] = useState(football.away);
  const [home, setHome] = useState(football.home);
  const [date, setDate] = useState(football.date ?? '');
  const [kickoff, setKickoff] = useState(football.kickoff ?? '');
  const [line, setLine] = useState(football.line ?? '');
  const [venue, setVenue] = useState(football.venue ?? '');
  const [espn, setEspn] = useState(football.espnEventId ? espnGameUrl(football.espnEventId) : '');
  const { saving, error, run } = useSaving();
  const espnId = espn.trim() ? parseEspnEventId(espn) : null;
  const espnError = espn.trim() && !espnId ? "That doesn't look like an ESPN game link." : null;
  const canSave = (!date || isDate(date)) && !espnError;

  const save = () =>
    run(() =>
      onSave({
        ...football,
        away: away.trim(),
        home: home.trim(),
        date: date || null,
        kickoff: kickoff.trim() || null,
        line: line.trim() || null,
        venue: venue.trim() || null,
        espnEventId: espnId,
      }),
    );

  return (
    <EditorCard title="The game" error={error} canSave={canSave} saving={saving} onSave={save} onCancel={onCancel}>
      <div className="grid grid-cols-2 gap-3">
        <FormField label="Away">
          <input value={away} onChange={(e) => setAway(e.target.value)} placeholder="Texas A&M" className={inputClass} />
        </FormField>
        <FormField label="Home">
          <input value={home} onChange={(e) => setHome(e.target.value)} placeholder="South Carolina" className={inputClass} />
        </FormField>
        <FormField label="Date">
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={inputClass} />
        </FormField>
        <FormField label="Kickoff">
          <input value={kickoff} onChange={(e) => setKickoff(e.target.value)} placeholder="7:30 PM ET" className={inputClass} />
        </FormField>
        <FormField label="Line">
          <input value={line} onChange={(e) => setLine(e.target.value)} placeholder="USC -3.5" className={inputClass} />
        </FormField>
        <FormField label="Venue">
          <input value={venue} onChange={(e) => setVenue(e.target.value)} placeholder="Williams-Brice Stadium" className={inputClass} />
        </FormField>
      </div>
      <FormField label="ESPN game link" hint="Open the game on espn.com and paste its address, for live scores and the latest kickoff time. Leave blank to show only the details above." error={espnError}>
        <input value={espn} onChange={(e) => setEspn(e.target.value)} placeholder="https://www.espn.com/college-football/game/_/gameId/…" inputMode="url" autoCapitalize="none" className={inputClass} />
      </FormField>
    </EditorCard>
  );
}
