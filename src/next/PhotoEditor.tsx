import { useState } from 'react';
import { CROP_FRAME, type CropView } from '../data/images';
import type { Person } from '../data/types';
import { drawPhoto, loadImage, uploadImage } from '../data/uploads';
import { updateProfile } from '../data/writes';
import { dataEnv } from '../dataEnv';
import { db, storage } from '../firebase';
import { photoUrl } from './chapter/data';
import { buttonClass } from './parts';
import PhotoCropper from './PhotoCropper';
import { useSession } from './sessionContext';

const smallButton = 'text-sm font-medium text-green-700 hover:underline cursor-pointer';

// A person's profile photo: add or change one (picked, then cropped to the portrait frame), or remove
// it. Saves on its own, apart from the rest of the profile. The person, their chapters' organizers
// and admins can change it (firestore.rules).
export default function PhotoEditor({ personId, person }: { personId: string; person: Person }) {
  const { user } = useSession();
  const [img, setImg] = useState<HTMLImageElement | null>(null);
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState<CropView['offset']>({ x: 0, y: 0 });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [removing, setRemoving] = useState(false);
  const photo = photoUrl(person);

  const pick = async (file: File | undefined) => {
    if (!file) return;
    setError(null);
    try {
      const picked = await loadImage(file);
      setImg(picked);
      setZoom(1);
      setOffset({ x: 0, y: 0 });
    } catch (err) {
      setError((err as Error).message);
    }
  };
  const close = () => {
    if (img) URL.revokeObjectURL(img.src);
    setImg(null);
  };
  const work = async (job: () => Promise<unknown>, failed: string) => {
    setBusy(true);
    setError(null);
    try {
      await job();
      return true;
    } catch (err) {
      console.error(err);
      setError(failed);
      return false;
    } finally {
      setBusy(false);
    }
  };
  const save = async () => {
    if (!img || !user) return;
    const done = await work(async () => {
      const blob = await drawPhoto(img, { frame: CROP_FRAME, zoom, offset });
      const url = await uploadImage(storage, dataEnv, user.uid, 'photo', personId, blob);
      await updateProfile(db, dataEnv, personId, { photo: url });
    }, "The photo didn't upload. Check your connection and try again.");
    if (done) close();
  };
  const remove = async () => {
    if (await work(() => updateProfile(db, dataEnv, personId, { photo: null }), "That didn't save. Check your connection and try again.")) setRemoving(false);
  };

  if (img) {
    return (
      <div className="space-y-3">
        <p className="text-sm font-medium text-gray-600">Crop the photo</p>
        <PhotoCropper
          img={img}
          zoom={zoom}
          offset={offset}
          onChange={(z, o) => {
            setZoom(z);
            setOffset(o);
          }}
        />
        {error && <p className="text-sm text-red-600 text-center">{error}</p>}
        <div className="flex items-center justify-center gap-4">
          <button onClick={() => void save()} disabled={busy} className={buttonClass}>
            {busy ? 'Uploading…' : 'Save photo'}
          </button>
          <button onClick={close} disabled={busy} className="text-sm text-gray-500 hover:text-gray-700 font-medium cursor-pointer">
            Cancel
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-4">
      {photo ? (
        <img src={photo} alt={`${person.name}'s photo`} className="w-20 aspect-[3/4] shrink-0 rounded-2xl object-cover object-[50%_25%] bg-gray-100 shadow-sm" />
      ) : (
        <span className="w-20 aspect-[3/4] shrink-0 rounded-2xl bg-gray-100 text-gray-400 text-xs flex items-center justify-center text-center px-2">No photo yet</span>
      )}
      <div className="space-y-1.5">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
          <label className={`${smallButton} focus-within:underline`}>
            {photo ? 'Change photo' : 'Add a photo'}
            <input
              type="file"
              accept="image/*"
              className="sr-only"
              disabled={busy}
              onChange={(e) => {
                void pick(e.target.files?.[0]);
                e.target.value = '';
              }}
            />
          </label>
          {photo && !removing && (
            <button onClick={() => setRemoving(true)} className="text-sm font-medium text-gray-500 hover:text-red-600 cursor-pointer">
              Remove
            </button>
          )}
        </div>
        {removing ? (
          <p className="text-sm text-gray-600">
            Remove the photo?{' '}
            <button onClick={() => void remove()} disabled={busy} className="font-medium text-red-600 hover:underline cursor-pointer">
              {busy ? 'Removing…' : 'Remove it'}
            </button>{' '}
            ·{' '}
            <button onClick={() => setRemoving(false)} className="font-medium text-gray-500 hover:underline cursor-pointer">
              Keep it
            </button>
          </p>
        ) : (
          <p className="text-xs text-gray-400">A portrait works best: you'll crop it to fit before it's saved.</p>
        )}
        {error && <p className="text-sm text-red-600">{error}</p>}
      </div>
    </div>
  );
}
