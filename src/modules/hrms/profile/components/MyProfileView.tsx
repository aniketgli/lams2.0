import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  BadgeCheck, Briefcase, Camera, Clock, IdCard, Loader2, Network, ShieldCheck, Trash2, Upload, UserRound,
} from 'lucide-react';
import { Alert } from '../../../../shared/components';
import { UserAvatar } from '../../../../shared/components/UserAvatar';
import { ApiError } from '../../../../shared/services/api';
import { MyProfile, ProfileSection, myProfileApi } from '../employeeApi';

/**
 * "Profile" for the signed-in employee. Everything shown comes from the
 * server, which lays the sections out for the employee type (permanent,
 * contractual, project staff, trainee, student, PhD scholar, intern).
 * The employee can add, replace or remove their own photo here.
 */

const SECTION_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  personal: UserRound,
  work: Briefcase,
  reporting: Network,
  attendance: Clock,
};

const ACCEPTED = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_SOURCE_BYTES = 10 * 1024 * 1024;
const PHOTO_SIZE = 400;
const MAX_UPLOAD_BYTES = 500 * 1024;

export function formatDate(value: string | null | undefined): string | null {
  if (!value) return null;
  const d = new Date(`${value}T00:00:00`);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

/** "2 years, 9 months" between a date and today. */
export function serviceLength(from: string | null | undefined, to = new Date()): string | null {
  if (!from) return null;
  const start = new Date(`${from}T00:00:00`);
  if (Number.isNaN(start.getTime()) || start > to) return null;
  let months = (to.getFullYear() - start.getFullYear()) * 12 + (to.getMonth() - start.getMonth());
  if (to.getDate() < start.getDate()) months -= 1;
  const years = Math.floor(months / 12);
  const rest = months % 12;
  const parts = [];
  if (years) parts.push(`${years} year${years === 1 ? '' : 's'}`);
  if (rest || !years) parts.push(`${rest} month${rest === 1 ? '' : 's'}`);
  return parts.join(', ');
}

/** Square, centre-cropped JPEG of at most 400 px, which also drops any location data in the original. */
async function preparePhoto(file: File): Promise<string> {
  if (!ACCEPTED.includes(file.type)) throw new Error('Choose a JPEG, PNG or WebP image.');
  if (file.size > MAX_SOURCE_BYTES) throw new Error('Choose an image smaller than 10 MB.');
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error('This image could not be opened.'));
      el.src = url;
    });
    const side = Math.min(img.naturalWidth, img.naturalHeight);
    if (side < 64) throw new Error('This image is too small. Use one at least 64 × 64 pixels.');
    const size = Math.min(PHOTO_SIZE, side);
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Your browser could not process the image.');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, size, size);
    ctx.drawImage(img, (img.naturalWidth - side) / 2, (img.naturalHeight - side) / 2, side, side, 0, 0, size, size);
    for (const quality of [0.88, 0.78, 0.65]) {
      const data = canvas.toDataURL('image/jpeg', quality);
      if ((data.length * 3) / 4 <= MAX_UPLOAD_BYTES) return data;
    }
    throw new Error('This image is too large even after resizing.');
  } finally {
    URL.revokeObjectURL(url);
  }
}

const SectionCard: React.FC<{ section: ProfileSection }> = ({ section }) => {
  const Icon = SECTION_ICONS[section.id] ?? IdCard;
  return (
    <section className="bg-white border border-slate-200 rounded-2xl shadow-xs">
      <h3 className="flex items-center gap-2 px-5 py-3.5 border-b border-slate-100 text-xs font-bold uppercase tracking-wide text-slate-700">
        <Icon className="w-4 h-4 text-primary" aria-hidden="true" />
        {section.title}
      </h3>
      <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3.5 px-5 py-4">
        {section.fields.map((field) => {
          const shown = field.kind === 'date' ? formatDate(field.value) : field.value;
          return (
            <div key={field.key} className="min-w-0">
              <dt className="text-[11px] font-semibold text-slate-500">{field.label}</dt>
              <dd className={`mt-0.5 text-sm font-semibold break-words ${shown ? 'text-slate-900' : 'text-slate-400 font-medium'}`}>
                {shown
                  ? field.kind === 'email'
                    ? <a href={`mailto:${shown}`} className="hover:text-primary hover:underline">{shown}</a>
                    : shown
                  : 'Not recorded'}
              </dd>
            </div>
          );
        })}
      </dl>
    </section>
  );
};

