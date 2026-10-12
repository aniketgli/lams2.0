export type EnterpriseModuleId = 'lams' | 'pms' | 'sims' | 'fms' | 'finance';

export interface EnterpriseModule {
  id: EnterpriseModuleId;
  name: string;
  code: string;
  shortName: string;
  subtitle: string;
  description: string;
  category: 'HR & Administration' | 'Research & Grants' | 'Stores & Assets' | 'Campus Facilities' | 'Finance & Accounts';
  accentColor: string;
  badge: string;
  status: 'active' | 'beta';
  allowedRoles: any[];
  features: string[];
  stats: { label: string; value: string }[];
}

export interface ModuleRoleDef {
  id: string;
  name: string;
  shortName: string;
  description: string;
  moduleId: EnterpriseModuleId;
  color: string;
  badgeBg: string;
  badgeText: string;
  level: 'admin' | 'manager' | 'staff';
}
