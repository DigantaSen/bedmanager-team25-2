import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useSelector } from 'react-redux';
import { Wrench } from 'lucide-react';
import { selectCurrentUser } from '@/features/auth/authSlice';
import DashboardLayout from '@/components/DashboardLayout';
import UserApprovalsPanel from '@/components/admin/UserApprovalsPanel';
import HospitalDirectoryPanel from '@/components/admin/HospitalDirectoryPanel';
import api from '@/services/api';

// Wards in the hospital's usual order; any other ward follows alphabetically
const WARD_ORDER = ['ICU', 'General', 'Emergency'];

const TABS = [
  { id: 'beds', label: 'Bed Inventory' },
  { id: 'approvals', label: 'Approvals' },
  { id: 'hospitals', label: 'Hospitals' }
];

const INPUT_CLASS = 'h-10 px-3 rounded-md bg-neutral-950 border border-neutral-700 text-white disabled:opacity-50';
const PRIMARY_BUTTON = 'px-4 py-2 rounded-md bg-blue-600 text-white font-semibold hover:bg-blue-500 disabled:opacity-50 transition-colors';
const SECONDARY_BUTTON = 'px-4 py-2 rounded-md bg-neutral-800 text-neutral-200 hover:bg-neutral-700 disabled:opacity-50 transition-colors';

// Same status colours as the manager's bed grid
const STATUS_STYLES = {
  available: 'bg-green-500/20 border-green-500 text-green-400 hover:bg-green-500/30 cursor-pointer',
  occupied: 'bg-red-500/20 border-red-500 text-red-400 cursor-default opacity-75',
  cleaning: 'bg-orange-500/20 border-orange-500 text-orange-400 cursor-default opacity-75'
};

const tabClass = (isActive) => `flex-1 px-6 py-3 rounded-md font-semibold transition-colors ${isActive
  ? 'bg-blue-600 text-white'
  : 'text-neutral-400 hover:text-white hover:bg-neutral-800'
  }`;

const wardRank = (ward) => (WARD_ORDER.includes(ward) ? WARD_ORDER.indexOf(ward) : WARD_ORDER.length);
const byNaturalOrder = (a, b) => String(a).localeCompare(String(b), undefined, { numeric: true });

// Beds grouped by bed ID prefix (e.g. "iA" in "iA5"), as in the other dashboards' bed grids
const groupByPrefix = (beds) => {
  const groups = new Map();
  [...beds].sort((a, b) => byNaturalOrder(a.bedId, b.bedId)).forEach((bed) => {
    const match = /^(.*?)-?(\d+)$/.exec(bed.bedId);
    const prefix = match && match[1] ? match[1] : 'Other';
    if (!groups.has(prefix)) groups.set(prefix, []);
    groups.get(prefix).push(bed);
  });
  return [...groups.entries()].sort(([a], [b]) => byNaturalOrder(a, b));
};

const getApiError = (error, fallback) =>
  error.response?.data?.errors?.[0]?.message || error.response?.data?.message || fallback;

/**
 * Bed inventory: add beds, change a bed's ID or ward, retire and reactivate beds.
 * Patient details are not shown (the API leaves them out for the technical team).
 */
