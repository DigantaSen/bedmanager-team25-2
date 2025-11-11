import React, { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { fetchAlerts, dismissAlert } from '@/features/alerts/alertsSlice';
import { AlertTriangle, AlertCircle, Info, CheckCircle, X } from 'lucide-react';

const AlertNotificationPanel = ({ ward }) => {
  const dispatch = useDispatch();
  const { alerts, status } = useSelector((state) => state.alerts);
  const currentUser = useSelector((state) => state.auth.user);

  useEffect(() => {
    dispatch(fetchAlerts());
  }, [dispatch]);

  const filteredAlerts = ward || currentUser?.ward
    ? (Array.isArray(alerts) ? alerts : []).filter((alert) => !alert.ward || alert.ward === (ward || currentUser?.ward))
    : (Array.isArray(alerts) ? alerts : []);

  const getSeverityConfig = (severity) => {
    switch (severity) {
      case 'critical':
        return {
          icon: AlertTriangle,
          color: 'text-red-500',
          bgColor: 'bg-red-500/10',
          borderColor: 'border-red-500/50',
        };
      case 'high':
        return {
          icon: AlertCircle,
          color: 'text-orange-500',
          bgColor: 'bg-orange-500/10',
          borderColor: 'border-orange-500/50',
        };
      case 'medium':
        return {
          icon: Info,
          color: 'text-yellow-500',
          bgColor: 'bg-yellow-500/10',
          borderColor: 'border-yellow-500/50',
        };
      case 'low':
        return {
          icon: CheckCircle,
          color: 'text-green-500',
          bgColor: 'bg-green-500/10',
          borderColor: 'border-green-500/50',
        };
      default:
        return {
          icon: Info,
          color: 'text-zinc-500',
          bgColor: 'bg-zinc-500/10',
          borderColor: 'border-zinc-500/50',
        };
    }
  };

  const handleDismiss = (alertId) => {
    dispatch(dismissAlert(alertId));
  };

  if (status === 'loading') {
    return (
      <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-6">
        <h2 className="text-2xl font-bold text-white mb-4">Alerts & Notifications</h2>
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="bg-zinc-800 rounded-lg p-4 animate-pulse">
              <div className="h-4 bg-zinc-700 rounded w-3/4 mb-2"></div>
              <div className="h-3 bg-zinc-700 rounded w-1/2"></div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-2xl font-bold text-white">Alerts & Notifications</h2>
        {filteredAlerts.length > 0 && (
          <span className="bg-red-500 text-white text-xs font-bold px-2 py-1 rounded-full">
            {filteredAlerts.length}
          </span>
        )}
      </div>

      {filteredAlerts.length === 0 ? (
        <div className="text-center py-8">
          <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-3" />
          <p className="text-zinc-400">No active alerts. All clear!</p>
        </div>
      ) : (
        <div className="space-y-3 max-h-96 overflow-y-auto">
          {filteredAlerts.map((alert) => {
            const config = getSeverityConfig(alert.severity);
            const Icon = config.icon;

            return (
              <div
                key={alert._id}
                className={`
                  ${config.bgColor} border ${config.borderColor}
                  rounded-lg p-4 flex items-start gap-3
                  transition-all duration-200 hover:shadow-lg
                `}
              >
                <div className={`${config.color} mt-1`}>
                  <Icon className="w-5 h-5" />
                </div>
                <div className="flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className={`font-semibold ${config.color}`}>
                      {alert.type || 'Alert'}
                    </h3>
                    <button
                      onClick={() => handleDismiss(alert._id)}
                      className="text-zinc-400 hover:text-white transition-colors"
                      title="Dismiss alert"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                  <p className="text-zinc-300 text-sm mt-1">{alert.message}</p>
                  {alert.ward && (
                    <p className="text-zinc-500 text-xs mt-2">Ward: {alert.ward}</p>
                  )}
                  <p className="text-zinc-500 text-xs mt-1">
                    {new Date(alert.createdAt || Date.now()).toLocaleString()}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default AlertNotificationPanel;
