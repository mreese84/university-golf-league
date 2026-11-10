import { useState } from 'react';
import { exportChapter } from '../../data/backup';
import { dataEnv } from '../../dataEnv';
import { db } from '../../firebase';
import { downloadJson } from '../download';

// For organizers and admins: download everything in the chapter as a backup
export default function ExportChapter({ chapterId }: { chapterId: string }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = async () => {
    setBusy(true);
    setError(null);
    try {
      const backup = await exportChapter(db, dataEnv, chapterId);
      downloadJson(backup, `ugl-${chapterId}-${backup.exportedAt.slice(0, 10)}.json`);
    } catch (err) {
      console.error(err);
      setError("The export didn't finish. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="pt-6 border-t border-gray-100 text-center space-y-2">
      <button onClick={run} disabled={busy} className="text-xs text-gray-400 hover:text-green-600 transition-colors cursor-pointer disabled:cursor-default">
        {busy ? 'Exporting…' : 'Export chapter'}
      </button>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}
