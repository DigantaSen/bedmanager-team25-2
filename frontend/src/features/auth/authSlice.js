import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import api from '../../services/api';

// Initial state
const initialState = {
  user: null,
  token: null,
  status: 'idle', // 'idle' | 'loading' | 'succeeded' | 'failed'
  error: null,
};

// Async thunk for login
export const login = createAsyncThunk(
  'auth/login',
  async ({ email, password }, { rejectWithValue }) => {
    try {
      const response = await api.post('/auth/login', {
        email,
        password,
      });
      
      // Extract token and user from response
      const { data } = response.data; // response.data.data contains user and token
      const token = data?.token;
      const user = data?.user;
      
      if (!token || !user) {
        console.error('Invalid login response:', response.data);
        throw new Error('Invalid response: missing token or user data');
      }
      
      localStorage.setItem('authToken', token);
      localStorage.setItem('user', JSON.stringify(user));
      
      return { token, user }; // Returns { token, user }
    } catch (error) {
      const errorMessage = error.response?.data?.message || error.message || 'Login failed';
      return rejectWithValue(errorMessage);
    }
  }
);

// Async thunk for registration
export const register = createAsyncThunk(
  'auth/register',
  async ({ name, email, password, role, ward, assignedWards, department }, { rejectWithValue }) => {
    try {
      const payload = {
        name,
        email,
        password,
        role
      };

      // Add optional fields if provided
      if (ward) payload.ward = ward;
      if (assignedWards && Array.isArray(assignedWards) && assignedWards.length > 0) {
        payload.assignedWards = assignedWards;
      }
      if (department) payload.department = department;

      const response = await api.post('/auth/register', payload);
      
      // Extract token and user from response
      const { data } = response.data; // response.data.data contains user and token
      const token = data?.token;
      const user = data?.user;
      
      if (!token || !user) {
        console.error('Invalid registration response:', response.data);
        throw new Error('Invalid response: missing token or user data');
      }
      
      localStorage.setItem('authToken', token);
      localStorage.setItem('user', JSON.stringify(user));
      
      return { token, user }; // Returns { token, user }
    } catch (error) {
      const errorMessage = error.response?.data?.message || error.message || 'Registration failed';
      return rejectWithValue(errorMessage);
    }
  }
);

// Async thunk to restore session from localStorage
export const restoreSession = createAsyncThunk(
  'auth/restoreSession',
  async (_, { rejectWithValue }) => {
    try {
      const token = localStorage.getItem('authToken');
      const userStr = localStorage.getItem('user');
      
      if (token && userStr) {
        const user = JSON.parse(userStr);
        return { token, user };
      }
      
      return rejectWithValue('No session found');
    } catch (error) {
      return rejectWithValue('Failed to restore session');
    }
  }
);

// Auth slice
const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    setUser: (state, action) => {
      state.user = action.payload;
    },
    logout: (state) => {
      state.user = null;
      state.token = null;
      state.status = 'idle';
      state.error = null;
      
      // Clear localStorage
      localStorage.removeItem('authToken');
      localStorage.removeItem('user');
    },
    clearError: (state) => {
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
      // Login
      .addCase(login.pending, (state) => {
        state.status = 'loading';
        state.error = null;
      })
      .addCase(login.fulfilled, (state, action) => {
        state.status = 'succeeded';
        state.user = action.payload.user;
        state.token = action.payload.token;
        state.error = null;
      })
      .addCase(login.rejected, (state, action) => {
        state.status = 'failed';
        state.error = action.payload;
      })
      // Register
      .addCase(register.pending, (state) => {
        state.status = 'loading';
        state.error = null;
      })
      .addCase(register.fulfilled, (state, action) => {
        state.status = 'succeeded';
        state.user = action.payload.user;
        state.token = action.payload.token;
        state.error = null;
      })
      .addCase(register.rejected, (state, action) => {
        state.status = 'failed';
        state.error = action.payload;
      })
      // Restore Session
      .addCase(restoreSession.fulfilled, (state, action) => {
        state.user = action.payload.user;
        state.token = action.payload.token;
        state.status = 'succeeded';
      })
      .addCase(restoreSession.rejected, (state) => {
        state.status = 'idle';
      });
  },
});

// Export actions
export const { logout, clearError, setUser } = authSlice.actions;

// Action to update user profile data
export const updateUserProfile = (userData) => (dispatch) => {
  const updatedUser = { ...userData };
  localStorage.setItem('user', JSON.stringify(updatedUser));
  dispatch(setUser(updatedUser));
};

// Selectors
export const selectCurrentUser = (state) => state.auth.user;
export const selectAuthToken = (state) => state.auth.token;
export const selectAuthStatus = (state) => state.auth.status;
export const selectAuthError = (state) => state.auth.error;
export const selectIsAuthenticated = (state) => !!state.auth.token;

// Export reducer
export default authSlice.reducer;
