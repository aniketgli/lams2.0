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
      showNotice('success', 'Organization settings saved.');
    } catch (error) {
      if (error instanceof ApiError) {
        setErrors(error.details ?? {});
        showNotice('error', error.message);
      } else showNotice('error', 'Could not save organization settings.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <NoticeBar notice={notice} onClose={clearNotice} />
      <PanelCard
        title={<><Building2 className="w-4 h-4 text-primary" />Organization</>}
        description={`Name, logo, address and copyright shown on every screen.${saved?.updatedAt ? ` Last saved ${formatDateTime(saved.updatedAt)}.` : ''}`}
      >
        {loading ? (
          <p className="text-xs text-slate-500">Loading…</p>
        ) : (
          <form onSubmit={save} className="grid grid-cols-1 lg:grid-cols-12 gap-6" noValidate>
            <fieldset disabled={readOnly || saving} className="lg:col-span-7 space-y-4">
              <Input label="Organization name" required maxLength={255} value={form.orgName} error={errors.orgName}
                onChange={(e) => setForm({ ...form, orgName: e.target.value })} />

              <div>
                <p className="text-xs font-semibold text-slate-700 mb-1.5">Logo</p>
                <div className="flex items-center gap-3">
                  <div className="h-14 w-32 rounded-lg border border-slate-200 bg-slate-50 flex items-center justify-center p-1.5 overflow-hidden">
                    {form.logoData ? <img src={form.logoData} alt="Organization logo" className="max-h-full max-w-full object-contain" /> : <span className="text-[11px] text-slate-400">No logo</span>}
                  </div>
                  {!readOnly && (
                    <div className="flex flex-wrap gap-2">
                      <input ref={fileInput} type="file" accept={LOGO_TYPES.join(',')} className="hidden" onChange={(e) => { pickLogo(e.target.files?.[0]); e.currentTarget.value = ''; }} />
                      <Button variant="outline" size="sm" leftIcon={ImagePlus} onClick={() => fileInput.current?.click()}>{form.logoData ? 'Replace logo' : 'Upload logo'}</Button>
                      {form.logoData && <Button variant="outline" size="sm" leftIcon={Trash2} className="text-error" onClick={() => setForm({ ...form, logoData: '' })}>Remove</Button>}
                    </div>
                  )}
                </div>
                <p className={`text-[11px] mt-1 ${errors.logoData ? 'text-error' : 'text-slate-500'}`}>{errors.logoData || 'PNG, JPG or WEBP, up to 2 MB.'}</p>
              </div>

              <Textarea label="Address" rows={2} maxLength={1000} value={form.address} error={errors.address}
                helperText="Shown on the right of the footer." onChange={(e) => setForm({ ...form, address: e.target.value })} />
              <Input label="Copyright notice" maxLength={500} value={form.copyrightText} error={errors.copyrightText}
                helperText="Shown on the left of the footer." onChange={(e) => setForm({ ...form, copyrightText: e.target.value })} />

              {!readOnly && (
                <div className="flex gap-2 pt-1">
                  <Button variant="primary" size="sm" type="submit" leftIcon={Save} loading={saving} disabled={!dirty}>Save</Button>
                  {dirty && saved && (
                    <Button variant="outline" size="sm" onClick={() => setForm({ orgName: saved.orgName, logoData: saved.logoData, address: saved.address, copyrightText: saved.copyrightText })}>Discard changes</Button>
                  )}
                </div>
              )}
            </fieldset>

            <div className="lg:col-span-5 space-y-3">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Preview</p>
              <div className="rounded-xl border border-slate-200 bg-white p-3">
                <WIILogo variant="horizontal" size="md" customLogoUrl={form.logoData} />
              </div>
              <div className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-[11px] text-slate-600 flex flex-col gap-1.5">
                <span className="font-semibold">{form.copyrightText || `© ${new Date().getFullYear()} ${form.orgName || 'Organization'}`}</span>
                {form.address && <span className="flex items-center gap-1"><MapPin className="w-3 h-3 text-primary shrink-0" />{form.address}</span>}
              </div>
            </div>
          </form>
        )}
      </PanelCard>
    </div>
  );
};
