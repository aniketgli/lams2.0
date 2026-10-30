import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ArrowLeft, Briefcase, Camera, CheckCircle2, Clock, Fingerprint, History as HistoryIcon, Building2, Loader2, Mail, Network, Phone,
  Trash2, Upload, UserRound, XCircle,
} from 'lucide-react';
import { Alert } from '../../../../shared/components';
import { UserAvatar } from '../../../../shared/components/UserAvatar';
import { ApiError } from '../../../../shared/services/api';
import { CareerEntry, MyProfile, ProfileField, employeeProfileApi, myProfileApi } from '../employeeApi';

/**
 * "Profile" for the signed-in employee. Everything comes from the server,
 * which lays the details out for the employee type (permanent, contractual,
 * project staff, trainee, student, PhD scholar, intern). The photo is changed
 * or removed from the camera button on the avatar.
 */

type IconType = React.ComponentType<{ className?: string }>;

const ACCEPTED = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_SOURCE_BYTES = 10 * 1024 * 1024;
const PHOTO_SIZE = 400;
const MAX_UPLOAD_BYTES = 500 * 1024;

/** Fields shown in the side "Contact" card instead of their section. */
const CONTACT: { key: string; icon: IconType }[] = [
  { key: 'email', icon: Mail },
  { key: 'phone', icon: Phone },
  { key: 'biometricId', icon: Fingerprint },
  { key: 'institute', icon: Building2 },
];
const CONTACT_KEYS = new Set(CONTACT.map((c) => c.key));

const SECTION_ICONS: Record<string, IconType> = {
  personal: UserRound,
  work: Briefcase,
  reporting: Network,
  attendance: Clock,
};

export function formatDate(value: string | null | undefined): string | null {
  if (!value) return null;
  const d = new Date(`${value}T00:00:00`);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

/** "2 years, 9 months" between two dates (to = today when omitted). */
export function serviceLength(from: string | null | undefined, to: string | Date | null = null): string | null {
  if (!from) return null;
  const start = new Date(`${from}T00:00:00`);
  const end = to ? (to instanceof Date ? to : new Date(`${to}T00:00:00`)) : new Date();
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start > end) return null;
  let months = (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth());
  if (end.getDate() < start.getDate()) months -= 1;
  const years = Math.floor(months / 12);
  const rest = months % 12;
  const parts = [];
  if (years) parts.push(`${years} yr${years === 1 ? '' : 's'}`);
  if (rest || !years) parts.push(`${rest} mo${rest === 1 ? '' : 's'}`);
  return parts.join(' ');
}

/** Square, centre-cropped JPEG of at most 400 px; re-drawing also drops location data in the original. */
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

const shownValue = (field: ProfileField): string | null => (field.kind === 'date' ? formatDate(field.value) : field.value);

// ---------------------------------------------------------------------------
// Building blocks
// ---------------------------------------------------------------------------

const Card: React.FC<{ title: string; icon: IconType; children: React.ReactNode; className?: string }> = ({ title, icon: Icon, children, className = '' }) => (
  <section className={`bg-white border border-slate-200 rounded-2xl shadow-xs ${className}`}>
    <h3 className="flex items-center gap-2 px-5 pt-4 pb-3 text-[13px] font-bold text-slate-800">
      <span className="w-7 h-7 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
        <Icon className="w-4 h-4" aria-hidden="true" />
      </span>
      {title}
    </h3>
    {children}
  </section>
);

const FieldGrid: React.FC<{ fields: ProfileField[] }> = ({ fields }) => (
  <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4 px-5 pb-5 pt-1">
    {fields.map((field) => {
      const value = shownValue(field);
      return (
        <div key={field.key} className="min-w-0">
          <dt className="text-[11px] font-medium text-slate-500">{field.label}</dt>
          <dd className={`mt-0.5 text-sm break-words ${value ? 'font-semibold text-slate-900' : 'text-slate-400'}`}>{value ?? 'Not recorded'}</dd>
        </div>
      );
    })}
  </dl>
);

