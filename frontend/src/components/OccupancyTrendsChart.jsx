import React, { useState, useEffect } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { fetchBeds } from '@/features/beds/bedsSlice';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from '@/components/ui/select';
import { TrendingUp, Calendar } from 'lucide-react';
import api from '@/services/api';

const ALL_WARDS = 'allwards';

// Label a period from its real start/end dates
const formatPeriodLabel = (period, timeRange) => {
  const start = new Date(period.start);
  const end = new Date(new Date(period.end).getTime() - 1);
  if (timeRange === '7days') {
    return start.toLocaleDateString('en-US', { weekday: 'short', day: 'numeric' });
  }
  const format = { month: 'short', day: 'numeric' };
  return `${start.toLocaleDateString('en-US', format)} – ${end.toLocaleDateString('en-US', format)}`;
};

const formatChange = (current, previous) => {
  if (current == null || previous == null) return null;
  const difference = Math.round((current - previous) * 10) / 10;
  return `${difference >= 0 ? '+' : ''}${difference}%`;
};

const OccupancyTrendsChart = () => {
  const dispatch = useDispatch();
  const { bedsList, status } = useSelector((state) => state.beds);
  const [timeRange, setTimeRange] = useState('7days');
  const [selectedWard, setSelectedWard] = useState(ALL_WARDS);
  const [timeline, setTimeline] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (status === 'idle') {
      dispatch(fetchBeds());
    }
  }, [dispatch, status]);

  const wards = [...new Set(bedsList.map(bed => bed.ward))].sort();

  useEffect(() => {
    const fetchTimeline = async () => {
      setLoading(true);
      setError(null);
      try {
        const params = { range: timeRange };
        if (selectedWard !== ALL_WARDS) params.ward = selectedWard;
        const response = await api.get('/analytics/occupancy-timeline', { params });
        setTimeline(response.data.data);
      } catch (err) {
        console.error('Error fetching occupancy timeline:', err);
        setError(err.response?.data?.message || 'Failed to load occupancy trends');
      } finally {
        setLoading(false);
      }
    };

    fetchTimeline();
  }, [timeRange, selectedWard]);

  // Periods before occupancy history was recorded have no data (null)
  const chartData = (timeline?.periods || []).map((period) => ({
    day: formatPeriodLabel(period, timeRange),
    occupancy: period.averageOccupancy == null ? null : Math.round(period.averageOccupancy)
  }));
  const currentData = chartData.filter((d) => d.occupancy != null);
  const summary = timeline?.summary;
  const previousSummary = timeline?.previousSummary;

  // Generate insights from the recorded occupancy periods
  const generateInsights = () => {
    if (currentData.length === 0 || summary?.averageOccupancy == null) return [];

    const insights = [];
    const busiest = currentData.reduce((max, d) => (d.occupancy > max.occupancy ? d : max), currentData[0]);
    insights.push(`Busiest period: ${busiest.day} with ${busiest.occupancy}% average occupancy`);

    if (currentData.length >= 3) {
      const firstHalf = currentData.slice(0, Math.floor(currentData.length / 2));
      const secondHalf = currentData.slice(Math.floor(currentData.length / 2));
      const firstAvg = firstHalf.reduce((sum, d) => sum + d.occupancy, 0) / firstHalf.length;
      const secondAvg = secondHalf.reduce((sum, d) => sum + d.occupancy, 0) / secondHalf.length;
      const difference = Math.abs(secondAvg - firstAvg);

      if (difference > 3) {
        insights.push(`${secondAvg > firstAvg ? 'Upward' : 'Downward'} trend: ${Math.round(difference)}% ${secondAvg > firstAvg ? 'higher' : 'lower'} in the second half of the period`);
      } else {
        insights.push('Occupancy remained relatively stable over the period');
      }
    }

    const highPeriods = currentData.filter(d => d.occupancy >= 90);
    if (highPeriods.length > 0) {
      insights.push(`High average occupancy (≥90%) in ${highPeriods.length} of ${currentData.length} periods`);
    }
    if (summary.peakOccupancy >= 95) {
      insights.push(`Occupancy peaked at ${summary.peakOccupancy}% during the period`);
    }

    return insights;
  };

  const dynamicInsights = generateInsights();

  const metrics = [
    { label: 'Average Occupancy', value: summary?.averageOccupancy, change: formatChange(summary?.averageOccupancy, previousSummary?.averageOccupancy) },
    { label: 'Peak Occupancy', value: summary?.peakOccupancy, change: formatChange(summary?.peakOccupancy, previousSummary?.peakOccupancy) },
    { label: 'Lowest Occupancy', value: summary?.lowOccupancy, change: formatChange(summary?.lowOccupancy, previousSummary?.lowOccupancy) },
  ];

  return (
    <Card className="bg-neutral-900 border-neutral-700">
      <CardHeader>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <CardTitle className="flex items-center gap-2 text-xl">
            <TrendingUp className="w-5 h-5 text-purple-400" />
            Occupancy Trends
          </CardTitle>
          <div className="flex flex-wrap gap-2 items-center">
            <Select value={selectedWard} onValueChange={setSelectedWard}>
              <SelectTrigger className="w-[180px] border-neutral-600 h-10">
                <SelectValue placeholder="All Wards" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL_WARDS}>All Wards</SelectItem>
                {wards.map((ward) => (
                  <SelectItem key={ward} value={ward}>
                    {ward}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="flex gap-1 bg-neutral-900 rounded-lg p-1 border border-neutral-700 h-10">
              <Button
                size="sm"
                variant={timeRange === '7days' ? 'default' : 'ghost'}
                onClick={() => setTimeRange('7days')}
                className="text-xs h-8"
              >
                7 Days
              </Button>
              <Button
                size="sm"
                variant={timeRange === '30days' ? 'default' : 'ghost'}
                onClick={() => setTimeRange('30days')}
                className="text-xs h-8"
              >
                30 Days
              </Button>
              <Button
                size="sm"
                variant={timeRange === '90days' ? 'default' : 'ghost'}
                onClick={() => setTimeRange('90days')}
                className="text-xs h-8"
              >
                90 Days
              </Button>
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {error && (
          <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20">
            <p className="text-sm text-red-400">{error}</p>
          </div>
        )}

        {/* Metrics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {metrics.map((metric, index) => (
            <div key={index} className="p-4 bg-neutral-900 rounded-lg border border-neutral-700">
              <p className="text-sm text-neutral-400 mb-1">{metric.label}</p>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-bold text-white">
                  {metric.value != null ? `${metric.value}%` : '—'}
                </span>
                {metric.change && (
                  <span
                    className={`text-sm ${metric.change.startsWith('+') ? 'text-green-400' : 'text-red-400'}`}
                    title="Change vs the previous period of the same length"
                  >
                    {metric.change}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Chart */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm text-neutral-400 px-2">
            <span>Average Occupancy Rate {loading && '(loading...)'}</span>
            <span>100%</span>
          </div>
          <div className="relative h-64 bg-neutral-900 rounded-lg border border-neutral-700 p-4">
            <div className="h-full flex items-end justify-around gap-2">
              {chartData.map((item, index) => {
                const hasData = item.occupancy != null;
                const isHighOccupancy = hasData && item.occupancy >= 90;

                return (
                  <div key={index} className="flex-1 flex flex-col items-center gap-2 h-full">
                    <div className="w-full relative group flex items-end justify-center h-full">
                      {hasData ? (
                        <div
                          className={`w-full rounded-t-lg transition-all ${isHighOccupancy
                            ? 'bg-gradient-to-t from-red-600 to-red-400'
                            : 'bg-gradient-to-t from-blue-600 to-blue-400'
                            }`}
                          style={{ height: `${item.occupancy}%`, minHeight: item.occupancy === 0 ? '0px' : '4px' }}
                        >
                        </div>
                      ) : (
                        <span className="text-xs text-neutral-600 mb-2">No data</span>
                      )}
                    </div>
                    <div className="flex flex-col items-center mt-1 text-center">
                      <span className="text-xs text-neutral-400">{item.day}</span>
                      <span className="text-xs font-medium text-white">{hasData ? `${item.occupancy}%` : '—'}</span>
                    </div>
                  </div>
                );
              })}
            </div>
            {/* Grid lines */}
            <div className="absolute inset-0 flex flex-col justify-between pointer-events-none p-4">
              {[0, 25, 50, 75, 100].map((line) => (
                <div key={line} className="border-t border-neutral-700/30" />
              ))}
            </div>
          </div>
          <div className="flex items-center gap-4 text-xs text-neutral-400 px-2">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded bg-gradient-to-t from-blue-600 to-blue-400" />
              <span>Normal (&lt;90%)</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded bg-gradient-to-t from-red-600 to-red-400" />
              <span>High (≥90%)</span>
            </div>
            {timeline?.method && (
              <span className="ml-auto italic">
                {timeline.method}
                {timeline.historyStart
                  ? ` · history recorded since ${new Date(timeline.historyStart).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`
                  : ' · no occupancy history recorded yet'}
              </span>
            )}
          </div>
        </div>

        {/* Insights */}
        {dynamicInsights.length > 0 && (
          <div className="p-4 bg-purple-500/10 border border-purple-500/30 rounded-lg">
            <h4 className="font-semibold text-purple-400 mb-2 flex items-center gap-2">
              <Calendar className="w-4 h-4" />
              Key Insights
            </h4>
            <ul className="space-y-1 text-md text-slate-300 text-left">
              {dynamicInsights.map((insight, index) => (
                <li key={index}>• {insight}</li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default OccupancyTrendsChart;