export const MyProfileView: React.FC<{ onPhotoChanged?: () => void | Promise<void> }> = ({ onPhotoChanged }) => {
  const [profile, setProfile] = useState<MyProfile | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [photoBusy, setPhotoBusy] = useState<'upload' | 'delete' | null>(null);
  const [photoNotice, setPhotoNotice] = useState<{ kind: 'success' | 'error'; text: string } | null>(null);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    try {
      setProfile(await myProfileApi.get());
      setLoadError(null);
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : 'Your profile could not be loaded.');
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const afterPhotoChange = async (photoUrl: string | null, message: string) => {
    setProfile((p) => (p ? { ...p, photoUrl } : p));
    setPhotoNotice({ kind: 'success', text: message });
    await onPhotoChanged?.();
  };

  const onFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setPhotoNotice(null);
    setConfirmRemove(false);
    setPhotoBusy('upload');
    try {
      const image = await preparePhoto(file);
      const result = await myProfileApi.savePhoto(image);
      await afterPhotoChange(result.photoUrl, result.message);
    } catch (error) {
      const text = error instanceof ApiError
        ? (Object.values(error.details ?? {})[0] || error.message)
        : error instanceof Error ? error.message : 'The photo could not be saved.';
      setPhotoNotice({ kind: 'error', text });
    } finally {
      setPhotoBusy(null);
    }
  };

  const removePhoto = async () => {
    setPhotoNotice(null);
    setPhotoBusy('delete');
    try {
      const result = await myProfileApi.deletePhoto();
      setConfirmRemove(false);
      await afterPhotoChange(null, result.message);
    } catch (error) {
      setPhotoNotice({ kind: 'error', text: error instanceof Error ? error.message : 'The photo could not be removed.' });
    } finally {
      setPhotoBusy(null);
    }
  };

  if (loadError) {
    return <Alert variant="error" onDismiss={() => void load()}>{loadError} Select × to try again.</Alert>;
  }
  if (!profile) {
    return (
      <div className="bg-white border border-slate-200 rounded-2xl p-10 flex items-center justify-center gap-2 text-sm text-slate-500">
        <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" /> Loading your profile…
      </div>
    );
  }

  const displayName = [profile.salutation, profile.name].filter(Boolean).join(' ');
  const tenure = serviceLength(profile.joiningDate);

  return (
    <div className="space-y-5">
      {/* Identity banner */}
      <section className="rounded-2xl overflow-hidden border border-slate-200 bg-white shadow-xs">
        <div className="bg-gradient-to-r from-slate-900 via-header-glow to-slate-900 px-5 sm:px-6 py-5 flex flex-col sm:flex-row sm:items-center gap-5">
          <div className="relative shrink-0 self-start">
            <UserAvatar name={profile.name} src={profile.photoUrl} className="w-24 h-24 rounded-2xl ring-4 ring-white/15 bg-slate-800" />
            {photoBusy && (
              <span className="absolute inset-0 rounded-2xl bg-slate-900/60 flex items-center justify-center">
                <Loader2 className="w-6 h-6 text-white animate-spin" aria-label="Saving photo" />
              </span>
            )}
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={Boolean(photoBusy)}
              className="absolute -bottom-2 -right-2 w-9 h-9 rounded-full bg-white text-primary border border-slate-200 shadow-md flex items-center justify-center hover:bg-primary hover:text-white transition-colors cursor-pointer disabled:opacity-60 focus:outline-none focus-visible:ring-2 focus-visible:ring-white"
              title={profile.photoUrl ? 'Change photo' : 'Add photo'}
              aria-label={profile.photoUrl ? 'Change photo' : 'Add photo'}
            >
              <Camera className="w-4 h-4" aria-hidden="true" />
            </button>
            <input ref={fileRef} type="file" accept={ACCEPTED.join(',')} className="hidden" onChange={(e) => void onFile(e)} />
          </div>

          <div className="min-w-0 flex-1 text-white">
            <h2 className="text-xl sm:text-2xl font-extrabold tracking-tight truncate">{displayName}</h2>
            {profile.headline && <p className="text-sm font-semibold text-blue-200 mt-0.5">{profile.headline}</p>}
            {profile.subline && <p className="text-xs text-slate-300 mt-0.5">{profile.subline}</p>}
            <div className="flex flex-wrap items-center gap-2 mt-3">
              <span className="inline-flex items-center gap-1 rounded-full bg-white/10 border border-white/15 px-2.5 py-0.5 text-[11px] font-semibold">
                <IdCard className="w-3.5 h-3.5" aria-hidden="true" /> B.I. {profile.biometricId}
              </span>
              {profile.employeeType.label && (
                <span className="inline-flex items-center gap-1 rounded-full bg-white/10 border border-white/15 px-2.5 py-0.5 text-[11px] font-semibold">
                  <Briefcase className="w-3.5 h-3.5" aria-hidden="true" /> {profile.employeeType.label}
                </span>
              )}
              {tenure && (
                <span className="inline-flex items-center gap-1 rounded-full bg-white/10 border border-white/15 px-2.5 py-0.5 text-[11px] font-semibold">
                  <Clock className="w-3.5 h-3.5" aria-hidden="true" /> {tenure}
                </span>
              )}
              <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-bold ${profile.status === 'active' ? 'bg-emerald-400/20 text-emerald-200 border border-emerald-300/30' : 'bg-rose-400/20 text-rose-200 border border-rose-300/30'}`}>
                <BadgeCheck className="w-3.5 h-3.5" aria-hidden="true" /> {profile.status === 'active' ? 'Active' : 'Inactive'}
              </span>
            </div>
          </div>
        </div>

        {/* Photo controls */}
        <div className="px-5 sm:px-6 py-3 flex flex-wrap items-center gap-2 border-t border-slate-100 bg-slate-50/60">
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={Boolean(photoBusy)}
            className="h-8 px-3 rounded-lg bg-white border border-slate-200 text-xs font-semibold text-slate-700 hover:border-primary/40 hover:text-primary inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-60"
            title="JPEG, PNG or WebP; cropped to a square"
          >
            <Upload className="w-3.5 h-3.5" aria-hidden="true" />
            {profile.photoUrl ? 'Change photo' : 'Add photo'}
          </button>
          {profile.photoUrl && !confirmRemove && (
            <button
              type="button"
              onClick={() => setConfirmRemove(true)}
              disabled={Boolean(photoBusy)}
              className="h-8 px-3 rounded-lg bg-white border border-slate-200 text-xs font-semibold text-slate-700 hover:border-error-border hover:text-error inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-60"
            >
              <Trash2 className="w-3.5 h-3.5" aria-hidden="true" /> Remove photo
            </button>
          )}
          {confirmRemove && (
            <span className="inline-flex items-center gap-2 text-xs text-slate-700">
              Remove your photo?
              <button
                type="button"
                onClick={() => void removePhoto()}
                disabled={Boolean(photoBusy)}
                className="h-8 px-3 rounded-lg bg-error text-white text-xs font-semibold hover:opacity-90 cursor-pointer disabled:opacity-60"
              >
                {photoBusy === 'delete' ? 'Removing…' : 'Yes, remove'}
              </button>
              <button type="button" onClick={() => setConfirmRemove(false)} className="h-8 px-3 rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-100 cursor-pointer">
                Cancel
              </button>
            </span>
          )}
        </div>
        {photoNotice && (
          <div className="px-5 sm:px-6 pb-3 bg-slate-50/60">
            <Alert variant={photoNotice.kind} onDismiss={() => setPhotoNotice(null)}>{photoNotice.text}</Alert>
          </div>
        )}
      </section>

      {/* Sections for this employee type */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
        {profile.sections.map((section) => <SectionCard key={section.id} section={section} />)}
      </div>

      {/* Access */}
      <section className="bg-white border border-slate-200 rounded-2xl shadow-xs">
        <h3 className="flex items-center gap-2 px-5 py-3.5 border-b border-slate-100 text-xs font-bold uppercase tracking-wide text-slate-700">
          <ShieldCheck className="w-4 h-4 text-primary" aria-hidden="true" /> HRMS access
        </h3>
        <div className="px-5 py-4 flex flex-wrap gap-2">
          {profile.roles.length
            ? profile.roles.map((role) => (
              <span key={role} className="rounded-full bg-primary/10 text-primary border border-primary/20 px-3 py-1 text-[11px] font-bold">{role}</span>
            ))
            : <span className="text-sm text-slate-400">No active HRMS role.</span>}
        </div>
      </section>

      {/* Service history (from the database; shown only when there is some) */}
      {profile.history.length > 0 && (
        <section className="bg-white border border-slate-200 rounded-2xl shadow-xs">
          <h3 className="flex items-center gap-2 px-5 py-3.5 border-b border-slate-100 text-xs font-bold uppercase tracking-wide text-slate-700">
            <Briefcase className="w-4 h-4 text-primary" aria-hidden="true" /> Service &amp; posting history
          </h3>
          <ol className="px-5 py-4 space-y-3">
            {profile.history.map((item) => (
              <li key={item.id} className="relative pl-5">
                <span className={`absolute left-0 top-1.5 w-2.5 h-2.5 rounded-full ${item.isOngoing ? 'bg-emerald-500' : 'bg-slate-300'}`} aria-hidden="true" />
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <p className="text-sm font-bold text-slate-900">
                    {item.title}
                    {item.isOngoing && <span className="ml-2 rounded bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 text-[10px] font-bold text-emerald-700 align-middle">CURRENT</span>}
                  </p>
                  <p className="text-xs text-slate-500">
                    {formatDate(item.startDate)} – {item.isOngoing ? 'Present' : formatDate(item.endDate) ?? '—'}
                  </p>
                </div>
                <p className="text-xs text-slate-600 mt-0.5">
                  {[item.projectName !== item.title ? item.projectName : null, item.department, item.piName ? `PI: ${item.piName}` : null].filter(Boolean).join(' · ')}
                </p>
                {item.remarks && <p className="text-xs text-slate-500 mt-0.5">{item.remarks}</p>}
              </li>
            ))}
          </ol>
        </section>
      )}
    </div>
  );
};
