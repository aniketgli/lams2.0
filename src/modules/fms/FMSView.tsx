import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import {
  Building2,
  Car,
  Hotel,
  Plus,
  Search,
  CheckCircle2,
  Clock,
  Calendar,
  Wrench,
  ChevronRight,
  ShieldCheck
} from 'lucide-react';

interface FMSViewProps {
  onReturnToLobby: () => void;
}

interface FacilityBooking {
  id: string;
  bookingRef: string;
  facilityType: 'Guest House' | 'Fleet Vehicle' | 'Auditorium / Lab';
  facilityName: string;
  bookedBy: string;
  department: string;
  startDate: string;
  endDate: string;
  status: 'Confirmed' | 'Pending Sanction' | 'Completed';
}

const INITIAL_BOOKINGS: FacilityBooking[] = [
  {
    id: 'BKG-01',
    bookingRef: 'GH-2026-042',
    facilityType: 'Guest House',
    facilityName: 'VIP Suite 102 (Main Campus)',
    bookedBy: 'Dr. Dhananjai Mohan',
    department: 'Directorate',
    startDate: '2026-09-06',
    endDate: '2026-09-08',
    status: 'Confirmed'
  },
  {
    id: 'BKG-02',
    bookingRef: 'VEH-2026-118',
    facilityType: 'Fleet Vehicle',
    facilityName: 'Mahindra Scorpio 4WD (UK-07-TA-4921)',
    bookedBy: 'Dr. B.S. Adhikari',
    department: 'Habitat Ecology',
    startDate: '2026-09-05',
    endDate: '2026-09-12',
    status: 'Confirmed'
  },
  {
    id: 'BKG-03',
    bookingRef: 'AUD-2026-019',
    facilityType: 'Auditorium / Lab',
    facilityName: 'Auditorium & GIS Workstation Cluster',
    bookedBy: 'Dr. Gautam Talukdar',
    department: 'GIS & Remote Sensing',
    startDate: '2026-09-10',
    endDate: '2026-09-10',
    status: 'Pending Sanction'
  }
];

