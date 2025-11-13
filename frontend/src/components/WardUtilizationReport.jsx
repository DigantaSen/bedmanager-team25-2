import React, { useState, useEffect } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { fetchBeds } from '@/features/beds/bedsSlice';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { BarChart3, Download } from 'lucide-react';
import api from '@/services/api';

const WardUtilizationReport = () => {
  const dispatch = useDispatch();
  const { bedsList, status } = useSelector((state) => state.beds);
  const [viewMode, setViewMode] = useState('table');
  const [wardData, setWardData] = useState([]);

  useEffect(() => {
    if (status === 'idle') {
      dispatch(fetchBeds());
    }
  }, [dispatch, status]);

  useEffect(() => {
    const fetchWardData = async () => {
      try {
        const response = await api.get('/analytics/occupancy-by-ward');
        const wardBreakdown = response.data.data.wardBreakdown;

        // Transform API data to match component structure
        const transformedData = wardBreakdown.map(ward => {
          const utilization = ward.occupancyPercentage;
          let status = 'normal';
          if (utilization >= 90) status = 'critical';
          else if (utilization >= 75) status = 'high';

          return {
            ward: ward.ward,
            totalBeds: ward.totalBeds,
            occupied: ward.occupied,
            available: ward.available,
            utilization,
            status
          };
        });

        setWardData(transformedData);
      } catch (error) {
        console.error('Error fetching ward data:', error);
        // Fallback to calculate from bedsList
        calculateWardDataFromBeds();
      }
    };

    const calculateWardDataFromBeds = () => {
      const wardMap = bedsList.reduce((acc, bed) => {
        if (!acc[bed.ward]) {
          acc[bed.ward] = { total: 0, occupied: 0, available: 0 };
        }
        acc[bed.ward].total++;
        if (bed.status === 'occupied') acc[bed.ward].occupied++;
        if (bed.status === 'available') acc[bed.ward].available++;
        return acc;
      }, {});

      const data = Object.entries(wardMap).map(([ward, counts]) => {
        const utilization = counts.total > 0 ? Math.round((counts.occupied / counts.total) * 100) : 0;
        let status = 'normal';
        if (utilization >= 90) status = 'critical';
        else if (utilization >= 75) status = 'high';

        return {
          ward,
          totalBeds: counts.total,
          occupied: counts.occupied,
          available: counts.available,
          utilization,
          status
        };
      });

      setWardData(data);
    };

    if (bedsList.length > 0) {
      fetchWardData();
    }
  }, [bedsList]);

  const getStatusColor = (status) => {
    switch (status) {
      case 'critical':
        return 'bg-red-500/20 text-red-400 border-red-500/50';
      case 'high':
        return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/50';
      case 'normal':
        return 'bg-green-500/20 text-green-400 border-green-500/50';
      default:
        return 'bg-neutral-500/20 text-slate-400 border-neutral-500/50';
    }
  };

  const getUtilizationBarColor = (utilization) => {
    if (utilization >= 90) return 'bg-red-500';
    if (utilization >= 75) return 'bg-yellow-500';
    return 'bg-green-500';
  };

  return (
    <Card className="bg-neutral-900 border-neutral-700">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-xl">
            <BarChart3 className="w-5 h-5 text-blue-400" />
            Ward Utilization Report
          </CardTitle>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setViewMode(viewMode === 'table' ? 'chart' : 'table')}
              className="border-neutral-600 hover:bg-neutral-700"
            >
              {viewMode === 'table' ? 'Chart View' : 'Table View'}
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="border-neutral-600 hover:bg-neutral-700"
            >
              <Download className="w-4 h-4 mr-2" />
              Export
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {viewMode === 'table' ? (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-neutral-700">
                  <th className="text-left py-3 px-4 text-sm font-semibold text-slate-300">Ward</th>
                  <th className="text-center py-3 px-4 text-sm font-semibold text-slate-300">Total Beds</th>
                  <th className="text-center py-3 px-4 text-sm font-semibold text-slate-300">Occupied</th>
                  <th className="text-center py-3 px-4 text-sm font-semibold text-slate-300">Available</th>
                  <th className="text-center py-3 px-4 text-sm font-semibold text-slate-300">Utilization</th>
                  <th className="text-center py-3 px-4 text-sm font-semibold text-slate-300">Status</th>
                </tr>
              </thead>
              <tbody>
                {wardData.map((ward, index) => (
                  <tr key={index} className="border-b border-neutral-700/50 hover:bg-neutral-700/30">
                    <td className="py-3 px-4 font-medium text-white">{ward.ward}</td>
                    <td className="py-3 px-4 text-center text-slate-300">{ward.totalBeds}</td>
                    <td className="py-3 px-4 text-center text-blue-400 font-semibold">{ward.occupied}</td>
                    <td className="py-3 px-4 text-center text-green-400 font-semibold">{ward.available}</td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 bg-neutral-700 rounded-full h-2 overflow-hidden">
                          <div
                            className={`h-full ${getUtilizationBarColor(ward.utilization)}`}
                            style={{ width: `${ward.utilization}%` }}
                          />
                        </div>
                        <span className="text-sm font-semibold text-slate-300 min-w-[3rem]">
                          {ward.utilization}%
                        </span>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-center">
                      <Badge variant="outline" className={getStatusColor(ward.status)}>
                        {ward.status}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="space-y-4">
            {wardData.map((ward, index) => (
              <div key={index} className="p-4 bg-neutral-900 rounded-lg border border-neutral-700">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-semibold text-white">{ward.ward}</span>
                  <span className="text-2xl font-bold text-blue-400">{ward.utilization}%</span>
                </div>
                <div className="relative h-8 bg-neutral-700 rounded-full overflow-hidden">
                  <div
                    className={`absolute inset-y-0 left-0 ${getUtilizationBarColor(ward.utilization)} transition-all`}
                    style={{ width: `${ward.utilization}%` }}
                  />
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-xs font-semibold text-white drop-shadow-lg">
                      {ward.occupied} / {ward.totalBeds} beds
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default WardUtilizationReport;
