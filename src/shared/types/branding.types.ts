export interface OrgBranding {
  orgName: string;
  logoUrl: string;
  address?: string;
  copyrightText?: string;
  appName?: string;
  orgHindiName?: string;
  badgeText?: string;
  logoType?: 'default' | 'custom';
  themePrimaryColor?: string;
  addressLine1?: string;
  addressLine2?: string;
  city?: string;
  state?: string;
  pincode?: string;
  country?: string;
  phone?: string;
  email?: string;
  website?: string;
  updatedAt?: string;
  updatedBy?: string;
}

export const formatOrgAddress = (org?: Partial<OrgBranding> | null): string => {
  if (!org) return '';
  if (org.address && org.address.trim()) {
    return org.address.trim();
  }
  const parts = [
    org.addressLine1,
    org.addressLine2,
    org.city ? `${org.city}${org.pincode ? ` - ${org.pincode}` : ''}` : org.pincode,
    org.state,
    org.country
  ].filter(Boolean);
  return parts.join(', ');
};