export const FMSView: React.FC<FMSViewProps> = ({ onReturnToLobby }) => {
  const { currentUser } = useApp();
  const [bookings, setBookings] = useState<FacilityBooking[]>(INITIAL_BOOKINGS);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedType, setSelectedType] = useState<string>('ALL');
  const [showModal, setShowModal] = useState(false);

  // New booking form state
  const [facilityType, setFacilityType] = useState<'Guest House' | 'Fleet Vehicle' | 'Auditorium / Lab'>('Guest House');
  const [facilityName, setFacilityName] = useState('VIP Suite 104');
  const [fromDate, setFromDate] = useState('2026-09-15');
  const [toDate, setToDate] = useState('2026-09-18');

  const handleCreateBooking = (e: React.FormEvent) => {
    e.preventDefault();
    const newBooking: FacilityBooking = {
      id: `BKG-${String(bookings.length + 1).padStart(2, '0')}`,
      bookingRef: `${facilityType === 'Guest House' ? 'GH' : facilityType === 'Fleet Vehicle' ? 'VEH' : 'AUD'}-2026-${Math.floor(100 + Math.random() * 900)}`,
      facilityType,
      facilityName,
      bookedBy: currentUser.name,
      department: currentUser.department,
      startDate: fromDate,
      endDate: toDate,
      status: 'Pending Sanction'
    };
    setBookings([newBooking, ...bookings]);
    setShowModal(false);
  };

  const filteredBookings = bookings.filter((b) => {
    const matchesType = selectedType === 'ALL' || b.facilityType === selectedType;
    const matchesSearch =
      b.facilityName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      b.bookedBy.toLowerCase().includes(searchQuery.toLowerCase()) ||
      b.bookingRef.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesType && matchesSearch;
  });

  return (
    <div className="space-y-6 pb-12 animate-in fade-in duration-300">
      {/* Module Header Bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-white border border-slate-200/90 rounded-2xl p-5 shadow-2xs">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-purple-600 text-white rounded-xl shadow-xs">
            <Building2 className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-extrabold text-slate-900 tracking-tight">
                WII-FMS • Facility &amp; Campus Management
              </h2>
              <span className="text-[10px] font-mono font-bold bg-purple-50 text-purple-900 border border-purple-200 px-2 py-0.5 rounded-full">
                MOD-FMS-04
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5 font-medium">
              Guest House Suites, Field Tour Vehicles, Conference Halls &amp; Estate Infrastructure
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-end sm:self-auto">
          <button
            type="button"
            onClick={() => setShowModal(true)}
            className="px-4 py-2 rounded-xl text-xs font-bold bg-purple-700 hover:bg-purple-800 text-white shadow-xs transition-all flex items-center gap-1.5 cursor-pointer active:scale-95"
          >
            <Plus className="w-4 h-4" />
            <span>Book Facility / Vehicle</span>
          </button>
        </div>
      </div>

      {/* Overview Cards matching Attendance theme */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* 1. Guest House */}
        <div className="bg-purple-50/70 border border-purple-200/90 rounded-xl p-3 sm:p-3.5 shadow-2xs flex flex-col justify-between min-h-[92px]">
          <div className="flex items-start justify-between gap-1.5">
            <div className="min-w-0">
              <p className="text-[11px] font-bold uppercase tracking-wider text-purple-800 truncate">Guest House</p>
              <p className="text-xl sm:text-2xl font-black text-purple-900 mt-0.5">28 Suites</p>
            </div>
            <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-purple-100 border border-purple-300/80 flex items-center justify-center shrink-0 -mt-0.5 -mr-0.5 shadow-2xs">
              <Hotel className="w-4 h-4 text-purple-700" />
            </div>
          </div>
          <div className="mt-1.5 pt-1.5 border-t border-purple-200/60 text-[10px] sm:text-[11px] font-semibold text-purple-700 whitespace-nowrap overflow-hidden text-ellipsis">
            19 Available for Booking
          </div>
        </div>

        {/* 2. Fleet Vehicles */}
        <div className="bg-blue-50/70 border border-blue-200/90 rounded-xl p-3 sm:p-3.5 shadow-2xs flex flex-col justify-between min-h-[92px]">
          <div className="flex items-start justify-between gap-1.5">
            <div className="min-w-0">
              <p className="text-[11px] font-bold uppercase tracking-wider text-blue-800 truncate">Fleet Vehicles</p>
              <p className="text-xl sm:text-2xl font-black text-blue-900 mt-0.5">14 Vehicles</p>
            </div>
            <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-blue-100 border border-blue-300/80 flex items-center justify-center shrink-0 -mt-0.5 -mr-0.5 shadow-2xs">
              <Car className="w-4 h-4 text-blue-700" />
            </div>
          </div>
          <div className="mt-1.5 pt-1.5 border-t border-blue-200/60 text-[10px] sm:text-[11px] font-semibold text-blue-700 whitespace-nowrap overflow-hidden text-ellipsis">
            8 on Field Expedition
          </div>
        </div>

        {/* 3. Auditoriums */}
        <div className="bg-amber-50/70 border border-amber-200/90 rounded-xl p-3 sm:p-3.5 shadow-2xs flex flex-col justify-between min-h-[92px]">
          <div className="flex items-start justify-between gap-1.5">
            <div className="min-w-0">
              <p className="text-[11px] font-bold uppercase tracking-wider text-amber-800 truncate">Auditoriums</p>
              <p className="text-xl sm:text-2xl font-black text-amber-900 mt-0.5">3 Venues</p>
            </div>
            <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-amber-100 border border-amber-300/80 flex items-center justify-center shrink-0 -mt-0.5 -mr-0.5 shadow-2xs">
              <Calendar className="w-4 h-4 text-amber-700" />
            </div>
          </div>
          <div className="mt-1.5 pt-1.5 border-t border-amber-200/60 text-[10px] sm:text-[11px] font-semibold text-amber-700 whitespace-nowrap overflow-hidden text-ellipsis">
            Seminar &amp; Board Rooms
          </div>
        </div>

        {/* 4. Estate Tickets */}
        <div className="bg-emerald-50/70 border border-emerald-200/90 rounded-xl p-3 sm:p-3.5 shadow-2xs flex flex-col justify-between min-h-[92px]">
          <div className="flex items-start justify-between gap-1.5">
            <div className="min-w-0">
              <p className="text-[11px] font-bold uppercase tracking-wider text-emerald-800 truncate">Estate Tickets</p>
              <p className="text-xl sm:text-2xl font-black text-emerald-900 mt-0.5">98% Resolved</p>
            </div>
            <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-emerald-100 border border-emerald-300/80 flex items-center justify-center shrink-0 -mt-0.5 -mr-0.5 shadow-2xs">
              <Wrench className="w-4 h-4 text-emerald-700" />
            </div>
          </div>
          <div className="mt-1.5 pt-1.5 border-t border-emerald-200/60 text-[10px] sm:text-[11px] font-semibold text-emerald-700 whitespace-nowrap overflow-hidden text-ellipsis">
            Civil &amp; Electrical Maintenance
          </div>
        </div>
      </div>

      {/* Search & Filter Bar */}
      <div className="bg-white border border-slate-200/90 rounded-2xl p-4 shadow-2xs flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative w-full sm:w-80">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search booking ref, facility name, user..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-slate-50 border border-slate-200 rounded-lg pl-9 pr-3 py-1.5 text-xs font-medium focus:bg-white focus:ring-2 focus:ring-purple-700 focus:outline-none"
          />
        </div>

        <div className="flex items-center space-x-1.5 w-full sm:w-auto justify-end">
          <span className="text-xs font-semibold text-slate-500 mr-1">Type:</span>
          {['ALL', 'Guest House', 'Fleet Vehicle', 'Auditorium / Lab'].map((t) => (
            <button
              key={t}
              onClick={() => setSelectedType(t)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer border ${
                selectedType === t
                  ? 'bg-slate-900 text-white border-slate-900 shadow-xs'
                  : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
              }`}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      {/* Bookings Table */}
      <div className="bg-white border border-slate-200/90 rounded-2xl overflow-hidden shadow-2xs">
        <div className="w-full min-w-0 overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse table-fixed">
            <thead className="bg-slate-100 text-slate-700 font-bold uppercase tracking-wider border-b border-slate-200 text-[11px]">
              <tr className="h-10">
                <th className="px-4 py-2.5 whitespace-nowrap align-middle w-[18%]">Booking Ref</th>
                <th className="px-4 py-2.5 whitespace-nowrap align-middle w-[32%]">Facility / Vehicle</th>
                <th className="px-4 py-2.5 whitespace-nowrap align-middle w-[24%]">Booked By</th>
                <th className="px-4 py-2.5 whitespace-nowrap align-middle w-[14%]">Duration</th>
                <th className="px-4 py-2.5 text-center whitespace-nowrap align-middle w-[12%]">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredBookings.map((b) => (
                <tr key={b.id} className="hover:bg-slate-50/80 transition-colors">
                  <td className="px-4 py-3 font-mono font-bold text-slate-800 align-middle">
                    {b.bookingRef}
                  </td>
                  <td className="px-4 py-3 align-middle">
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-50 text-purple-800 border border-purple-200 inline-block mb-0.5">
                      {b.facilityType}
                    </span>
                    <div className="font-bold text-slate-900 leading-snug truncate">{b.facilityName}</div>
                  </td>
                  <td className="px-4 py-3 align-middle">
                    <div className="font-bold text-slate-800 truncate">{b.bookedBy}</div>
                    <div className="text-[11px] text-slate-500 truncate">{b.department}</div>
                  </td>
                  <td className="px-4 py-3 font-mono text-slate-700 align-middle whitespace-nowrap">
                    <div>{b.startDate} to {b.endDate}</div>
                  </td>
                  <td className="px-4 py-3 text-center align-middle whitespace-nowrap">
                    <span
                      className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold ${
                        b.status === 'Confirmed'
                          ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                          : 'bg-amber-50 text-amber-900 border border-amber-200'
                      }`}
                    >
                      {b.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Reservation Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl max-w-md w-full border border-slate-200 shadow-xl overflow-hidden">
            <div className="p-4 bg-purple-900 text-white flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Building2 className="w-5 h-5 text-purple-300" />
                <h3 className="font-bold text-sm">New Campus Facility Requisition</h3>
              </div>
              <button onClick={() => setShowModal(false)} className="text-white/80 hover:text-white cursor-pointer">
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateBooking} className="p-5 space-y-4 text-xs">
              <div>
                <label className="font-bold text-slate-700 block mb-1">Facility Category</label>
                <select
                  value={facilityType}
                  onChange={(e) => setFacilityType(e.target.value as any)}
                  className="w-full border border-slate-200 rounded-lg p-2 text-xs focus:ring-2 focus:ring-purple-600 focus:outline-none"
                >
                  <option value="Guest House">Guest House Suites &amp; Hostels</option>
                  <option value="Fleet Vehicle">Official Fleet 4WD Vehicles</option>
                  <option value="Auditorium / Lab">Auditorium &amp; Seminar Hall</option>
                </select>
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Select Resource</label>
                <input
                  type="text"
                  required
                  value={facilityName}
                  onChange={(e) => setFacilityName(e.target.value)}
                  className="w-full border border-slate-200 rounded-lg p-2 text-xs focus:ring-2 focus:ring-purple-600 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">From Date</label>
                  <input
                    type="date"
                    required
                    value={fromDate}
                    onChange={(e) => setFromDate(e.target.value)}
                    className="w-full border border-slate-200 rounded-lg p-2 text-xs focus:ring-2 focus:ring-purple-600 focus:outline-none font-mono"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-700 block mb-1">To Date</label>
                  <input
                    type="date"
                    required
                    value={toDate}
                    onChange={(e) => setToDate(e.target.value)}
                    className="w-full border border-slate-200 rounded-lg p-2 text-xs focus:ring-2 focus:ring-purple-600 focus:outline-none font-mono"
                  />
                </div>
              </div>

              <div className="pt-3 border-t border-slate-200 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 border border-slate-200 rounded-lg text-slate-700 font-bold hover:bg-slate-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-purple-700 hover:bg-purple-800 text-white rounded-lg font-bold shadow-xs cursor-pointer"
                >
                  Submit Requisition
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
