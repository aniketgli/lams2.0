import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import {
  PageHeader,
  Button,
  Badge,
  MetricCard,
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
  TableEmpty,
  TablePagination,
  Modal,
  ModalHeader,
  ModalBody,
  ModalFooter,
  FormField,
  Input,
  Select
} from '../../shared/components';
import {
  Package,
  Plus,
  Search,
  CheckCircle2,
  AlertTriangle,
  Boxes,
  ClipboardList,
  Download
} from 'lucide-react';

interface SIMSViewProps {
  onReturnToLobby: () => void;
}

interface InventoryItem {
  id: string;
  sku: string;
  name: string;
  category: 'Field Equipment' | 'Lab Consumables' | 'Office & IT' | 'Camp Gear';
  currentStock: number;
  unit: string;
  minThreshold: number;
  location: string;
  unitCost: number;
}

interface IndentItem {
  id: string;
  indentNo: string;
  requestedBy: string;
  department: string;
  itemRequested: string;
  quantity: number;
  date: string;
  status: 'Pending Storekeeper' | 'Approved' | 'Issued';
}

const INITIAL_INVENTORY: InventoryItem[] = [
  {
    id: 'INV-01',
    sku: 'SKU-CAM-801',
    name: 'Reconyx HyperFire 2 Cellular Camera Traps',
    category: 'Field Equipment',
    currentStock: 48,
    unit: 'Units',
    minThreshold: 20,
    location: 'Central Store - Rack A2',
    unitCost: 38000
  },
  {
    id: 'INV-02',
    sku: 'SKU-GPS-204',
    name: 'Garmin GPSMAP 66sr Handheld Satellite Receivers',
    category: 'Field Equipment',
    currentStock: 14,
    unit: 'Units',
    minThreshold: 15,
    location: 'Central Store - Safe Locker 3',
    unitCost: 45000
  },
  {
    id: 'INV-03',
    sku: 'SKU-LAB-512',
    name: 'Qiagen DNeasy Blood & Tissue Extraction Kits (250)',
    category: 'Lab Consumables',
    currentStock: 8,
    unit: 'Kits',
    minThreshold: 12,
    location: 'Forensic Lab Refrigerator -4C',
    unitCost: 28500
  },
  {
    id: 'INV-04',
    sku: 'SKU-CAMP-119',
    name: 'Four-Season Weatherproof High-Altitude Dome Tents',
    category: 'Camp Gear',
    currentStock: 32,
    unit: 'Sets',
    minThreshold: 10,
    location: 'Store Shed B - Bay 4',
    unitCost: 18000
  },
  {
    id: 'INV-05',
    sku: 'SKU-IT-091',
    name: 'External 5TB Ruggedized Hard Drives (USB 3.2)',
    category: 'Office & IT',
    currentStock: 25,
    unit: 'Units',
    minThreshold: 10,
    location: 'IT Cell Vault',
    unitCost: 11200
  }
];

const INITIAL_INDENTS: IndentItem[] = [
  {
    id: 'IND-01',
    indentNo: 'WII/STR/2026/082',
    requestedBy: 'Dr. Bilal Habib',
    department: 'Animal Ecology',
    itemRequested: 'Reconyx HyperFire 2 Cellular Camera Traps',
    quantity: 12,
    date: '2026-09-02',
    status: 'Pending Storekeeper'
  },
  {
    id: 'IND-02',
    indentNo: 'WII/STR/2026/079',
    requestedBy: 'Dr. V.P. Sylva',
    department: 'Forensics & Genetics Lab',
    itemRequested: 'Qiagen DNeasy Blood & Tissue Extraction Kits',
    quantity: 4,
    date: '2026-08-28',
    status: 'Approved'
  }
];

