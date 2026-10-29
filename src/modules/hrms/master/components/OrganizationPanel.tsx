import React, { useEffect, useRef, useState } from 'react';
import { Building2, ImagePlus, MapPin, Save, Trash2 } from 'lucide-react';
import { useApp } from '../../../../context/AppContext';
import { Button, Input, Textarea } from '../../../../shared/components';
import { WIILogo } from '../../../../shared/components/WIILogo';
import { ApiError } from '../../../../shared/services/api';
import { OrganizationSettings, organizationApi } from '../masterApi';
import { NoticeBar, PanelCard, formatDateTime, useNotice } from './masterUi';

const MAX_LOGO_BYTES = 2 * 1024 * 1024;
const LOGO_TYPES = ['image/png', 'image/jpeg', 'image/webp'];

type Form = Omit<OrganizationSettings, 'updatedAt'>;

/** A small picture of the app frame, so changes can be seen before saving. */
const LivePreview: React.FC<{ form: Form }> = ({ form }) => (
  <div className="rounded-xl border border-slate-200 overflow-hidden bg-slate-50" aria-label="Preview">
    <div className="bg-white border-b border-slate-200 px-3 py-2.5 flex items-center justify-between gap-3">
      <WIILogo variant="horizontal" size="sm" customLogoUrl={form.logoData} />
      <span className="h-5 w-16 rounded-full bg-slate-100" aria-hidden="true" />
    </div>
    <div className="p-3 space-y-2" aria-hidden="true">
      <div className="h-8 rounded-md bg-gradient-to-r from-slate-900 via-header-glow to-slate-900" />
      <div className="h-3 w-3/4 rounded bg-slate-200" />
      <div className="h-3 w-1/2 rounded bg-slate-200" />
    </div>
    <div className="bg-white border-t border-slate-200 px-3 py-2 flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-[10px] text-slate-600">
      <span className="font-semibold">{form.copyrightText || `© ${new Date().getFullYear()} ${form.orgName || 'Organization'}`}</span>
      {form.address && <span className="flex items-center gap-1"><MapPin className="w-3 h-3 text-primary shrink-0" />{form.address}</span>}
    </div>
  </div>
);

