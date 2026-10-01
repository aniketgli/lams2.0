import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import {
  Package,
  Plus,
  Search,
  CheckCircle2,
  AlertTriangle,
  FileSpreadsheet,
  Boxes,
  ArrowDownRight,
  ClipboardList
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

export const SIMSView: React.FC<SIMSViewProps> = ({ onReturnToLobby }) => {
  const { currentUser } = useApp();
  const [inventory, setInventory] = useState<InventoryItem[]>(INITIAL_INVENTORY);
  const [indents, setIndents] = useState<IndentItem[]>(INITIAL_INDENTS);
  const [activeSubTab, setActiveSubTab] = useState<'inventory' | 'indents'>('inventory');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCat, setSelectedCat] = useState<string>('ALL');
  const [showIndentModal, setShowIndentModal] = useState(false);

  // New Indent form state
  const [selectedItemName, setSelectedItemName] = useState(inventory[0]?.name || '');
  const [indentQty, setIndentQty] = useState(1);

  const handleCreateIndent = (e: React.FormEvent) => {
    e.preventDefault();
    const newIndent: IndentItem = {
      id: `IND-${String(indents.length + 1).padStart(2, '0')}`,
      indentNo: `WII/STR/2026/${Math.floor(100 + Math.random() * 900)}`,
      requestedBy: currentUser.name,
      department: currentUser.department,
      itemRequested: selectedItemName,
      quantity: indentQty,
      date: new Date().toISOString().split('T')[0],
      status: 'Pending Storekeeper'
    };
    setIndents([newIndent, ...indents]);
    setShowIndentModal(false);
    setActiveSubTab('indents');
  };

  const filteredInventory = inventory.filter((item) => {
    const matchesCat = selectedCat === 'ALL' || item.category === selectedCat;
    const matchesSearch =
      item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.sku.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.location.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCat && matchesSearch;
  });

  const lowStockCount = inventory.filter((i) => i.currentStock <= i.minThreshold).length;

  return (
    <div className="space-y-6 pb-12 animate-in fade-in duration-300">
      {/* Module Header Bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-white border border-slate-200/90 rounded-2xl p-5 shadow-2xs">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-amber-600 text-white rounded-xl shadow-xs">
            <Package className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-extrabold text-slate-900 tracking-tight">
                WII-SIMS • Stock &amp; Inventory Management
              </h2>
              <span className="text-[10px] font-mono font-bold bg-amber-50 text-amber-900 border border-amber-200 px-2 py-0.5 rounded-full">
                MOD-SIMS-03
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5 font-medium">
              Central Store Catalog, Consumables Ledger, Field Gear Indents &amp; Asset Registers
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-end sm:self-auto">
          <button
            type="button"
            onClick={() => setShowIndentModal(true)}
            className="px-4 py-2 rounded-xl text-xs font-bold bg-amber-700 hover:bg-amber-800 text-white shadow-xs transition-all flex items-center gap-1.5 cursor-pointer active:scale-95"
          >
            <Plus className="w-4 h-4" />
            <span>Raise Store Indent</span>
          </button>
        </div>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="bg-white border border-slate-200/90 rounded-2xl p-4 shadow-2xs">
          <div className="text-xs font-bold text-slate-500 uppercase tracking-wider">Catalog SKUs</div>
          <div className="text-2xl font-black text-slate-900 mt-1">{inventory.length} Tracked</div>
          <div className="text-[11px] text-slate-500 font-medium mt-1">Central Stores Inventory</div>
        </div>
        <div className="bg-white border border-slate-200/90 rounded-2xl p-4 shadow-2xs">
          <div className="text-xs font-bold text-slate-500 uppercase tracking-wider">Low Stock Warnings</div>
          <div className="text-2xl font-black text-amber-700 mt-1">{lowStockCount} Items</div>
          <div className="text-[11px] text-amber-900 font-semibold mt-1">Below Minimum Threshold</div>
        </div>
        <div className="bg-white border border-slate-200/90 rounded-2xl p-4 shadow-2xs">
          <div className="text-xs font-bold text-slate-500 uppercase tracking-wider">Open Indents</div>
          <div className="text-2xl font-black text-blue-700 mt-1">{indents.filter((i) => i.status !== 'Issued').length} Pending</div>
          <div className="text-[11px] text-slate-500 font-medium mt-1">Storekeeper Requisitions</div>
        </div>
        <div className="bg-white border border-slate-200/90 rounded-2xl p-4 shadow-2xs">
          <div className="text-xs font-bold text-slate-500 uppercase tracking-wider">Audited Assets</div>
          <div className="text-2xl font-black text-emerald-700 mt-1">100% Barcoded</div>
          <div className="text-[11px] text-slate-500 font-medium mt-1">Annual Stock Verif. Complete</div>
        </div>
      </div>

      {/* Tabs Switcher: Inventory Catalog vs Store Indents */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
        <button
          onClick={() => setActiveSubTab('inventory')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-2 ${
            activeSubTab === 'inventory'
              ? 'bg-slate-900 text-white shadow-xs'
              : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          <Boxes className="w-4 h-4" />
          <span>Central Store Catalog ({inventory.length})</span>
        </button>

        <button
          onClick={() => setActiveSubTab('indents')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-2 ${
            activeSubTab === 'indents'
              ? 'bg-slate-900 text-white shadow-xs'
              : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          <ClipboardList className="w-4 h-4" />
          <span>Requisition Indents ({indents.length})</span>
        </button>
      </div>

      {activeSubTab === 'inventory' ? (
        <div className="space-y-4">
          {/* Filter Bar */}
          <div className="bg-white border border-slate-200/90 rounded-2xl p-4 shadow-2xs flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="relative w-full sm:w-80">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search SKU, item name, rack location..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg pl-9 pr-3 py-1.5 text-xs font-medium focus:bg-white focus:ring-2 focus:ring-amber-700 focus:outline-none"
              />
            </div>

            <div className="flex items-center space-x-1.5 w-full sm:w-auto justify-end">
              <span className="text-xs font-semibold text-slate-500 mr-1">Category:</span>
              {['ALL', 'Field Equipment', 'Lab Consumables', 'Camp Gear', 'Office & IT'].map((cat) => (
                <button
                  key={cat}
                  onClick={() => setSelectedCat(cat)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer border ${
                    selectedCat === cat
                      ? 'bg-slate-900 text-white border-slate-900 shadow-xs'
                      : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          {/* Catalog Table */}
          <div className="bg-white border border-slate-200/90 rounded-2xl overflow-hidden shadow-2xs">
            <div className="w-full min-w-0 overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse table-fixed">
                <thead className="bg-slate-100 text-slate-700 font-bold uppercase tracking-wider border-b border-slate-200 text-[11px]">
                  <tr className="h-10">
                    <th className="px-4 py-2.5 whitespace-nowrap align-middle w-[32%]">SKU &amp; Item Details</th>
                    <th className="px-4 py-2.5 whitespace-nowrap align-middle w-[22%]">Category</th>
                    <th className="px-4 py-2.5 whitespace-nowrap align-middle w-[20%]">Store Location</th>
                    <th className="px-4 py-2.5 text-center whitespace-nowrap align-middle w-[13%]">Current Stock</th>
                    <th className="px-4 py-2.5 text-center whitespace-nowrap align-middle w-[13%]">Stock Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredInventory.map((item) => {
                    const isLow = item.currentStock <= item.minThreshold;
                    return (
                      <tr key={item.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="px-4 py-3 align-middle">
                          <span className="font-mono font-bold text-amber-900 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded text-[10px] inline-block mb-0.5">
                            {item.sku}
                          </span>
                          <div className="font-bold text-slate-900 leading-snug">{item.name}</div>
                        </td>
                        <td className="px-4 py-3 align-middle whitespace-nowrap">
                          <span className="bg-slate-100 text-slate-700 font-semibold px-2 py-0.5 rounded-md text-[11px]">
                            {item.category}
                          </span>
                        </td>
                        <td className="px-4 py-3 align-middle whitespace-nowrap text-slate-600">
                          {item.location}
                        </td>
                        <td className="px-4 py-3 align-middle text-center whitespace-nowrap">
                          <span className="font-black text-slate-900 text-sm">{item.currentStock}</span>
                          <span className="text-slate-400 text-xs ml-1">{item.unit}</span>
                          <div className="text-[10px] text-slate-400">Min: {item.minThreshold}</div>
                        </td>
                        <td className="px-4 py-3 align-middle text-center whitespace-nowrap">
                          {isLow ? (
                            <span className="inline-flex items-center gap-1 bg-amber-50 text-amber-900 border border-amber-200 px-2.5 py-1 rounded-full text-[10px] font-bold">
                              <AlertTriangle className="w-3 h-3 text-amber-600" />
                              <span>Reorder Needed</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 bg-emerald-50 text-emerald-800 border border-emerald-200 px-2.5 py-1 rounded-full text-[10px] font-bold">
                              <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                              <span>In Stock</span>
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : (
        /* Indents Table */
        <div className="bg-white border border-slate-200/90 rounded-2xl overflow-hidden shadow-2xs">
          <div className="w-full min-w-0 overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse table-fixed">
              <thead className="bg-slate-100 text-slate-700 font-bold uppercase tracking-wider border-b border-slate-200 text-[11px]">
                <tr className="h-10">
                  <th className="px-4 py-2.5 whitespace-nowrap align-middle w-[18%]">Indent No.</th>
                  <th className="px-4 py-2.5 whitespace-nowrap align-middle w-[28%]">Requested By</th>
                  <th className="px-4 py-2.5 whitespace-nowrap align-middle w-[28%]">Item &amp; Quantity</th>
                  <th className="px-4 py-2.5 whitespace-nowrap align-middle w-[14%]">Date</th>
                  <th className="px-4 py-2.5 text-center whitespace-nowrap align-middle w-[12%]">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {indents.map((ind) => (
                  <tr key={ind.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="px-4 py-3 font-mono font-bold text-slate-900">{ind.indentNo}</td>
                    <td className="px-4 py-3">
                      <div className="font-bold text-slate-800">{ind.requestedBy}</div>
                      <div className="text-[11px] text-slate-500">{ind.department}</div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-semibold text-slate-900">{ind.itemRequested}</div>
                      <div className="text-[11px] text-amber-800 font-bold">Qty: {ind.quantity} Units</div>
                    </td>
                    <td className="px-4 py-3 font-mono text-slate-600">{ind.date}</td>
                    <td className="px-4 py-3 text-center">
                      <span className="inline-flex items-center gap-1 bg-blue-50 text-blue-800 border border-blue-200 px-2.5 py-1 rounded-full text-[10px] font-bold">
                        {ind.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Raise Indent Modal */}
      {showIndentModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl max-w-md w-full border border-slate-200 shadow-xl overflow-hidden">
            <div className="p-4 bg-amber-900 text-white flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Package className="w-5 h-5 text-amber-300" />
                <h3 className="font-bold text-sm">Submit Store Requisition Indent</h3>
              </div>
              <button
                onClick={() => setShowIndentModal(false)}
                className="text-white/80 hover:text-white cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateIndent} className="p-5 space-y-4 text-xs">
              <div>
                <label className="font-bold text-slate-700 block mb-1">Select Item from Catalog</label>
                <select
                  value={selectedItemName}
                  onChange={(e) => setSelectedItemName(e.target.value)}
                  className="w-full border border-slate-200 rounded-lg p-2 text-xs focus:ring-2 focus:ring-amber-600 focus:outline-none"
                >
                  {inventory.map((item) => (
                    <option key={item.id} value={item.name}>
                      {item.name} ({item.currentStock} {item.unit} available)
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Requested Quantity</label>
                <input
                  type="number"
                  min={1}
                  required
                  value={indentQty}
                  onChange={(e) => setIndentQty(Number(e.target.value))}
                  className="w-full border border-slate-200 rounded-lg p-2 text-xs focus:ring-2 focus:ring-amber-600 focus:outline-none"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Purpose / Project Reference</label>
                <textarea
                  rows={2}
                  placeholder="e.g. Field sampling expedition in Corbett Tiger Reserve..."
                  className="w-full border border-slate-200 rounded-lg p-2 text-xs focus:ring-2 focus:ring-amber-600 focus:outline-none"
                />
              </div>

              <div className="pt-3 border-t border-slate-200 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowIndentModal(false)}
                  className="px-4 py-2 border border-slate-200 rounded-lg text-slate-700 font-bold hover:bg-slate-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-amber-700 hover:bg-amber-800 text-white rounded-lg font-bold shadow-xs cursor-pointer"
                >
                  Submit Indent
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export const InventoryView = SIMSView;

