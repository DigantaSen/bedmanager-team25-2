import React, { useState, useEffect, useCallback } from 'react';
import api from '@/services/api';
import { formatTimeAgo, isStale } from '@/lib/timeAgo';

const WARD_TYPES = ['ICU', 'Emergency', 'General', 'Pediatrics'];
const INPUT_CLASS = 'h-10 px-3 rounded-md bg-neutral-900 border border-neutral-700 text-white disabled:opacity-50';
const SECONDARY_BUTTON = 'px-4 py-2 rounded-md bg-neutral-800 text-neutral-200 hover:bg-neutral-700 disabled:opacity-50 transition-colors';

const emptyForm = () => ({
  name: '',
  address: '',
  distance: '',
  contactNumber: '',
  emergencyContact: '',
  latitude: '',
  longitude: '',
  isActive: true,
  wards: [{ wardType: 'ICU', totalBeds: '', availableBeds: '' }]
});

const toForm = (hospital) => ({
  name: hospital.name,
  address: hospital.address,
  distance: String(hospital.distance),
  contactNumber: hospital.phone,
  emergencyContact: hospital.emergencyContact || '',
  latitude: hospital.location ? String(hospital.location.latitude) : '',
  longitude: hospital.location ? String(hospital.location.longitude) : '',
  isActive: hospital.isActive,
  wards: []
});

// Directory ward counts -> editable rows
const toWardRows = (wards) => Object.entries(wards).map(([wardType, counts]) => ({
  wardType,
  totalBeds: String(counts.total),
  availableBeds: String(counts.available)
}));

const toWardPayload = (rows) => rows.map((row) => ({
  wardType: row.wardType,
  totalBeds: Number(row.totalBeds),
  availableBeds: Number(row.availableBeds)
}));

// First problem with a set of ward rows, or null
const getWardRowsError = (rows) => {
  if (rows.length === 0) return 'Add at least one ward';
  for (const row of rows) {
    if (row.totalBeds === '' || row.availableBeds === '') {
      return `Enter total and available beds for ${row.wardType}`;
    }
    const total = Number(row.totalBeds);
    const available = Number(row.availableBeds);
    if (!Number.isInteger(total) || !Number.isInteger(available) || total < 0 || available < 0) {
      return `${row.wardType} bed counts must be whole numbers`;
    }
    if (available > total) return `${row.wardType}: available beds cannot exceed total beds`;
  }
  return null;
};

const getApiError = (err, fallback) => {
  const data = err.response?.data;
  return data?.errors?.[0]?.message || data?.message || fallback;
};

const FormField = ({ label, children }) => (
  <label className="flex flex-col gap-1 text-sm text-zinc-400">
    {label}
    {children}
  </label>
);

const WardRowsEditor = ({ rows, onChange, disabled }) => {
  const unusedTypes = WARD_TYPES.filter((type) => !rows.some((row) => row.wardType === type));
  const updateRow = (index, changes) => onChange(rows.map((row, i) => (i === index ? { ...row, ...changes } : row)));

  return (
    <div className="space-y-2">
      {rows.map((row, index) => {
        const occupied = row.totalBeds !== '' && row.availableBeds !== ''
          ? Number(row.totalBeds) - Number(row.availableBeds)
          : null;

        return (
          <div key={row.wardType} className="flex flex-wrap items-center gap-2">
            <select
              value={row.wardType}
              onChange={(e) => updateRow(index, { wardType: e.target.value })}
              disabled={disabled}
              className={`${INPUT_CLASS} w-36`}
              aria-label="Ward type"
            >
              {[row.wardType, ...unusedTypes].map((type) => (
                <option key={type} value={type}>{type}</option>
              ))}
            </select>
            <label className="flex items-center gap-2 text-sm text-zinc-400">
              Total
              <input
                type="number"
                min="0"
                value={row.totalBeds}
                onChange={(e) => updateRow(index, { totalBeds: e.target.value })}
                disabled={disabled}
                className={`${INPUT_CLASS} w-24`}
              />
            </label>
            <label className="flex items-center gap-2 text-sm text-zinc-400">
              Available
              <input
                type="number"
                min="0"
                value={row.availableBeds}
                onChange={(e) => updateRow(index, { availableBeds: e.target.value })}
                disabled={disabled}
                className={`${INPUT_CLASS} w-24`}
              />
            </label>
            <span className="w-24 text-sm text-zinc-500">
              {occupied !== null && occupied >= 0 ? `${occupied} occupied` : ''}
            </span>
            <button
              type="button"
              onClick={() => onChange(rows.filter((_, i) => i !== index))}
              disabled={disabled}
              className="px-3 py-2 rounded-md text-sm text-red-400 hover:bg-red-500/10 disabled:opacity-50 transition-colors"
            >
              Remove
            </button>
          </div>
        );
      })}
      {unusedTypes.length > 0 && (
        <button
          type="button"
          onClick={() => onChange([...rows, { wardType: unusedTypes[0], totalBeds: '', availableBeds: '' }])}
          disabled={disabled}
          className="px-3 py-2 rounded-md text-sm bg-neutral-800 text-neutral-200 hover:bg-neutral-700 disabled:opacity-50 transition-colors"
        >
          + Add ward
        </button>
      )}
    </div>
  );
};