export const OrganizationPanel: React.FC<{ readOnly: boolean }> = ({ readOnly }) => {
  const { updateOrgBranding } = useApp();
  const [form, setForm] = useState<Form>({ orgName: '', logoData: '', address: '', copyrightText: '' });
  const [saved, setSaved] = useState<OrganizationSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [notice, showNotice, clearNotice] = useNotice();
  const fileInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let cancelled = false;
    organizationApi.get()
      .then((org) => {
        if (cancelled) return;
        setSaved(org);
        if (org) setForm({ orgName: org.orgName, logoData: org.logoData, address: org.address, copyrightText: org.copyrightText });
      })
      .catch((error) => !cancelled && showNotice('error', error instanceof Error ? error.message : 'Could not load organization settings.'))
      .finally(() => !cancelled && setLoading(false));
    return () => { cancelled = true; };
  }, [showNotice]);

  const dirty = !saved || saved.orgName !== form.orgName || saved.logoData !== form.logoData || saved.address !== form.address || saved.copyrightText !== form.copyrightText;

  const pickLogo = (file?: File) => {
    if (!file) return;
    if (!LOGO_TYPES.includes(file.type) || file.size > MAX_LOGO_BYTES) {
      setErrors((e) => ({ ...e, logoData: 'Choose a PNG, JPG or WEBP image under 2 MB.' }));
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setForm((f) => ({ ...f, logoData: String(reader.result || '') }));
      setErrors((e) => ({ ...e, logoData: '' }));
    };
    reader.readAsDataURL(file);
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.orgName.trim()) {
      setErrors({ orgName: 'Organization name is required.' });
      return;
    }
    setSaving(true);
    setErrors({});
    try {
      const result = await organizationApi.save(form);
      setSaved(result);
      setForm({ orgName: result.orgName, logoData: result.logoData, address: result.address, copyrightText: result.copyrightText });
      updateOrgBranding({ orgName: result.orgName, logoUrl: result.logoData, logoType: 'custom', address: result.address, copyrightText: result.copyrightText });
      showNotice('success', 'Organization details saved.');
    } catch (error) {
      if (error instanceof ApiError) {
        setErrors(error.details ?? {});
        showNotice('error', error.message);
      } else showNotice('error', 'Could not save organization details.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <NoticeBar notice={notice} onClose={clearNotice} />
      <PanelCard
        title={<><Building2 className="w-4 h-4 text-primary" />Organization details</>}
        description={`Name, logo, address and copyright shown on every screen and in emails.${saved?.updatedAt ? ` Last saved ${formatDateTime(saved.updatedAt)}.` : ''}`}
      >
        {loading ? (
          <p className="text-xs text-slate-500">Loading…</p>
        ) : (
          <form onSubmit={save} noValidate className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <fieldset disabled={readOnly || saving} className="lg:col-span-7 space-y-4">
              <Input label="Organization name" required maxLength={255} value={form.orgName} error={errors.orgName}
                onChange={(e) => setForm({ ...form, orgName: e.target.value })} />
              <Textarea label="Address" rows={2} maxLength={1000} value={form.address} error={errors.address}
                helperText="Shown on the right of the footer." onChange={(e) => setForm({ ...form, address: e.target.value })} />
              <Input label="Copyright notice" maxLength={500} value={form.copyrightText} error={errors.copyrightText}
                placeholder={`© ${new Date().getFullYear()} ${form.orgName || 'Organization'}`}
                helperText="Shown on the left of the footer." onChange={(e) => setForm({ ...form, copyrightText: e.target.value })} />

              {!readOnly && (
                <div className="flex flex-wrap gap-2 border-t border-slate-100 pt-4">
                  <Button variant="primary" size="sm" type="submit" leftIcon={Save} loading={saving} disabled={!dirty}>Save organization details</Button>
                  {dirty && saved && (
                    <Button variant="ghost" size="sm" onClick={() => setForm({ orgName: saved.orgName, logoData: saved.logoData, address: saved.address, copyrightText: saved.copyrightText })}>Discard changes</Button>
                  )}
                </div>
              )}
            </fieldset>

            <div className="lg:col-span-5 space-y-4">
              <div>
                <p className="text-xs font-semibold text-slate-700 mb-1.5">Logo</p>
                <div className="flex items-center gap-3 rounded-xl border border-dashed border-slate-300 bg-slate-50/60 p-3">
                  <div className="h-14 w-36 shrink-0 rounded-lg border border-slate-200 bg-white flex items-center justify-center p-1.5 overflow-hidden">
                    {form.logoData ? <img src={form.logoData} alt="Organization logo" className="max-h-full max-w-full object-contain" /> : <span className="text-[11px] text-slate-400">No logo</span>}
                  </div>
                  <div className="min-w-0 space-y-1.5">
                    {!readOnly && (
                      <div className="flex flex-wrap gap-2">
                        <input ref={fileInput} type="file" accept={LOGO_TYPES.join(',')} className="hidden" onChange={(e) => { pickLogo(e.target.files?.[0]); e.currentTarget.value = ''; }} />
                        <Button variant="outline" size="xs" leftIcon={ImagePlus} onClick={() => fileInput.current?.click()}>{form.logoData ? 'Replace' : 'Upload'}</Button>
                        {form.logoData && <Button variant="outline" size="xs" leftIcon={Trash2} className="text-error" onClick={() => setForm({ ...form, logoData: '' })}>Remove</Button>}
                      </div>
                    )}
                    <p className={`text-[11px] ${errors.logoData ? 'text-error' : 'text-slate-500'}`}>{errors.logoData || 'PNG, JPG or WEBP, up to 2 MB.'}</p>
                  </div>
                </div>
              </div>
              <div>
                <p className="text-xs font-semibold text-slate-700 mb-1.5">Preview</p>
                <LivePreview form={form} />
              </div>
            </div>
          </form>
        )}
      </PanelCard>
    </div>
  );
};
