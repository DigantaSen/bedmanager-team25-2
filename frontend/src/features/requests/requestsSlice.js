import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import api from '../../services/api';

// Async Thunks
export const fetchRequests = createAsyncThunk('requests/fetchAll', async () => {
  const res = await api.get('/emergency-requests');
  return res.data;
});

export const updateRequestStatus = createAsyncThunk(
  'requests/updateStatus',
  async ({ id, status }) => {
    const res = await api.patch(`/emergency-requests/${id}`, { status });
    return res.data;
  }
);

const requestsSlice = createSlice({
  name: 'requests',
  initialState: {
    requests: [],
    selectedRequest: null,
    status: 'idle',
    error: null,
  },
  reducers: {
    selectRequest: (state, action) => {
      state.selectedRequest = action.payload;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchRequests.pending, (state) => {
        state.status = 'loading';
      })
      .addCase(fetchRequests.fulfilled, (state, action) => {
        state.status = 'succeeded';
        state.requests = Array.isArray(action.payload) ? action.payload : [];
      })
      .addCase(fetchRequests.rejected, (state, action) => {
        state.status = 'failed';
        state.error = action.error.message;
      })
      .addCase(updateRequestStatus.fulfilled, (state, action) => {
        const idx = state.requests.findIndex(r => r._id === action.payload._id);
        if (idx >= 0) state.requests[idx] = action.payload;
      });
  },
});

export const { selectRequest } = requestsSlice.actions;
export default requestsSlice.reducer;