export const InventoryView: React.FC<SIMSViewProps> = ({ onReturnToLobby }) => {
  const { currentUser } = useApp();
  const [inventory, setInventory] = useState<InventoryItem[]>(INITIAL_INVENTORY);
  const [indents, setIndents] = useState<IndentItem[]>(INITIAL_INDENTS);
  const [activeSubTab, setActiveSubTab] = useState<'inventory' | 'indents'>('inventory');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCat, setSelectedCat] = useState<string>('ALL');
  const [showIndentModal, setShowIndentModal] = useState(false);

  // Pagination states
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // New Indent form state
  const [selectedItemName, setSelectedItemName] = useState(inventory[0]?.name || '');
  const [indentQty, setIndentQty] = useState(1);
  const [indentRemarks, setIndentRemarks] = useState('');
  const [formError, setFormError] = useState('');

  const formatCurrency = (amt: number) => {
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(amt);
  };

  const handleCreateIndent = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedItemName) {
      setFormError('Please select an item from the catalog.');
      return;
    }

    const newIndent: IndentItem = {
      id: `IND-${String(indents.length + 1).padStart(2, '0')}`,
      indentNo: `WII/STR/2026/${Math.floor(100 + Math.random() * 900)}`,
      requestedBy: currentUser.name,
      department: currentUser.department,
      itemRequested: selectedItemName,
      quantity: Math.max(1, indentQty),
      date: new Date().toISOString().split('T')[0],
      status: 'Pending Storekeeper'
    };
    setIndents([newIndent, ...indents]);
    setShowIndentModal(false);
    setActiveSubTab('indents');
    setIndentQty(1);
    setIndentRemarks('');
    setFormError('');
  };

  const handleExportCSV = () => {
    if (activeSubTab === 'inventory') {
      const headers = ['SKU', 'Item Name', 'Category', 'Current Stock', 'Unit', 'Min Threshold', 'Location', 'Unit Cost'];
      const rows = filteredInventory.map((i) => [
        `"${i.sku}"`,
        `"${i.name.replace(/"/g, '""')}"`,
        `"${i.category}"`,
        i.currentStock,
        `"${i.unit}"`,
        i.minThreshold,
        `"${i.location}"`,
        i.unitCost
      ]);
      const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
      const encodedUri = encodeURI(csvContent);
      const link = document.createElement('a');
      link.setAttribute('href', encodedUri);
      link.setAttribute('download', `WII_Inventory_Catalog_${new Date().toISOString().split('T')[0]}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } else {
      const headers = ['Indent No', 'Item Requested', 'Quantity', 'Requested By', 'Department', 'Date', 'Status'];
      const rows = indents.map((i) => [
        `"${i.indentNo}"`,
        `"${i.itemRequested.replace(/"/g, '""')}"`,
        i.quantity,
        `"${i.requestedBy}"`,
        `"${i.department}"`,
        i.date,
        `"${i.status}"`
      ]);
      const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
      const encodedUri = encodeURI(csvContent);
      const link = document.createElement('a');
      link.setAttribute('href', encodedUri);
      link.setAttribute('download', `WII_Store_Indents_${new Date().toISOString().split('T')[0]}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  const filteredInventory = inventory.filter((item) => {
    const matchesCat = selectedCat === 'ALL' || item.category === selectedCat;
    const matchesSearch =
      item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.sku.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.location.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCat && matchesSearch;
  });

  const filteredIndents = indents.filter((ind) => {
    return (
      ind.itemRequested.toLowerCase().includes(searchQuery.toLowerCase()) ||
      ind.indentNo.toLowerCase().includes(searchQuery.toLowerCase()) ||
      ind.requestedBy.toLowerCase().includes(searchQuery.toLowerCase()) ||
      ind.department.toLowerCase().includes(searchQuery.toLowerCase())
    );
  });

  const lowStockCount = inventory.filter((i) => i.currentStock <= i.minThreshold).length;

  return (
    <div className="space-y-6 pb-12 animate-in fade-in duration-300">
      {/* Standardized Module PageHeader */}
      <PageHeader
        icon={Package}
        title="Stock & Inventory Management System (SIMS)"
        subtitle="Central stores catalog, consumables ledger, field equipment indents & asset verification registers."
        breadcrumbs={[
          { label: 'Portal Hub', onClick: onReturnToLobby },
          { label: 'Stock & Inventory' }
        ]}
        actions={
          <div className="flex items-center space-x-2">
            <Button
              variant="outline"
              size="sm"
              leftIcon={<Download className="w-4 h-4" />}
              onClick={handleExportCSV}
            >
              Export CSV
            </Button>
            <Button
              variant="primary"
              size="sm"
              leftIcon={<Plus className="w-4 h-4" />}
              onClick={() => {
                setFormError('');
                setShowIndentModal(true);
              }}
            >
              Raise Store Indent
            </Button>
          </div>
        }
      />

      {/* Metrics Row using Standardized MetricCard */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <MetricCard
          title="Catalog SKUs"
          value={`${inventory.length} Tracked`}
          subtitle="Central Stores Stock"
          icon={Boxes}
          variant="primary"
        />
        <MetricCard
          title="Low Stock Alerts"
          value={`${lowStockCount} Items`}
          subtitle="Below Minimum Threshold"
          icon={AlertTriangle}
          variant="warning"
        />
        <MetricCard
          title="Open Indents"
          value={`${indents.filter((i) => i.status !== 'Issued').length} Pending`}
          subtitle="Storekeeper Requisitions"
          icon={ClipboardList}
          variant="info"
        />
        <MetricCard
          title="Audited Assets"
          value="100% Barcoded"
          subtitle="Annual Physical Audit Complete"
          icon={CheckCircle2}
          variant="success"
        />
      </div>

      {/* Standardized Tabs Navigation */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
        <Button
          variant={activeSubTab === 'inventory' ? 'primary' : 'outline'}
          size="sm"
          leftIcon={<Boxes className="w-4 h-4" />}
          onClick={() => {
            setActiveSubTab('inventory');
            setCurrentPage(1);
          }}
        >
          Central Inventory Catalog ({inventory.length})
        </Button>
        <Button
          variant={activeSubTab === 'indents' ? 'primary' : 'outline'}
          size="sm"
          leftIcon={<ClipboardList className="w-4 h-4" />}
          onClick={() => {
            setActiveSubTab('indents');
            setCurrentPage(1);
          }}
        >
          Staff Store Indents ({indents.length})
        </Button>
      </div>

      {/* Search & Category Filter */}
      <div className="bg-white border border-slate-200/90 rounded-xl p-4 shadow-2xs flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="w-full sm:w-80">
          <Input
            placeholder={
              activeSubTab === 'inventory'
                ? 'Search item name, SKU, shelf location...'
                : 'Search indent no, requested item, user...'
            }
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setCurrentPage(1);
            }}
            leftIcon={Search}
            size="sm"
          />
        </div>

        {activeSubTab === 'inventory' && (
          <div className="flex items-center space-x-1.5 w-full sm:w-auto justify-end overflow-x-auto">
            <span className="text-xs font-semibold text-slate-500 mr-1 shrink-0">Category:</span>
            {['ALL', 'Field Equipment', 'Lab Consumables', 'Camp Gear', 'Office & IT'].map((cat) => (
              <Button
                key={cat}
                size="xs"
                variant={selectedCat === cat ? 'primary' : 'outline'}
                onClick={() => {
                  setSelectedCat(cat);
                  setCurrentPage(1);
                }}
              >
                {cat}
              </Button>
            ))}
          </div>
        )}
      </div>

      {/* Tab 1: Inventory Catalog Table */}
      {activeSubTab === 'inventory' && (
        <div className="bg-white border border-slate-200/90 rounded-xl overflow-hidden shadow-2xs">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[18%]">SKU / Code</TableHead>
                <TableHead className="w-[32%]">Item Description</TableHead>
                <TableHead className="w-[18%]">Category</TableHead>
                <TableHead align="center" className="w-[14%]">Stock Level</TableHead>
                <TableHead className="w-[18%]">Store Location</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredInventory.length === 0 ? (
                <TableEmpty colSpan={5} message="No catalog inventory items found." />
              ) : (
                filteredInventory.map((item) => {
                  const isLow = item.currentStock <= item.minThreshold;
                  return (
                    <TableRow key={item.id}>
                      <TableCell className="align-middle font-mono font-bold text-slate-800 text-xs">
                        {item.sku}
                      </TableCell>
                      <TableCell className="align-middle">
                        <div className="font-bold text-slate-900">{item.name}</div>
                        <div className="text-[11px] text-slate-500 mt-0.5">
                          Unit Cost: {formatCurrency(item.unitCost)}
                        </div>
                      </TableCell>
                      <TableCell className="align-middle">
                        <Badge variant="neutral">{item.category}</Badge>
                      </TableCell>
                      <TableCell align="center" className="align-middle">
                        <div className="inline-flex items-center space-x-2">
                          <span className={`font-bold text-xs ${isLow ? 'text-red-700 font-extrabold' : 'text-slate-900'}`}>
                            {item.currentStock} {item.unit}
                          </span>
                          {isLow && (
                            <Badge variant="error" size="sm">
                              Low Stock
                            </Badge>
                          )}
                        </div>
                        <div className="text-[10px] text-slate-400">Min: {item.minThreshold} {item.unit}</div>
                      </TableCell>
                      <TableCell className="align-middle text-slate-700 text-xs">
                        {item.location}
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Tab 2: Indents Table */}
      {activeSubTab === 'indents' && (
        <div className="bg-white border border-slate-200/90 rounded-xl overflow-hidden shadow-2xs">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[18%]">Indent No</TableHead>
                <TableHead className="w-[30%]">Item Requested</TableHead>
                <TableHead className="w-[24%]">Requested By &amp; Department</TableHead>
                <TableHead className="w-[14%]">Requisition Date</TableHead>
                <TableHead align="center" className="w-[14%]">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredIndents.length === 0 ? (
                <TableEmpty colSpan={5} message="No store indents found." />
              ) : (
                filteredIndents.map((ind) => (
                  <TableRow key={ind.id}>
                    <TableCell className="align-middle font-mono font-bold text-slate-800 text-xs">
                      {ind.indentNo}
                    </TableCell>
                    <TableCell className="align-middle">
                      <div className="font-bold text-slate-900">{ind.itemRequested}</div>
                      <div className="text-[11px] text-[#2563eb] font-bold mt-0.5">
                        Qty: {ind.quantity} Units
                      </div>
                    </TableCell>
                    <TableCell className="align-middle">
                      <div className="font-bold text-slate-800">{ind.requestedBy}</div>
                      <div className="text-[11px] text-slate-500">{ind.department}</div>
                    </TableCell>
                    <TableCell className="align-middle font-mono text-slate-700 text-xs">
                      {ind.date}
                    </TableCell>
                    <TableCell align="center" className="align-middle">
                      {ind.status === 'Approved' ? (
                        <Badge variant="success">Approved</Badge>
                      ) : ind.status === 'Issued' ? (
                        <Badge variant="info">Issued</Badge>
                      ) : (
                        <Badge variant="warning">Pending Storekeeper</Badge>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Standardized Raise Store Indent Modal */}
      <Modal
        isOpen={showIndentModal}
        onClose={() => setShowIndentModal(false)}
        size="md"
      >
        <ModalHeader
          title="Raise Store Indent Requisition"
          subtitle="Submit consumable or equipment request to the Central Storekeeper."
          icon={Package}
          onClose={() => setShowIndentModal(false)}
        />
        <form onSubmit={handleCreateIndent}>
          <ModalBody className="space-y-4">
            {formError && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs font-semibold text-red-800">
                {formError}
              </div>
            )}

            <FormField label="Catalog Item" required>
              <Select
                value={selectedItemName}
                onChange={(val) => setSelectedItemName(String(val))}
                options={inventory.map((inv) => ({
                  value: inv.name,
                  label: `${inv.name} (Available: ${inv.currentStock} ${inv.unit})`
                }))}
              />
            </FormField>

            <div className="grid grid-cols-2 gap-4">
              <FormField label="Required Quantity" required>
                <Input
                  type="number"
                  min="1"
                  value={indentQty}
                  onChange={(e) => setIndentQty(parseInt(e.target.value, 10) || 1)}
                  required
                />
              </FormField>

              <FormField label="Indent Date">
                <Input
                  type="date"
                  value={new Date().toISOString().split('T')[0]}
                  disabled
                />
              </FormField>
            </div>

            <FormField label="Justification / Project Requirement">
              <Input
                value={indentRemarks}
                onChange={(e) => setIndentRemarks(e.target.value)}
                placeholder="e.g. Required for field expedition in Rajaji Landscape"
              />
            </FormField>
          </ModalBody>
          <ModalFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setShowIndentModal(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
            >
              Submit Requisition
            </Button>
          </ModalFooter>
        </form>
      </Modal>
    </div>
  );
};
