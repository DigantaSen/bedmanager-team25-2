import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { selectCurrentUser } from '@/features/auth/authSlice';
import { ShieldAlert, ArrowLeft } from 'lucide-react';

const Unauthorized = () => {
  const navigate = useNavigate();
  const currentUser = useSelector(selectCurrentUser);

  const handleGoBack = () => {
    // Redirect to appropriate dashboard based on role
    if (currentUser?.role === 'hospital_admin') {
      navigate('/admin/dashboard');
    } else if (currentUser?.role === 'manager') {
      navigate('/manager/dashboard');
    } else if (currentUser?.role === 'ward_staff') {
      navigate('/staff/dashboard');
    } else if (currentUser?.role === 'er_staff') {
      navigate('/er/dashboard');
    } else {
      navigate('/dashboard');
    }
  };

  return (
    <div className="min-h-screen bg-black flex items-center justify-center p-4">
      <div className="max-w-md w-full text-center">
        <div className="mb-8 flex justify-center">
          <div className="p-4 rounded-full bg-red-500/10 border border-red-500/20">
            <ShieldAlert className="w-16 h-16 text-red-500" />
          </div>
        </div>
        
        <h1 className="text-4xl font-bold text-white mb-4">
          Access Denied
        </h1>
        
        <p className="text-zinc-400 mb-2">
          You don't have permission to access this page.
        </p>
        
        <p className="text-zinc-500 text-sm mb-8">
          Your current role: <span className="text-cyan-400 font-medium">
            {currentUser?.role?.replace(/_/g, ' ').toUpperCase() || 'Unknown'}
          </span>
        </p>
        
        <button
          onClick={handleGoBack}
          className="inline-flex items-center gap-2 px-6 py-3 bg-cyan-600 hover:bg-cyan-700 text-white rounded-lg transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Go to Dashboard
        </button>
      </div>
    </div>
  );
};

export default Unauthorized;