const BedInventoryPanel = ({ canManage }) => {
  const [beds, setBeds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [wardFilter, setWardFilter] = useState('ALL');
  const [selectedId, setSelectedId] = useState(null);
  const [editForm, setEditForm] = useState({ bedId: '', ward: '' });
  const [newBed, setNewBed] = useState({ bedId: '', ward: WARD_ORDER[0] });
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState(null);
  const [actionError, setActionError] = useState(null);

  const fetchBeds = useCallback(async () => {
    try {
      const response = await api.get('/beds', { params: { includeRetired: true } });
      setBeds(response.data?.data?.beds || []);
      setLoadError(null);
    } catch (error) {
      console.error('Error fetching beds:', error);
      setLoadError(getApiError(error, 'Could not load beds from the server'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchBeds();
  }, [fetchBeds]);

  const activeBeds = useMemo(() => beds.filter((bed) => !bed.retiredAt), [beds]);
  const retiredBeds = useMemo(() => beds.filter((bed) => bed.retiredAt).sort((a, b) => byNaturalOrder(a.bedId, b.bedId)), [beds]);
  const wards = useMemo(() => [...new Set(activeBeds.map((bed) => bed.ward))].sort((a, b) => wardRank(a) - wardRank(b) || a.localeCompare(b)), [activeBeds]);
  const visibleBeds = wardFilter === 'ALL' ? activeBeds : activeBeds.filter((bed) => bed.ward === wardFilter);
  const selectedBed = activeBeds.find((bed) => bed._id === selectedId && bed.status === 'available') || null;

  const stats = {
    total: visibleBeds.length,
    available: visibleBeds.filter((bed) => bed.status === 'available').length,
    cleaning: visibleBeds.filter((bed) => bed.status === 'cleaning').length,
    occupied: visibleBeds.filter((bed) => bed.status === 'occupied').length
  };

  // Only available beds can be changed; occupied beds and beds being cleaned cannot
  const handleBedClick = (bed) => {
    if (!canManage || bed.status !== 'available') return;
    if (bed._id === selectedId) {
      setSelectedId(null);
      return;
    }
    setSelectedId(bed._id);
    setEditForm({ bedId: bed.bedId, ward: bed.ward });
    setMessage(null);
    setActionError(null);
  };

  // Runs an inventory request, reports the outcome and reloads the beds
  const runAction = async (request, fallbackError) => {
    setBusy(true);
    setMessage(null);
    setActionError(null);
    try {
      const response = await request();
      setMessage(response.data.message);
      await fetchBeds();
      return true;
    } catch (error) {
      setActionError(getApiError(error, fallbackError));
      return false;
    } finally {
      setBusy(false);
    }
  };

  const handleAddBed = async (e) => {
    e.preventDefault();
    const bedId = newBed.bedId.trim();
    if (!bedId) {
      setActionError('Enter a bed ID');
      return;
    }
    const added = await runAction(() => api.post('/beds', { bedId, ward: newBed.ward }), 'Failed to add bed');
    if (added) setNewBed((prev) => ({ ...prev, bedId: '' }));
  };

  const handleSaveDetails = async (e) => {
    e.preventDefault();
    const changes = {};
    if (editForm.bedId.trim() !== selectedBed.bedId) changes.bedId = editForm.bedId.trim();
    if (editForm.ward !== selectedBed.ward) changes.ward = editForm.ward;
    if (Object.keys(changes).length === 0) {
      setActionError('Nothing to change');
      return;
    }
    await runAction(() => api.patch(`/beds/${selectedBed._id}`, changes), 'Failed to update bed');
  };

  const handleRetire = async () => {
    if (!window.confirm(`Retire bed ${selectedBed.bedId}? It will be hidden from bed maps and counts; its history stays in reports.`)) return;
    const retired = await runAction(() => api.patch(`/beds/${selectedBed._id}/retire`), 'Failed to retire bed');
    if (retired) setSelectedId(null);
  };

  const handleReactivate = (bed) => runAction(() => api.patch(`/beds/${bed._id}/reactivate`), 'Failed to reactivate bed');

  if (loading) {
    return <p className="text-zinc-400">Loading beds...</p>;
  }

  return (
    <div className="space-y-6">
      {loadError && (
        <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 flex items-center justify-between gap-3">
          <p className="text-sm text-red-400">{loadError}</p>
          <button onClick={fetchBeds} className={SECONDARY_BUTTON}>Try again</button>
        </div>
      )}
      {message && (
        <div className="p-3 rounded-lg bg-green-500/10 border border-green-500/20">
          <p className="text-sm text-green-400">{message}</p>
        </div>
      )}
      {actionError && (
        <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20">
          <p className="text-sm text-red-400">{actionError}</p>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <div className="bg-neutral-900 border border-neutral-700 rounded-lg p-4">
          <div className="text-neutral-400 text-sm mb-1">Total Beds</div>
          <div className="text-2xl font-bold text-white">{stats.total}</div>
        </div>
        <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-4">
          <div className="text-green-400 text-sm mb-1">Available</div>
          <div className="text-2xl font-bold text-green-400">{stats.available}</div>
        </div>
        <div className="bg-orange-500/10 border border-orange-500/30 rounded-lg p-4">
          <div className="text-orange-400 text-sm mb-1">Being Cleaned</div>
          <div className="text-2xl font-bold text-orange-400">{stats.cleaning}</div>
        </div>
        <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4">
          <div className="text-red-400 text-sm mb-1">Occupied</div>
          <div className="text-2xl font-bold text-red-400">{stats.occupied}</div>
        </div>
        <div className="bg-neutral-900 border border-neutral-700 rounded-lg p-4">
          <div className="text-neutral-400 text-sm mb-1">Retired</div>
          <div className="text-2xl font-bold text-white">{retiredBeds.length}</div>
        </div>
      </div>

      {/* Ward filter */}
      <div className="bg-neutral-900 border border-neutral-700 rounded-lg p-1 flex gap-1">
        {['ALL', ...wards].map((ward) => (
          <button key={ward} onClick={() => setWardFilter(ward)} className={tabClass(wardFilter === ward)}>
            {ward === 'ALL' ? 'All Wards' : ward}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Bed grid */}
        <div className={`${canManage ? 'lg:col-span-2' : 'lg:col-span-3'} bg-neutral-900 border border-neutral-700 rounded-lg p-6`}>
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
            <h2 className="text-2xl font-bold text-white">Beds</h2>
            <div className="flex items-center gap-4 text-sm text-neutral-400">
              <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-green-500" />Available</span>
              <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-orange-500" />Cleaning</span>
              <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-red-500" />Occupied</span>
            </div>
          </div>

          {canManage && (
            <div className="mb-4 p-3 bg-neutral-900 border border-neutral-700 rounded-lg">
              <p className="text-sm text-neutral-400">
                ℹ️ <span className="font-semibold">Tip:</span> Select an <span className="text-green-400 font-semibold">available</span> bed
                to change or retire it. Occupied beds and beds being cleaned cannot be changed.
              </p>
            </div>
          )}

          {visibleBeds.length === 0 ? (
            <p className="text-zinc-400">No beds in service{wardFilter === 'ALL' ? '' : ` in ${wardFilter}`}.</p>
          ) : (
            <div className="space-y-6 max-h-[700px] overflow-y-auto pr-1">
              {(wardFilter === 'ALL' ? wards : [wardFilter]).map((ward) => (
                <div key={ward} className="space-y-4">
                  {wardFilter === 'ALL' && <h3 className="text-xl font-bold text-white">{ward}</h3>}
                  {groupByPrefix(visibleBeds.filter((bed) => bed.ward === ward)).map(([prefix, groupBeds]) => (
                    <div key={`${ward}-${prefix}`} className="space-y-3">
                      <div className="flex items-center gap-3">
                        <h4 className="text-lg font-semibold text-cyan-400">{prefix} Beds</h4>
                        <div className="flex-1 h-px bg-gradient-to-r from-cyan-500/50 to-transparent" />
                      </div>
                      <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-3">
                        {groupBeds.map((bed) => (
                          <button
                            key={bed._id}
                            onClick={() => handleBedClick(bed)}
                            className={`border-2 rounded-lg p-3 text-center transition-all min-h-[72px] ${STATUS_STYLES[bed.status] || ''} ${bed._id === selectedId ? 'ring-2 ring-blue-500 ring-offset-2 ring-offset-neutral-900' : ''}`}
                            aria-label={`Bed ${bed.bedId}, ${bed.status}`}
                          >
                            <div className="font-bold text-lg">{bed.bedId}</div>
                            <div className="text-xs mt-1 capitalize">{bed.status}</div>
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Side panels */}
        {canManage && (
          <div className="space-y-6">
            <div className="bg-neutral-900 border border-neutral-700 rounded-lg p-6">
              <h2 className="text-xl font-bold text-white mb-4">Selected Bed</h2>
              {selectedBed ? (
                <form onSubmit={handleSaveDetails} className="space-y-3">
                  <p className="text-sm text-zinc-400">
                    <span className="text-white font-semibold">{selectedBed.bedId}</span> · {selectedBed.ward} ·{' '}
                    <span className="text-green-400">available</span>
                  </p>
                  <label className="flex flex-col gap-1 text-sm text-zinc-400">
                    Bed ID
                    <input
                      value={editForm.bedId}
                      onChange={(e) => setEditForm((prev) => ({ ...prev, bedId: e.target.value }))}
                      disabled={busy}
                      className={INPUT_CLASS}
                    />
                  </label>
                  <label className="flex flex-col gap-1 text-sm text-zinc-400">
                    Ward
                    <select
                      value={editForm.ward}
                      onChange={(e) => setEditForm((prev) => ({ ...prev, ward: e.target.value }))}
                      disabled={busy}
                      className={INPUT_CLASS}
                    >
                      {WARD_ORDER.map((ward) => <option key={ward} value={ward}>{ward}</option>)}
                    </select>
                  </label>
                  <div className="flex flex-wrap gap-2">
                    <button type="submit" disabled={busy} className={PRIMARY_BUTTON}>Save changes</button>
                    <button
                      type="button"
                      onClick={handleRetire}
                      disabled={busy}
                      className="px-4 py-2 rounded-md bg-red-600 text-white font-semibold hover:bg-red-500 disabled:opacity-50 transition-colors"
                    >
                      Retire bed
                    </button>
                    <button type="button" onClick={() => setSelectedId(null)} disabled={busy} className={SECONDARY_BUTTON}>
                      Cancel
                    </button>
                  </div>
                  <p className="text-xs text-zinc-500">
                    A bed&apos;s history moves with it if its ward changes. Retired beds are hidden from bed maps and counts but stay in past reports.
                  </p>
                </form>
              ) : (
                <p className="text-sm text-zinc-400">Select an available bed in the grid to change or retire it.</p>
              )}
            </div>

            <div className="bg-neutral-900 border border-neutral-700 rounded-lg p-6">
              <h2 className="text-xl font-bold text-white mb-4">Add Bed</h2>
              <form onSubmit={handleAddBed} className="space-y-3">
                <label className="flex flex-col gap-1 text-sm text-zinc-400">
                  Bed ID
                  <input
                    value={newBed.bedId}
                    onChange={(e) => setNewBed((prev) => ({ ...prev, bedId: e.target.value }))}
                    placeholder="e.g. iA13"
                    disabled={busy}
                    className={INPUT_CLASS}
                  />
                </label>
                <label className="flex flex-col gap-1 text-sm text-zinc-400">
                  Ward
                  <select
                    value={newBed.ward}
                    onChange={(e) => setNewBed((prev) => ({ ...prev, ward: e.target.value }))}
                    disabled={busy}
                    className={INPUT_CLASS}
                  >
                    {WARD_ORDER.map((ward) => <option key={ward} value={ward}>{ward}</option>)}
                  </select>
                </label>
                <button type="submit" disabled={busy} className={PRIMARY_BUTTON}>Add bed</button>
              </form>
            </div>

            <div className="bg-neutral-900 border border-neutral-700 rounded-lg p-6">
              <h2 className="text-xl font-bold text-white mb-4">Retired Beds ({retiredBeds.length})</h2>
              {retiredBeds.length === 0 ? (
                <p className="text-sm text-zinc-400">No retired beds.</p>
              ) : (
                <div className="space-y-2">
                  {retiredBeds.map((bed) => (
                    <div key={bed._id} className="flex items-center justify-between gap-3 p-3 rounded-lg bg-neutral-950 border border-neutral-800">
                      <div>
                        <p className="font-semibold text-white">{bed.bedId}</p>
                        <p className="text-xs text-zinc-500">{bed.ward} · retired {new Date(bed.retiredAt).toLocaleDateString()}</p>
                      </div>
                      <button onClick={() => handleReactivate(bed)} disabled={busy} className={SECONDARY_BUTTON}>
                        Reactivate
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

/**
 * Technical team dashboard: bed inventory, sign-up approvals and the nearby hospital directory
 */
const Dashboard = () => {
  const currentUser = useSelector(selectCurrentUser);
  const isTechnicalTeam = currentUser?.role === 'technical_team';
  const [activeTab, setActiveTab] = useState('beds');
  const [backendConnected, setBackendConnected] = useState(true);

  // Check backend connectivity
  const checkBackendConnection = useCallback(async () => {
    try {
      await api.get('/health');
      setBackendConnected(true);
    } catch {
      setBackendConnected(false);
    }
  }, []);

  // Periodic backend health check
  useEffect(() => {
    checkBackendConnection();
    const interval = setInterval(checkBackendConnection, 5000);
    return () => clearInterval(interval);
  }, [checkBackendConnection]);

  return (
    <DashboardLayout>
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <Wrench className="w-8 h-8 text-blue-500" />
            <h1 className="text-4xl font-bold">{isTechnicalTeam ? 'Technical Team Dashboard' : 'Bed Layout'}</h1>
          </div>
          <p className="text-zinc-400">
            {isTechnicalTeam
              ? 'Bed inventory, account approvals and the nearby hospital directory'
              : 'Managing beds, accounts and hospitals is limited to the technical team'}
            {backendConnected ? (
              <span className="ml-2 text-green-400">● Live</span>
            ) : (
              <span className="ml-2 text-red-400">● Disconnected</span>
            )}
          </p>
        </div>

        {isTechnicalTeam && (
          <div className="bg-neutral-900 border border-neutral-700 rounded-lg p-1 flex gap-1">
            {TABS.map((tab) => (
              <button key={tab.id} onClick={() => setActiveTab(tab.id)} className={tabClass(activeTab === tab.id)}>
                {tab.label}
              </button>
            ))}
          </div>
        )}

        {(!isTechnicalTeam || activeTab === 'beds') && <BedInventoryPanel canManage={isTechnicalTeam} />}
        {isTechnicalTeam && activeTab === 'approvals' && <UserApprovalsPanel />}
        {isTechnicalTeam && activeTab === 'hospitals' && <HospitalDirectoryPanel />}
      </div>
    </DashboardLayout>
  );
};

export default Dashboard;
