import { cloneElement, useId, type ReactElement, type ReactNode } from 'react';
import { Card, inputClass } from '../../../components/guide/parts';
import { fromClock, toClock } from '../../../data/guideEdit';

// The frame around a section's editor: its fields, then Save and Cancel
export function EditorCard({
  title,
  note,
  error,
  canSave,
  saving,
  onSave,
  onCancel,
  children,
}: {
  title: string;
  note?: ReactNode;
  error: string | null;
  canSave: boolean;
  saving: boolean;
  onSave: () => void;
  onCancel: () => void;
  children: ReactNode;
}) {
  return (
    <Card className="space-y-4 ring-2 ring-(--guide)/30">
      <h4 className="text-lg font-semibold text-gray-800">{title}</h4>
      {note && <p className="text-xs text-amber-800 bg-amber-50 rounded-xl px-3 py-2">{note}</p>}
      {children}
      {error && <p className="text-xs text-red-600">{error}</p>}
      <div className="flex gap-3 pt-1">
        <button
          onClick={onSave}
          disabled={!canSave || saving}
          className="px-4 py-2 bg-green-600 text-white rounded-xl font-medium text-sm hover:bg-green-700
                     disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
        >
          {saving ? 'Saving…' : 'Save'}
        </button>
        <button
          onClick={onCancel}
          disabled={saving}
          className="px-4 py-2 text-sm text-gray-500 hover:text-gray-700 font-medium transition-colors cursor-pointer"
        >
          Cancel
        </button>
      </div>
    </Card>
  );
}

// A labeled field: the label names it, and the hint or error describes it
export function FormField({ label, hint, error, children }: { label: string; hint?: ReactNode; error?: string | null; children: ReactElement<{ id?: string; 'aria-describedby'?: string }> }) {
  const id = useId();
  const note = error ?? hint;
  return (
    <div className="min-w-0">
      <label htmlFor={id} className="block text-xs font-medium text-gray-500 mb-1">
        {label}
      </label>
      {cloneElement(children, { id, 'aria-describedby': note ? `${id}-note` : undefined })}
      {note && (
        <p id={`${id}-note`} className={`text-xs mt-1 ${error ? 'text-red-600' : 'text-gray-400'}`}>
          {note}
        </p>
      )}
    </div>
  );
}

// One item in a list being edited (a flight, team, round or session), with its own Remove
export function ItemBox({ title, onRemove, children }: { title: ReactNode; onRemove?: () => void; children: ReactNode }) {
  return (
    <div className="rounded-xl border border-gray-200 p-4 space-y-3">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-semibold text-gray-700 min-w-0 truncate">{title}</p>
        {onRemove && (
          <button onClick={onRemove} className="text-xs font-medium text-gray-400 hover:text-red-500 cursor-pointer shrink-0">
            Remove
          </button>
        )}
      </div>
      {children}
    </div>
  );
}

export function AddButton({ onClick, children }: { onClick: () => void; children: ReactNode }) {
  return (
    <button
      onClick={onClick}
      className="w-full py-2 rounded-xl border border-dashed border-gray-300 text-sm font-medium text-gray-500
                 hover:border-(--guide) hover:text-(--guide) transition-colors cursor-pointer"
    >
      {children}
    </button>
  );
}

// A time as the guide shows it ("10:00 AM"), picked with the device's time picker
export function ClockInput({ value, onChange, disabled, label, ...rest }: { value: string; onChange: (time: string) => void; disabled?: boolean; label?: string; id?: string; 'aria-describedby'?: string }) {
  return (
    <input
      {...rest}
      type="time"
      aria-label={label}
      value={fromClock(value)}
      onChange={(e) => onChange(toClock(e.target.value))}
      disabled={disabled}
      className={inputClass}
    />
  );
}