const HospitalForm = ({ initial, isNew = false, busy, onCancel, onSubmit }) => {
  const [form, setForm] = useState(initial);
  const [formError, setFormError] = useState(null);
  const update = (changes) => setForm((prev) => ({ ...prev, ...changes }));

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.name.trim() || !form.address.trim() || !form.contactNumber.trim() || form.distance === '') {
      setFormError('Name, address, distance and contact number are required');
      return;
    }
    const wardError = isNew ? getWardRowsError(form.wards) : null;
    if (wardError) {
      setFormError(wardError);
      return;
    }

    setFormError(null);
    onSubmit({
      name: form.name.trim(),
      address: form.address.trim(),
      distance: Number(form.distance),
      contactNumber: form.contactNumber.trim(),
      emergencyContact: form.emergencyContact.trim() || null,
      location: {
        latitude: form.latitude === '' ? null : Number(form.latitude),
        longitude: form.longitude === '' ? null : Number(form.longitude)
      },
      isActive: form.isActive,
      ...(isNew && { wards: toWardPayload(form.wards) })
    });
  };

  return (
    <form onSubmit={handleSubmit} className="p-4 mb-4 rounded-lg bg-neutral-950 border border-blue-500/30 space-y-3">
      <p className="font-semibold text-white">{isNew ? 'Add hospital' : 'Edit hospital details'}</p>
      {formError && <p className="text-sm text-red-400">{formError}</p>}

      <div className="grid gap-3 md:grid-cols-2">
        <FormField label="Name">
          <input value={form.name} onChange={(e) => update({ name: e.target.value })} disabled={busy} className={INPUT_CLASS} />
        </FormField>
        <FormField label="Address">
          <input value={form.address} onChange={(e) => update({ address: e.target.value })} disabled={busy} className={INPUT_CLASS} />
        </FormField>
        <FormField label="Distance from this hospital (km)">
          <input type="number" min="0" step="0.1" value={form.distance} onChange={(e) => update({ distance: e.target.value })} disabled={busy} className={INPUT_CLASS} />
        </FormField>
        <FormField label="Contact number">
          <input value={form.contactNumber} onChange={(e) => update({ contactNumber: e.target.value })} disabled={busy} className={INPUT_CLASS} />
        </FormField>
        <FormField label="Emergency contact (optional)">
          <input value={form.emergencyContact} onChange={(e) => update({ emergencyContact: e.target.value })} disabled={busy} className={INPUT_CLASS} />
        </FormField>
        <div className="grid grid-cols-2 gap-3">
          <FormField label="Latitude (optional)">
            <input type="number" step="any" value={form.latitude} onChange={(e) => update({ latitude: e.target.value })} disabled={busy} className={INPUT_CLASS} />
          </FormField>
          <FormField label="Longitude (optional)">
            <input type="number" step="any" value={form.longitude} onChange={(e) => update({ longitude: e.target.value })} disabled={busy} className={INPUT_CLASS} />
          </FormField>
        </div>
      </div>

      <label className="flex items-center gap-2 text-sm text-zinc-300">
        <input type="checkbox" checked={form.isActive} onChange={(e) => update({ isActive: e.target.checked })} disabled={busy} />
        Active (shown to managers for referrals)
      </label>

      {isNew && (
        <div>
          <p className="text-sm font-semibold text-zinc-300 mb-2">Wards and current bed counts</p>
          <WardRowsEditor rows={form.wards} onChange={(wards) => update({ wards })} disabled={busy} />
        </div>
      )}

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={busy}
          className="px-4 py-2 rounded-md bg-green-600 text-white font-semibold hover:bg-green-500 disabled:opacity-50 transition-colors"
        >
          {isNew ? 'Add hospital' : 'Save details'}
        </button>
        <button type="button" onClick={onCancel} disabled={busy} className={SECONDARY_BUTTON}>
          Cancel
        </button>
      </div>
    </form>
  );
};

