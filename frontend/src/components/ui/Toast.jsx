import React, { useEffect } from 'react';
import { X, AlertCircle, CheckCircle, Info, AlertTriangle } from 'lucide-react';

const Toast = ({ message, type = 'info', onClose, duration = 5000, title }) => {
  useEffect(() => {
    if (duration > 0) {
      const timer = setTimeout(() => {
        onClose();
      }, duration);
      return () => clearTimeout(timer);
    }
  }, [duration, onClose]);

  const getConfig = () => {
    switch (type) {
      case 'success':
        return {
          icon: CheckCircle,
          bgColor: 'bg-green-500',
          borderColor: 'border-green-400',
          textColor: 'text-white',
        };
      case 'error':
        return {
          icon: AlertCircle,
          bgColor: 'bg-red-500',
          borderColor: 'border-red-400',
          textColor: 'text-white',
        };
      case 'warning':
        return {
          icon: AlertTriangle,
          bgColor: 'bg-orange-500',
          borderColor: 'border-orange-400',
          textColor: 'text-white',
        };
      case 'emergency':
        return {
          icon: AlertTriangle,
          bgColor: 'bg-red-600',
          borderColor: 'border-red-500',
          textColor: 'text-white',
          animation: 'animate-pulse',
        };
      default:
        return {
          icon: Info,
          bgColor: 'bg-blue-500',
          borderColor: 'border-blue-400',
          textColor: 'text-white',
        };
    }
  };

  const config = getConfig();
  const Icon = config.icon;

  return (
    <div
      className={`
        fixed top-4 right-4 z-[9999]
        ${config.bgColor} ${config.textColor} border-2 ${config.borderColor}
        rounded-lg shadow-2xl p-4 min-w-[320px] max-w-md
        transform transition-all duration-300 ease-in-out
        animate-slideInRight ${config.animation || ''}
      `}
      style={{
        boxShadow: '0 10px 40px rgba(0,0,0,0.4), 0 0 20px rgba(255,255,255,0.1)',
      }}
    >
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0 mt-0.5">
          <Icon className="w-6 h-6" />
        </div>
        <div className="flex-1 min-w-0">
          {title && (
            <h4 className="font-bold text-lg mb-1">{title}</h4>
          )}
          <p className="text-sm leading-relaxed">{message}</p>
        </div>
        <button
          onClick={onClose}
          className="flex-shrink-0 hover:bg-white/20 rounded p-1 transition-colors ml-2"
          aria-label="Close notification"
        >
          <X className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
};

export default Toast;