const CareerTimeline: React.FC<{ entries: CareerEntry[] }> = ({ entries }) => {
  if (!entries.length) {
    return <p className="px-5 pb-5 text-sm text-slate-400">No appointment has been recorded yet.</p>;
  }
  return (
    <ol className="px-5 pb-5 pt-1">
      {entries.map((entry, index) => {
        const last = index === entries.length - 1;
        const range = entry.startDate
          ? `${formatDate(entry.startDate)} – ${entry.isCurrent ? 'Present' : formatDate(entry.endDate) ?? '—'}`
          : null;
        const length = serviceLength(entry.startDate, entry.isCurrent ? null : entry.endDate);
        return (
          <li key={entry.id} className="relative pl-8 pb-5 last:pb-0">
            {!last && <span className="absolute left-[11px] top-6 bottom-0 w-px bg-slate-200" aria-hidden="true" />}
            <span
              className={`absolute left-0 top-0.5 w-[23px] h-[23px] rounded-full border-2 flex items-center justify-center ${
                entry.isCurrent ? 'border-emerald-500 bg-emerald-50' : 'border-slate-300 bg-white'
              }`}
              aria-hidden="true"
            >
              <span className={`w-2 h-2 rounded-full ${entry.isCurrent ? 'bg-emerald-500' : 'bg-slate-300'}`} />
            </span>
            <div className="flex flex-col gap-1">
              <div className="min-w-0">
                <p className="text-sm font-bold text-slate-900">
                  {entry.title}
                  {entry.isCurrent && <span className="ml-2 text-[11px] font-semibold text-emerald-700">Current</span>}
                </p>
                {entry.organisation && <p className="text-[13px] text-slate-600 mt-0.5">{entry.organisation}</p>}
                {entry.details.length > 0 && <p className="text-xs text-slate-500 mt-0.5">{entry.details.join(' · ')}</p>}
                {entry.validUpto && entry.isCurrent && <p className="text-xs text-slate-500 mt-0.5">Valid up to {formatDate(entry.validUpto)}</p>}
                {entry.remarks && <p className="text-xs text-slate-500 mt-0.5">{entry.remarks}</p>}
              </div>
              {range && (
                <div>
                  <p className="text-xs font-semibold text-slate-700">{range}</p>
                  {length && <p className="text-[11px] text-slate-500 mt-0.5">{length}</p>}
                </div>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
};

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

/** Where a profile comes from and, when allowed, how its photo is changed. */
export interface ProfileSource {
  /** Changes whenever a different profile should be loaded. */
  key: string;
  load: () => Promise<MyProfile>;
  photo: {
    save: (image: string, profile: MyProfile) => Promise<{ photoUrl: string; message: string }>;
    remove: (profile: MyProfile) => Promise<{ photoUrl: null; message: string }>;
  } | null;
}

const OWN_PROFILE: ProfileSource = {
  key: 'me',
  load: () => myProfileApi.get(),
  photo: { save: (image) => myProfileApi.savePhoto(image), remove: () => myProfileApi.deletePhoto() },
};

/** The signed-in employee's own profile; they may change their own photo. */
export const MyProfileView: React.FC<{ onPhotoChanged?: () => void | Promise<void> }> = ({ onPhotoChanged }) => (
  <ProfileView source={OWN_PROFILE} onPhotoChanged={onPhotoChanged} />
);

/**
 * Another employee's profile. The server decides whether the viewer may see it;
 * `canEditPhoto` (administrators) adds the camera button, which the server checks again.
 */
export const EmployeeProfileView: React.FC<{ userId: string; canEditPhoto: boolean; onBack?: () => void; onPhotoChanged?: () => void | Promise<void> }> = ({ userId, canEditPhoto, onBack, onPhotoChanged }) => {
  const source = React.useMemo<ProfileSource>(() => ({
    key: `employee:${userId}:${canEditPhoto}`,
    load: () => employeeProfileApi.get(userId),
    photo: canEditPhoto
      ? {
        save: (image, p) => employeeProfileApi.savePhoto(p.biometricId, image),
        remove: (p) => employeeProfileApi.deletePhoto(p.biometricId),
      }
      : null,
  }), [userId, canEditPhoto]);
  return <ProfileView source={source} onBack={onBack} onPhotoChanged={onPhotoChanged} />;
};

const ProfileView: React.FC<{ source: ProfileSource; onBack?: () => void; onPhotoChanged?: () => void | Promise<void> }> = ({ source, onBack, onPhotoChanged }) => {
  const [profile, setProfile] = useState<MyProfile | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [toast, setToast] = useState<{ kind: 'success' | 'error'; text: string } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    try {
      setProfile(await source.load());
      setLoadError(null);
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : 'This profile could not be loaded.');
    }
  }, [source]);
  // A different employee: start fresh.
  useEffect(() => { setProfile(null); setMenuOpen(false); setConfirmRemove(false); }, [source.key]);
  useEffect(() => { void load(); }, [load]);

  // Close the photo menu on an outside click or Escape.
  useEffect(() => {
    if (!menuOpen) return;
    const onDown = (e: MouseEvent) => { if (!menuRef.current?.contains(e.target as Node)) { setMenuOpen(false); setConfirmRemove(false); } };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { setMenuOpen(false); setConfirmRemove(false); } };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey); };
  }, [menuOpen]);

  useEffect(() => {
    if (toast?.kind !== 'success') return;
    const t = window.setTimeout(() => setToast(null), 3500);
    return () => window.clearTimeout(t);
  }, [toast]);

  const done = async (photoUrl: string | null, message: string) => {
    setProfile((p) => (p ? { ...p, photoUrl } : p));
    setToast({ kind: 'success', text: message });
    await onPhotoChanged?.();
  };

  const onCamera = () => {
    if (photoBusy) return;
    // With no photo there is nothing to choose between: open the file picker directly.
    if (!profile?.photoUrl) fileRef.current?.click();
    else setMenuOpen((open) => !open);
  };

  const onFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    setMenuOpen(false);
    if (!file) return;
    setPhotoBusy(true);
    try {
      if (!source.photo || !profile) return;
      const result = await source.photo.save(await preparePhoto(file), profile);
      await done(result.photoUrl, result.message);
    } catch (error) {
      const text = error instanceof ApiError
        ? (Object.values(error.details ?? {})[0] || error.message)
        : error instanceof Error ? error.message : 'The photo could not be saved.';
      setToast({ kind: 'error', text });
    } finally {
      setPhotoBusy(false);
    }
  };

  const removePhoto = async () => {
    setMenuOpen(false);
    setConfirmRemove(false);
    setPhotoBusy(true);
    try {
      if (!source.photo || !profile) return;
      const result = await source.photo.remove(profile);
      await done(null, result.message);
    } catch (error) {
      setToast({ kind: 'error', text: error instanceof Error ? error.message : 'The photo could not be removed.' });
    } finally {
      setPhotoBusy(false);
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

  const allFields = profile.sections.flatMap((s) => s.fields);
  const contact = CONTACT.map((c) => ({ ...c, field: allFields.find((f) => f.key === c.key) })).filter((c) => c.field);
  const sections = profile.sections
    .map((s) => ({ ...s, fields: s.fields.filter((f) => !CONTACT_KEYS.has(f.key)) }))
    .filter((s) => s.fields.length > 0);
  // Employment first, personal last.
  const order = ['work', 'reporting', 'attendance', 'personal'];
  sections.sort((a, b) => order.indexOf(a.id) - order.indexOf(b.id));

  const displayName = [profile.salutation, profile.name].filter(Boolean).join(' ');
  const subtitle = [profile.headline, profile.subline].filter(Boolean).join(' · ');

  return (
    <div className="space-y-5">
      {/* Identity */}
      <section className="bg-white border border-slate-200 rounded-2xl shadow-xs">
        <div className="relative h-24 sm:h-28 rounded-t-2xl bg-gradient-to-r from-slate-900 via-header-glow to-slate-900">
          {onBack && (
            <button
              type="button"
              onClick={onBack}
              className="absolute top-3 right-3 sm:top-4 sm:right-4 h-8 px-3 rounded-lg bg-white/10 hover:bg-white/20 border border-white/20 text-white text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
            >
              <ArrowLeft className="w-3.5 h-3.5" aria-hidden="true" /> Back to directory
            </button>
          )}
        </div>
        <div className="px-5 sm:px-7 pb-5 flex flex-col sm:flex-row sm:items-end gap-4 -mt-12 sm:-mt-14">
          <div className="relative shrink-0 self-start" ref={menuRef}>
            <UserAvatar name={profile.name} src={profile.photoUrl} className="w-24 h-24 sm:w-28 sm:h-28 rounded-2xl ring-4 ring-white bg-slate-800 shadow-md" />
            {photoBusy && (
              <span className="absolute inset-0 rounded-2xl bg-slate-900/55 flex items-center justify-center">
                <Loader2 className="w-6 h-6 text-white animate-spin" aria-label="Saving photo" />
              </span>
            )}
            {source.photo && (
            <button
              type="button"
              onClick={onCamera}
              disabled={photoBusy}
              aria-haspopup={profile.photoUrl ? 'menu' : undefined}
              aria-expanded={profile.photoUrl ? menuOpen : undefined}
              aria-label={profile.photoUrl ? 'Change or remove photo' : 'Add photo'}
              title={profile.photoUrl ? 'Change or remove photo' : 'Add photo (JPEG, PNG or WebP)'}
              className="absolute -bottom-1.5 -right-1.5 w-9 h-9 rounded-full bg-primary text-white ring-4 ring-white shadow-md flex items-center justify-center hover:bg-primary/90 transition-colors cursor-pointer disabled:opacity-60 focus:outline-none focus-visible:ring-primary/40"
            >
              <Camera className="w-4 h-4" aria-hidden="true" />
            </button>
            )}
            <input ref={fileRef} type="file" accept={ACCEPTED.join(',')} className="hidden" onChange={(e) => void onFile(e)} />

            {menuOpen && (
              <div role="menu" className="absolute z-20 left-0 top-full mt-3 w-56 rounded-xl border border-slate-200 bg-white shadow-lg p-1.5">
                {!confirmRemove ? (
                  <>
                    <button
                      type="button" role="menuitem"
                      onClick={() => fileRef.current?.click()}
                      className="w-full flex items-center gap-2 rounded-lg px-3 py-2 text-left text-[13px] font-medium text-slate-700 hover:bg-slate-100 cursor-pointer"
                    >
                      <Upload className="w-4 h-4 text-primary" aria-hidden="true" /> Upload new photo
                    </button>
                    <button
                      type="button" role="menuitem"
                      onClick={() => setConfirmRemove(true)}
                      className="w-full flex items-center gap-2 rounded-lg px-3 py-2 text-left text-[13px] font-medium text-error hover:bg-error-subtle cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4" aria-hidden="true" /> Remove photo
                    </button>
                  </>
                ) : (
                  <div className="p-2 space-y-2">
                    <p className="text-[13px] font-semibold text-slate-800">Remove your photo?</p>
                    <div className="flex gap-2">
                      <button type="button" onClick={() => void removePhoto()} className="flex-1 h-8 rounded-lg bg-error text-white text-xs font-semibold hover:opacity-90 cursor-pointer">
                        Remove
                      </button>
                      <button type="button" onClick={() => setConfirmRemove(false)} className="flex-1 h-8 rounded-lg border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer">
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="min-w-0 sm:pb-1">
            <h2 className="text-xl sm:text-2xl font-extrabold tracking-tight text-slate-900 truncate">{displayName}</h2>
            {subtitle && <p className="text-sm text-slate-600 mt-0.5">{subtitle}</p>}
          </div>
        </div>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-[20rem_1fr] gap-5 items-start">
        {/* Side column */}
        <div className="space-y-5">
          <Card title="Contact" icon={Mail}>
            <ul className="px-5 pb-5 pt-1 space-y-3.5">
              {contact.map(({ key, icon: Icon, field }) => {
                const value = shownValue(field!);
                return (
                  <li key={key} className="flex items-start gap-3 min-w-0">
                    <Icon className="w-4 h-4 text-slate-400 mt-0.5 shrink-0" aria-hidden="true" />
                    <div className="min-w-0">
                      <p className="text-[11px] font-medium text-slate-500">{field!.label}</p>
                      <p className={`text-sm break-all ${value ? 'font-semibold text-slate-900' : 'text-slate-400'}`}>
                        {value && field!.kind === 'email' ? <a href={`mailto:${value}`} className="hover:text-primary hover:underline">{value}</a> : value ?? 'Not recorded'}
                      </p>
                    </div>
                  </li>
                );
              })}
            </ul>
          </Card>

          <Card title="Appointment history" icon={HistoryIcon}>
            <CareerTimeline entries={profile.career} />
          </Card>
        </div>

        {/* Main column */}
        <div className="space-y-5 min-w-0">
          {sections.map((section) => (
            <Card key={section.id} title={section.title} icon={SECTION_ICONS[section.id] ?? Briefcase}>
              <FieldGrid fields={section.fields} />
            </Card>
          ))}
        </div>
      </div>

      {toast && (
        <div
          role={toast.kind === 'success' ? 'status' : 'alert'}
          className={`fixed z-50 bottom-5 right-5 max-w-sm flex items-start gap-2 rounded-xl border px-4 py-3 text-[13px] font-medium shadow-lg ${
            toast.kind === 'success' ? 'bg-white border-success-border text-success' : 'bg-white border-error-border text-error'
          }`}
        >
          {toast.kind === 'success' ? <CheckCircle2 className="w-4 h-4 mt-px shrink-0" /> : <XCircle className="w-4 h-4 mt-px shrink-0" />}
          <span className="flex-1">{toast.text}</span>
          <button type="button" onClick={() => setToast(null)} className="opacity-60 hover:opacity-100 cursor-pointer" aria-label="Dismiss">×</button>
        </div>
      )}
    </div>
  );
};