/**
 * Admin panel for the nearby hospital directory used for referrals.
 * Bed counts are entered by the technical team and shown to managers with when they were last updated.
 */
const HospitalDirectoryPanel = () => {
  const [hospitals, setHospitals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [message, setMessage] = useState(null);
  const [busyId, setBusyId] = useState(null);
  const [editingId, setEditingId] = useState(null); // 'new' or a hospital id
  const [bedEdits, setBedEdits] = useState({}); // ward rows being edited, keyed by hospital id

  const fetchHospitals = useCallback(async () => {
    try {
      setError(null);
      const res = await api.get('/referrals/hospitals');
      setHospitals(res.data.data.hospitals);
    } catch (err) {
      setError(getApiError(err, 'Failed to load the hospital directory'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchHospitals();
  }, [fetchHospitals]);

  const replaceHospital = (hospital) => {
    setHospitals((prev) => [...prev.filter((h) => h.id !== hospital.id), hospital].sort((a, b) => a.distance - b.distance));
  };

  const clearBedEdit = (hospitalId) => {
    setBedEdits((prev) => {
      const next = { ...prev };
      delete next[hospitalId];
      return next;
    });
  };

  // Runs a request for one hospital (or the new-hospital form) and reports the outcome
  const runRequest = async (busyKey, request, fallbackError) => {
    setBusyId(busyKey);
    setError(null);
    setMessage(null);
    try {
      const res = await request();
      setMessage(res.data.message);
      return res.data.data;
    } catch (err) {
      setError(getApiError(err, fallbackError));
      return null;
    } finally {
      setBusyId(null);
    }
  };

  const handleCreate = async (payload) => {
    const data = await runRequest('new', () => api.post('/referrals/hospitals', payload), 'Failed to add hospital');
    if (data) {
      replaceHospital(data.hospital);
      setEditingId(null);
    }
  };

  const handleUpdateDetails = async (hospitalId, payload) => {
    const data = await runRequest(hospitalId, () => api.put(`/referrals/hospitals/${hospitalId}`, payload), 'Failed to update hospital');
    if (data) {
      replaceHospital(data.hospital);
      setEditingId(null);
    }
  };

  const handleSaveBeds = async (hospital) => {
    const rows = bedEdits[hospital.id];
    const wardError = getWardRowsError(rows);
    if (wardError) {
      setError(`${hospital.name}: ${wardError}`);
      return;
    }
    const data = await runRequest(
      hospital.id,
      () => api.put(`/referrals/hospitals/${hospital.id}/beds`, { wards: toWardPayload(rows) }),
      'Failed to update bed counts'
    );
    if (data) {
      replaceHospital(data.hospital);
      clearBedEdit(hospital.id);
    }
  };

  const handleDelete = async (hospital) => {
    if (!window.confirm(`Remove ${hospital.name} from the directory?`)) return;
    const data = await runRequest(hospital.id, () => api.delete(`/referrals/hospitals/${hospital.id}`), 'Failed to remove hospital');
    if (data !== null) {
      setHospitals((prev) => prev.filter((h) => h.id !== hospital.id));
    }
  };

  return (
    <div className="bg-neutral-900 border border-neutral-700 rounded-lg p-6">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div>
          <h2 className="text-2xl font-bold">Nearby Hospital Directory</h2>
          <p className="text-sm text-zinc-400">
            Hospitals used for referrals. Bed counts entered here are shown to managers with when they were last updated.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setEditingId('new')}
            disabled={editingId === 'new'}
            className="px-4 py-2 rounded-md bg-blue-600 text-white font-semibold hover:bg-blue-500 disabled:opacity-50 transition-colors"
          >
            Add hospital
          </button>
          <button onClick={fetchHospitals} className={SECONDARY_BUTTON}>
            Refresh
          </button>
        </div>
      </div>

      {message && (
        <div className="mb-4 p-3 rounded-lg bg-green-500/10 border border-green-500/20">
          <p className="text-sm text-green-400">{message}</p>
        </div>
      )}
      {error && (
        <div className="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/20">
          <p className="text-sm text-red-400">{error}</p>
        </div>
      )}

      {editingId === 'new' && (
        <HospitalForm
          initial={emptyForm()}
          isNew
          busy={busyId === 'new'}
          onCancel={() => setEditingId(null)}
          onSubmit={handleCreate}
        />
      )}

      {loading ? (
        <p className="text-zinc-400">Loading hospital directory...</p>
      ) : hospitals.length === 0 ? (
        <p className="text-zinc-400">No hospitals in the directory yet. Add the hospitals you refer patients to.</p>
      ) : (
        <div className="space-y-4">
          {hospitals.map((hospital) => {
            const isBusy = busyId === hospital.id;
            const rows = bedEdits[hospital.id];
            const stale = isStale(hospital.lastUpdated);

            return (
              <div key={hospital.id} className="p-4 rounded-lg bg-neutral-950 border border-neutral-800 space-y-3">
                {editingId === hospital.id ? (
                  <HospitalForm
                    initial={toForm(hospital)}
                    busy={isBusy}
                    onCancel={() => setEditingId(null)}
                    onSubmit={(payload) => handleUpdateDetails(hospital.id, payload)}
                  />
                ) : (
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-[12rem]">
                      <p className="font-semibold text-white">
                        {hospital.name}
                        {!hospital.isActive && (
                          <span className="ml-2 px-2 py-0.5 rounded-full text-xs bg-zinc-700 text-zinc-300">Inactive</span>
                        )}
                      </p>
                      <p className="text-sm text-zinc-400">{hospital.address}</p>
                      <p className="text-xs text-zinc-500">
                        {hospital.distance} km · {hospital.phone}
                        {hospital.emergencyContact ? ` · Emergency ${hospital.emergencyContact}` : ''}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => setEditingId(hospital.id)} disabled={isBusy} className={SECONDARY_BUTTON}>
                        Edit details
                      </button>
                      <button
                        onClick={() => handleDelete(hospital)}
                        disabled={isBusy}
                        className="px-4 py-2 rounded-md bg-red-600 text-white font-semibold hover:bg-red-500 disabled:opacity-50 transition-colors"
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                )}

                <div className="border-t border-neutral-800 pt-3">
                  <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                    <p className="text-sm font-semibold text-zinc-300">Bed counts</p>
                    <p
                      className={`text-xs ${stale ? 'text-yellow-400' : 'text-zinc-500'}`}
                      title={hospital.lastUpdated ? new Date(hospital.lastUpdated).toLocaleString() : undefined}
                    >
                      {hospital.lastUpdated
                        ? `Updated ${formatTimeAgo(hospital.lastUpdated)}${hospital.lastUpdatedBy ? ` by ${hospital.lastUpdatedBy}` : ''}`
                        : 'Never updated'}
                      {stale && ' · may be out of date'}
                    </p>
                  </div>

                  {rows ? (
                    <div className="space-y-3">
                      <WardRowsEditor
                        rows={rows}
                        onChange={(next) => setBedEdits((prev) => ({ ...prev, [hospital.id]: next }))}
                        disabled={isBusy}
                      />
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleSaveBeds(hospital)}
                          disabled={isBusy}
                          className="px-4 py-2 rounded-md bg-green-600 text-white font-semibold hover:bg-green-500 disabled:opacity-50 transition-colors"
                        >
                          Save bed counts
                        </button>
                        <button onClick={() => clearBedEdit(hospital.id)} disabled={isBusy} className={SECONDARY_BUTTON}>
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-wrap items-center gap-3">
                      {Object.entries(hospital.wards).map(([wardType, counts]) => (
                        <span
                          key={wardType}
                          className="px-3 py-1 rounded-md bg-neutral-900 border border-neutral-800 text-sm text-zinc-300"
                        >
                          {wardType}: <span className="text-green-400 font-semibold">{counts.available}</span> of {counts.total} available
                        </span>
                      ))}
                      <button
                        onClick={() => setBedEdits((prev) => ({ ...prev, [hospital.id]: toWardRows(hospital.wards) }))}
                        disabled={isBusy}
                        className="px-3 py-1.5 rounded-md text-sm bg-neutral-800 text-neutral-200 hover:bg-neutral-700 disabled:opacity-50 transition-colors"
                      >
                        Update bed counts
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default HospitalDirectoryPanel;
