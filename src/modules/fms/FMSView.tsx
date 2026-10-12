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
  Building2,
  Car,
  Hotel,
  Plus,
  Search,
  Calendar,
  Wrench,
  Download
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

  // Pagination states
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // New booking form state
  const [facilityType, setFacilityType] = useState<'Guest House' | 'Fleet Vehicle' | 'Auditorium / Lab'>('Guest House');
  const [facilityName, setFacilityName] = useState('VIP Suite 104');
  const [fromDate, setFromDate] = useState('2026-09-15');
  const [toDate, setToDate] = useState('2026-09-18');
  const [formError, setFormError] = useState('');

  const handleCreateBooking = (e: React.FormEvent) => {
    e.preventDefault();
    if (!facilityName.trim()) {
      setFormError('Please enter facility name or select vehicle.');
      return;
    }

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
    setFormError('');
  };

  const handleExportCSV = () => {
    const headers = ['Booking Ref', 'Facility Type', 'Facility Name', 'Booked By', 'Department', 'Start Date', 'End Date', 'Status'];
    const rows = filteredBookings.map((b) => [
      `"${b.bookingRef}"`,
      `"${b.facilityType}"`,
      `"${b.facilityName.replace(/"/g, '""')}"`,
      `"${b.bookedBy}"`,
      `"${b.department}"`,
      b.startDate,
      b.endDate,
      `"${b.status}"`
    ]);
    const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `WII_Facility_Bookings_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const filteredBookings = bookings.filter((b) => {
    const matchesType = selectedType === 'ALL' || b.facilityType === selectedType;
    const matchesSearch =
      b.facilityName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      b.bookedBy.toLowerCase().includes(searchQuery.toLowerCase()) ||
      b.bookingRef.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesType && matchesSearch;
  });

  const paginatedBookings = filteredBookings.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  );

  return (
    <div className="space-y-6 pb-12 animate-in fade-in duration-300">
      {/* Standardized Module PageHeader */}
      <PageHeader
        icon={Building2}
        title="Facility & Campus Management (FMS)"
        subtitle="Guest house suites, field expedition fleet vehicles, conference halls & campus infrastructure."
        breadcrumbs={[
          { label: 'Portal Hub', onClick: onReturnToLobby },
          { label: 'Facility Management' }
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
                setShowModal(true);
              }}
            >
              Book Facility
            </Button>
          </div>
        }
      />

      {/* Metrics Row using Standardized MetricCard */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <MetricCard
          title="Guest House"
          value="28 Suites"
          subtitle="19 Available for Booking"
          icon={Hotel}
          variant="primary"
        />
        <MetricCard
          title="Fleet Vehicles"
          value="14 Vehicles"
          subtitle="8 on Field Expeditions"
          icon={Car}
          variant="info"
        />
        <MetricCard
          title="Auditoriums & Halls"
          value="3 Venues"
          subtitle="Seminar & Board Rooms"
          icon={Calendar}
          variant="warning"
        />
        <MetricCard
          title="Estate Tickets"
          value="98% Resolved"
          subtitle="Civil & Electrical Works"
          icon={Wrench}
          variant="success"
        />
      </div>

      {/* Search & Filter Bar */}
      <div className="bg-white border border-slate-200/90 rounded-xl p-4 shadow-2xs flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="w-full sm:w-80">
          <Input
            placeholder="Search booking ref, facility name, user..."
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setCurrentPage(1);
            }}
            leftIcon={Search}
            size="sm"
          />
        </div>

        <div className="flex items-center space-x-1.5 w-full sm:w-auto justify-end overflow-x-auto">
          <span className="text-xs font-semibold text-slate-500 mr-1 shrink-0">Type:</span>
          {['ALL', 'Guest House', 'Fleet Vehicle', 'Auditorium / Lab'].map((t) => (
            <Button
              key={t}
              size="xs"
              variant={selectedType === t ? 'primary' : 'outline'}
              onClick={() => {
                setSelectedType(t);
                setCurrentPage(1);
              }}
            >
              {t}
            </Button>
          ))}
        </div>
      </div>

      {/* Standardized Bookings Table */}
      <div className="bg-white border border-slate-200/90 rounded-xl overflow-hidden shadow-2xs">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[18%]">Booking Ref</TableHead>
              <TableHead className="w-[32%]">Facility / Vehicle Details</TableHead>
              <TableHead className="w-[24%]">Booked By &amp; Department</TableHead>
              <TableHead className="w-[14%]">Schedule</TableHead>
              <TableHead align="center" className="w-[12%]">Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginatedBookings.length === 0 ? (
              <TableEmpty colSpan={5} message="No facility bookings found matching search criteria." />
            ) : (
              paginatedBookings.map((b) => (
                <TableRow key={b.id}>
                  <TableCell className="align-middle font-mono font-bold text-slate-800 text-xs">
                    {b.bookingRef}
                  </TableCell>
                  <TableCell className="align-middle">
                    <Badge variant="neutral" size="sm" className="mb-1">
                      {b.facilityType}
                    </Badge>
                    <div className="font-bold text-slate-900 leading-snug">{b.facilityName}</div>
                  </TableCell>
                  <TableCell className="align-middle">
                    <div className="font-bold text-slate-800">{b.bookedBy}</div>
                    <div className="text-[11px] text-slate-500">{b.department}</div>
                  </TableCell>
                  <TableCell className="align-middle font-mono text-slate-700 text-xs whitespace-nowrap">
                    <div>{b.startDate}</div>
                    <div className="text-[10px] text-slate-400">to {b.endDate}</div>
                  </TableCell>
                  <TableCell align="center" className="align-middle whitespace-nowrap">
                    {b.status === 'Confirmed' ? (
                      <Badge variant="success">Confirmed</Badge>
                    ) : b.status === 'Completed' ? (
                      <Badge variant="neutral">Completed</Badge>
                    ) : (
                      <Badge variant="warning">Pending Sanction</Badge>
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>

        {filteredBookings.length > pageSize && (
          <div className="border-t border-slate-100">
            <TablePagination
              currentPage={currentPage}
              totalPages={Math.ceil(filteredBookings.length / pageSize)}
              totalItems={filteredBookings.length}
              pageSize={pageSize}
              onPageChange={setCurrentPage}
              onPageSizeChange={(newSize) => {
                setPageSize(newSize);
                setCurrentPage(1);
              }}
            />
          </div>
        )}
      </div>

      {/* Standardized Book Facility Modal */}
      <Modal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        size="md"
      >
        <ModalHeader
          title="Book Campus Facility or Vehicle"
          subtitle="Submit requisition for official guest house suites, fleet vehicles, or seminar venues."
          icon={Building2}
          onClose={() => setShowModal(false)}
        />
        <form onSubmit={handleCreateBooking}>
          <ModalBody className="space-y-4">
            {formError && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs font-semibold text-red-800">
                {formError}
              </div>
            )}

            <FormField label="Facility Type" required>
              <Select
                value={facilityType}
                onChange={(val) => {
                  const t = String(val) as 'Guest House' | 'Fleet Vehicle' | 'Auditorium / Lab';
                  setFacilityType(t);
                  if (t === 'Guest House') setFacilityName('VIP Suite 104 (Main Campus)');
                  else if (t === 'Fleet Vehicle') setFacilityName('Mahindra Bolero 4WD (UK-07-TA-1842)');
                  else setFacilityName('Main Seminar Auditorium (Capacity 250)');
                }}
                options={[
                  { value: 'Guest House', label: 'Guest House Suite' },
                  { value: 'Fleet Vehicle', label: 'Fleet Vehicle (4WD / Innova)' },
                  { value: 'Auditorium / Lab', label: 'Auditorium / Conference Hall' }
                ]}
              />
            </FormField>

            <FormField label="Facility / Vehicle Details" required>
              <Input
                value={facilityName}
                onChange={(e) => setFacilityName(e.target.value)}
                placeholder="e.g. VIP Suite 104 or Vehicle Reg No."
                required
              />
            </FormField>

            <div className="grid grid-cols-2 gap-4">
              <FormField label="From Date" required>
                <Input
                  type="date"
                  value={fromDate}
                  onChange={(e) => setFromDate(e.target.value)}
                  required
                />
              </FormField>

              <FormField label="To Date" required>
                <Input
                  type="date"
                  value={toDate}
                  onChange={(e) => setToDate(e.target.value)}
                  required
                />
              </FormField>
            </div>
          </ModalBody>
          <ModalFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setShowModal(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
            >
              Submit Booking
            </Button>
          </ModalFooter>
        </form>
      </Modal>
    </div>
  );
};
