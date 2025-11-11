import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import api from '../../services/api';

export const fetchAlerts = createAsyncThunk('alerts/fetchAll', async () => {
  const res = await api.get('/alerts');
  return res.data.data?.alerts || res.data.alerts || res.data;
});

export const dismissAlert = createAsyncThunk('alerts/dismiss', async (id) => {
  const res = await api.patch(`/alerts/${id}/dismiss`);
  return res.data.data?.alert || res.data.alert;
});

const alertsSlice = createSlice({
  name: 'alerts',
  initialState: {
    alerts: [],
    unreadCount: 0,
    status: 'idle',
    error: null,
  },
  reducers: {
    addAlert: (state, action) => {
      state.alerts.unshift(action.payload);
      state.unreadCount += 1;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchAlerts.pending, (state) => {
        state.status = 'loading';
      })
      .addCase(fetchAlerts.fulfilled, (state, action) => {
        state.status = 'succeeded';
        state.alerts = Array.isArray(action.payload) ? action.payload : [];
        state.unreadCount = state.alerts.filter(a => !a.read).length;
      })
      .addCase(fetchAlerts.rejected, (state, action) => {
        state.status = 'failed';
        state.error = action.error.message;
      })
      .addCase(dismissAlert.fulfilled, (state, action) => {
        const idx = state.alerts.findIndex(a => a._id === action.payload._id);
        if (idx >= 0) state.alerts[idx] = action.payload;
        state.unreadCount = state.alerts.filter(a => !a.read).length;
      });
  },
});

export const { addAlert } = alertsSlice.actions;
export default alertsSlice.reducer;
