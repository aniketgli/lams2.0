import { EnterpriseModule } from '../../types';

export const ENTERPRISE_MODULES: EnterpriseModule[] = [
  {
    id: 'lams',
    name: 'Leave & Attendance Management System',
    shortName: 'LAMS 2.0',
    code: 'MOD-LAMS-01',
    subtitle: 'Biometric Integration, CCS Leave Rules & Outdoor Duty Workflow',
    description: 'Comprehensive workforce attendance logging, multi-level approval hierarchies, biometric device management, outdoor duty (OD) tracking, and statutory leave sanctioning.',
    category: 'HR & Administration',
    accentColor: 'emerald',
    badge: 'Operational',
    status: 'active',
    allowedRoles: ['administrator', 'reporting_manager', 'reviewing_manager', 'general_staff'],
    features: [
      'Real-time Biometric Machine Sync (IP / Serial)',
      'Central Civil Services (CCS) Leave Policies',
      '2-Tier Approval Flow (Reporting Mgr + HoD)',
      'Outdoor Duty (OD) Field Approvals & TA Sync',
      'Manual Attendance Punch Regularization',
      'Automated Slack Webhook Alerts & Logs'
    ],
    stats: [
      { label: 'Active Devices', value: '7 Online' },
      { label: 'Leave Quota', value: '18 Types' },
      { label: 'Pending Approvals', value: '4 In Queue' }
    ]
  },
  {
    id: 'pms',
    name: 'Project Management & Research Grants System',
    shortName: 'WII-PMS',
    code: 'MOD-PMS-02',
    subtitle: 'Research Projects, Milestones, PI Portfolios & Field Logistics',
    description: 'End-to-end management of Institute research grants, Principal Investigator (PI) project charters, research scholar rosters, milestone deliverables, and donor progress reports.',
    category: 'Research & Grants',
    accentColor: 'blue',
    badge: 'Enterprise',
    status: 'active',
    allowedRoles: ['administrator', 'reporting_manager', 'reviewing_manager', 'general_staff'],
    features: [
      'Grant Budget Allocation & Sanction Orders',
      'PI & Co-PI Multi-Role Project Assignment',
      'Milestone Tracking & Deliverable Auditing',
      'Project Staff (JRF, SRF, RA) Roster & Duration',
      'Field Expedition Logistics & Permits Matrix',
      'Quarterly Utilization Certificate Generation'
    ],
    stats: [
      { label: 'Sanctioned Projects', value: '34 Active' },
      { label: 'Total Research Grants', value: '₹14.8 Cr' },
      { label: 'Milestones On Track', value: '92%' }
    ]
  },
  {
    id: 'sims',
    name: 'Stock & Inventory Management System',
    shortName: 'WII-SIMS',
    code: 'MOD-SIMS-03',
    subtitle: 'Central Stores, Indent Approvals & Consumables Ledger',
    description: 'Central store inventory control, purchase requisitions, chemical & lab consumables tracking, non-consumable asset tagging, dead-stock registers, and department issuance vouchers.',
    category: 'Stores & Assets',
    accentColor: 'amber',
    badge: 'Enterprise',
    status: 'active',
    allowedRoles: ['administrator', 'reporting_manager', 'reviewing_manager', 'general_staff'],
    features: [
      'Central Store Item Catalog & SKU Tracking',
      'Electronic Indent Requests & Store Issue Slips',
      'Hazardous Lab Chemicals & Consumables Ledger',
      'Fixed Asset Barcoding & Depreciation Register',
      'Minimum Threshold Alerts & Reorder Workflows',
      'Annual Physical Stock Verification Audits'
    ],
    stats: [
      { label: 'SKUs Cataloged', value: '1,420 Items' },
      { label: 'Open Store Indents', value: '8 Pending' },
      { label: 'Stock Health', value: 'Optimal' }
    ]
  },
  {
    id: 'fms',
    name: 'Facility & Campus Management System',
    shortName: 'WII-FMS',
    code: 'MOD-FMS-04',
    subtitle: 'Guest House, Field Vehicle Fleet & Campus Infrastructure',
    description: 'Centralized booking and scheduling for Institute guest houses (VIP Suites & Hostels), official vehicle fleet allotment for field tours, GIS lab booking, and estate maintenance tickets.',
    category: 'Campus Facilities',
    accentColor: 'purple',
    badge: 'Enterprise',
    status: 'active',
    allowedRoles: ['administrator', 'reporting_manager', 'reviewing_manager', 'general_staff'],
    features: [
      'Guest House Suite & Dormitory Electronic Booking',
      'Vehicle Allotment & Field Tour Logbook Tracking',
      'Auditorium, Seminar & Board Room Reservations',
      'GIS Lab & Specialized Analytical Equipment Slots',
      'Campus Electrical & Estate Maintenance Ticketing',
      'Visitor Gate Pass & Security Authorization'
    ],
    stats: [
      { label: 'Guest Rooms', value: '28 Suites' },
      { label: 'Fleet Vehicles', value: '14 Available' },
      { label: 'Bookings Today', value: '11 Confirmed' }
    ]
  },
  {
    id: 'finance',
    name: 'Finance, Contingency & TA/DA Claims Portal',
    shortName: 'WII-FinPay',
    code: 'MOD-FIN-05',
    subtitle: 'TA/DA Bills, Contingency Vouchers & Sanction Head Auditing',
    description: 'Automated claim settlement for official tour travel allowances (TA/DA), field contingency expenditures, bill verification against OD sanctions, and project budget-head reconciliation.',
    category: 'Finance & Accounts',
    accentColor: 'rose',
    badge: 'Enterprise',
    status: 'active',
    allowedRoles: ['administrator', 'reporting_manager', 'reviewing_manager', 'general_staff'],
    features: [
      'Travel Allowance (TA/DA) Digital Bill Submission',
      'Direct Sync with Approved Outdoor Duty (OD) Records',
      'Project Contingency Bill Ledger & Invoice Upload',
      '7th CPC Entitlement & Per Diem Slab Calculator',
      'Drawing & Disbursing Officer (DDO) Sanction Queue',
      'PFMS Integration & Bank Disbursal Status'
    ],
    stats: [
      { label: 'Pending Claims', value: '6 In Audit' },
      { label: 'Settled This Month', value: '₹4.2 Lakhs' },
      { label: 'PFMS Status', value: 'Connected' }
    ]
  }
];
