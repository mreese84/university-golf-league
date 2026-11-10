import { useState } from 'react';

export { inputClass } from '../../../components/guide/parts';

// Saving state for an editor: run(save) shows "Saving…", and an error if it fails
export function useSaving() {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const run = async (save: () => Promise<void>) => {
    setSaving(true);
    setError(null);
    try {
      await save();
    } catch (err) {
      console.error(err);
      setError("That didn't save. Check your connection and try again.");
      setSaving(false);
    }
  };
  return { saving, error, run };
}

// Lines of text, one item each (rules, notes)
export const linesOf = (text: string) => text.split('\n').map((l) => l.trim()).filter(Boolean);

export const isDate = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s);
