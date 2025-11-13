import React, { useEffect, useState } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { fetchBeds } from '@/features/beds/bedsSlice';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Activity, Bed, Users, TrendingUp, AlertCircle } from 'lucide-react';
import api from '@/services/api';

const ExecutiveSummary = () => {
  const dispatch = useDispatch();
  const { bedsList, status } = useSelector((state) => state.beds);
  const [analyticsData, setAnalyticsData] = useState(null);

  useEffect(() => {
    if (status === 'idle') {
      dispatch(fetchBeds());
    }
  }, [dispatch, status]);

  useEffect(() => {
    const fetchAnalytics = async () => {
      try {
        const response = await api.get('/analytics/occupancy-summary');
        setAnalyticsData(response.data.data.summary);
      } catch (error) {
        console.error('Error fetching analytics:', error);
      }
    };
    fetchAnalytics();
  }, []);

  // Calculate metrics from beds data
  const totalBeds = bedsList.length || analyticsData?.totalBeds || 0;
  const occupiedBeds = bedsList.filter(bed => bed.status === 'occupied').length || analyticsData?.occupied || 0;
  const availableBeds = bedsList.filter(bed => bed.status === 'available').length || analyticsData?.available || 0;
  const occupancyRate = totalBeds > 0 ? Math.round((occupiedBeds / totalBeds) * 100) : 0;

  // Calculate ward-specific alerts
  const wardOccupancy = bedsList.reduce((acc, bed) => {
    if (!acc[bed.ward]) {
      acc[bed.ward] = { total: 0, occupied: 0 };
    }
    acc[bed.ward].total++;
    if (bed.status === 'occupied') acc[bed.ward].occupied++;
    return acc;
  }, {});

  const alerts = Object.entries(wardOccupancy)
    .map(([ward, data]) => {
      const rate = data.total > 0 ? (data.occupied / data.total) * 100 : 0;
      if (rate >= 95) {
        return { message: `${ward} capacity at ${Math.round(rate)}%`, severity: 'high' };
      } else if (rate >= 85) {
        return { message: `${ward} nearing full capacity`, severity: 'medium' };
      }
      return null;
    })
    .filter(Boolean)
    .slice(0, 3);

  const kpis = [
    {
      title: 'Total Beds',
      value: totalBeds.toString(),
      change: '+0',
      changeType: 'positive',
      icon: Bed,
      color: 'from-blue-500 to-cyan-500',
    },
    {
      title: 'Occupancy Rate',
      value: `${occupancyRate}%`,
      change: '+0%',
      changeType: 'positive',
      icon: Activity,
      color: 'from-purple-500 to-pink-500',
    },
    {
      title: 'Active Patients',
      value: occupiedBeds.toString(),
      change: '+0',
      changeType: 'positive',
      icon: Users,
      color: 'from-green-500 to-emerald-500',
    },
    {
      title: 'Available Beds',
      value: availableBeds.toString(),
      change: '+0',
      changeType: 'positive',
      icon: TrendingUp,
      color: 'from-orange-500 to-yellow-500',
    },
  ];

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map((kpi, index) => {
          const Icon = kpi.icon;
          return (
            <Card
              key={index}
              className="bg-neutral-900 border-neutral-700 hover:border-neutral-600 transition-all text-left"
            >
              <CardContent className="p-6">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <p className="text-sm text-neutral-400 mb-1">{kpi.title}</p>
                    <h3 className="text-3xl font-bold text-white mb-2">{kpi.value}</h3>
                    <Badge
                      variant={kpi.changeType === 'positive' ? 'default' : 'destructive'}
                      className="text-xs"
                    >
                      {kpi.change} vs last week
                    </Badge>
                  </div>
                  <div
                    className={`p-3 rounded-xl bg-gradient-to-br ${kpi.color} bg-opacity-10`}
                  >
                    <Icon className="w-6 h-6 text-white" />
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Alerts Section */}
      <Card className="bg-neutral-900 border-neutral-700">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-xl">
            <AlertCircle className="w-5 h-5 text-red-400" />
            Active Alerts
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {alerts.map((alert, index) => (
              <div
                key={index}
                className={`p-4 rounded-lg border ${alert.severity === 'high'
                  ? 'bg-red-500/10 border-red-500/30'
                  : 'bg-yellow-500/10 border-yellow-500/30'
                  }`}
              >
                <div className="flex items-center gap-3">
                  <AlertCircle
                    className={`w-5 h-5 ${alert.severity === 'high' ? 'text-red-400' : 'text-yellow-400'
                      }`}
                  />
                  <span className="text-slate-200">{alert.message}</span>
                  <Badge
                    variant="outline"
                    className={`ml-auto ${alert.severity === 'high'
                      ? 'border-red-500/50 text-red-400'
                      : 'border-yellow-500/50 text-yellow-400'
                      }`}
                  >
                    {alert.severity}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default ExecutiveSummary;
