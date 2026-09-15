import React, { useState, useEffect, useCallback } from 'react';
import api from '@/services/api';

// Technical team and hospital admin accounts are only created from the server command line
const ROLE_OPTIONS = [
  { value: 'ward_staff', label: 'Ward Staff' },
  { value: 'er_staff', label: 'ER Staff' },
  { value: 'manager', label: 'Manager' },
];
const WARD_OPTIONS = ['ICU', 'General', 'Emergency'];
const WARD_REQUIRED_ROLES = ['ward_staff', 'manager'];

/**
 * Technical team panel for reviewing self-registered accounts.
 * The reviewer can adjust the requested role/ward before approving.
 */
const UserApprovalsPanel = () => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [message, setMessage] = useState(null);
  const [edits, setEdits] = useState({}); // role/ward overrides keyed by user id
  const [busyId, setBusyId] = useState(null);

  const fetchPendingUsers = useCallback(async () => {
    try {
      setError(null);
      const res = await api.get('/users', { params: { status: 'pending' } });
      setUsers(res.data.data.users);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load pending accounts');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPendingUsers();
  }, [fetchPendingUsers]);

  const getEdit = (user) => ({ role: user.role, ward: user.ward || '', ...edits[user.id] });

  const updateEdit = (userId, changes) => {
    setEdits((prev) => ({ ...prev, [userId]: { ...prev[userId], ...changes } }));
  };

  const handleReview = async (user, action) => {
    const { role, ward } = getEdit(user);
    const needsWard = WARD_REQUIRED_ROLES.includes(role);

    if (action === 'approve' && needsWard && !ward) {
      setError(`Select a ward before approving ${user.name}`);
      return;
    }

    setBusyId(user.id);
    setError(null);
    setMessage(null);

    try {
      const body = action === 'approve' ? { role, ...(needsWard && { ward }) } : {};
      const res = await api.patch(`/users/${user.id}/${action}`, body);
      setMessage(res.data.message);
      setUsers((prev) => prev.filter((u) => u.id !== user.id));
    } catch (err) {
      setError(err.response?.data?.message || `Failed to ${action} account`);
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="bg-neutral-900 border border-neutral-700 rounded-lg p-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-2xl font-bold">Pending Account Approvals</h2>
          <p className="text-sm text-zinc-400">
            New sign-ups cannot log in until they are approved.
          </p>
        </div>
        <button
          onClick={fetchPendingUsers}
          className="px-4 py-2 rounded-md bg-neutral-800 text-neutral-200 hover:bg-neutral-700 transition-colors"
        >
          Refresh
        </button>
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

      {loading ? (
        <p className="text-zinc-400">Loading pending accounts...</p>
      ) : users.length === 0 ? (
        <p className="text-zinc-400">No accounts are waiting for approval.</p>
      ) : (
        <div className="space-y-3">
          {users.map((user) => {
            const { role, ward } = getEdit(user);
            const isBusy = busyId === user.id;

            return (
              <div
                key={user.id}
                className="flex flex-wrap items-center gap-4 p-4 rounded-lg bg-neutral-950 border border-neutral-800"
              >
                <div className="flex-1 min-w-[12rem]">
                  <p className="font-semibold text-white">{user.name}</p>
                  <p className="text-sm text-zinc-400">{user.email}</p>
                  <p className="text-xs text-zinc-500">
                    Requested {new Date(user.createdAt).toLocaleString()}
                    {user.department ? ` · ${user.department}` : ''}
                  </p>
                </div>

                <select
                  value={role}
                  onChange={(e) => updateEdit(user.id, { role: e.target.value })}
                  disabled={isBusy}
                  className="h-10 px-3 rounded-md bg-neutral-900 border border-neutral-700 text-white"
                  aria-label={`Role for ${user.name}`}
                >
                  {ROLE_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>

                {WARD_REQUIRED_ROLES.includes(role) && (
                  <select
                    value={ward}
                    onChange={(e) => updateEdit(user.id, { ward: e.target.value })}
                    disabled={isBusy}
                    className="h-10 px-3 rounded-md bg-neutral-900 border border-neutral-700 text-white"
                    aria-label={`Ward for ${user.name}`}
                  >
                    <option value="">Select ward</option>
                    {WARD_OPTIONS.map((w) => (
                      <option key={w} value={w}>{w}</option>
                    ))}
                  </select>
                )}

                <div className="flex gap-2">
                  <button
                    onClick={() => handleReview(user, 'approve')}
                    disabled={isBusy}
                    className="px-4 py-2 rounded-md bg-green-600 text-white font-semibold hover:bg-green-500 disabled:opacity-50 transition-colors"
                  >
                    Approve
                  </button>
                  <button
                    onClick={() => handleReview(user, 'reject')}
                    disabled={isBusy}
                    className="px-4 py-2 rounded-md bg-red-600 text-white font-semibold hover:bg-red-500 disabled:opacity-50 transition-colors"
                  >
                    Reject
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default UserApprovalsPanel;
