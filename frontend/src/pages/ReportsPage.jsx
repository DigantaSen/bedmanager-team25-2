import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from '@/components/ui/select';
import { FileText, Download, Mail, Trash2, Clock, CheckCircle, AlertCircle } from 'lucide-react';
import api from '@/services/api';

const ReportsPage = () => {
  const [reportType, setReportType] = useState('comprehensive');
  const [dateRange, setDateRange] = useState('last7days');
  const [format, setFormat] = useState('pdf');
  const [email, setEmail] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [isEmailing, setIsEmailing] = useState(false);
  const [reportHistory, setReportHistory] = useState([]);
  const [schedules, setSchedules] = useState([]);
  const [message, setMessage] = useState(null);

  useEffect(() => {
    fetchReportHistory();
    fetchSchedules();
  }, []);

  const fetchReportHistory = async () => {
    try {
      const response = await api.get('/reports/history');
      setReportHistory(response.data.data);
    } catch (error) {
      console.error('Error fetching report history:', error);
    }
  };

  const fetchSchedules = async () => {
    try {
      const response = await api.get('/reports/schedules');
      setSchedules(response.data.data);
    } catch (error) {
      console.error('Error fetching schedules:', error);
    }
  };

  const handleGenerateReport = async () => {
    setIsGenerating(true);
    setMessage(null);
    
    try {
      const endpoint = format === 'pdf' ? '/reports/generate/pdf' : '/reports/generate/csv';
      
      const response = await api.post(endpoint, {
        reportType,
        dateRange,
        wards: []
      }, {
        responseType: 'blob'
      });

      // Create download link
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `report_${Date.now()}.${format}`);
      document.body.appendChild(link);
      link.click();
      link.remove();

      setMessage({ type: 'success', text: 'Report generated and downloaded successfully!' });
      fetchReportHistory();
    } catch (error) {
      console.error('Error generating report:', error);
      setMessage({ type: 'error', text: 'Failed to generate report. Please try again.' });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleEmailReport = async () => {
    if (!email) {
      setMessage({ type: 'error', text: 'Please enter an email address' });
      return;
    }

    setIsEmailing(true);
    setMessage(null);

    try {
      await api.post('/reports/email', {
        reportType,
        dateRange,
        wards: [],
        email,
        format
      });

      setMessage({ type: 'success', text: `Report sent to ${email} successfully!` });
      setEmail('');
    } catch (error) {
      console.error('Error emailing report:', error);
      setMessage({ type: 'error', text: 'Failed to email report. Please check email configuration.' });
    } finally {
      setIsEmailing(false);
    }
  };

  const handleDownloadFromHistory = async (fileName) => {
    try {
      const response = await api.get(`/reports/download/${fileName}`, {
        responseType: 'blob'
      });

      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', fileName);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (error) {
      console.error('Error downloading report:', error);
      setMessage({ type: 'error', text: 'Failed to download report' });
    }
  };

  const handleDeleteReport = async (fileName) => {
    if (!confirm('Are you sure you want to delete this report?')) return;

    try {
      await api.delete(`/reports/${fileName}`);
      setMessage({ type: 'success', text: 'Report deleted successfully' });
      fetchReportHistory();
    } catch (error) {
      console.error('Error deleting report:', error);
      setMessage({ type: 'error', text: 'Failed to delete report' });
    }
  };

  const handleToggleSchedule = async (scheduleId, enabled) => {
    try {
      await api.put(`/reports/schedules/${scheduleId}`, { enabled: !enabled });
      setMessage({ type: 'success', text: `Schedule ${!enabled ? 'enabled' : 'disabled'} successfully` });
      fetchSchedules();
    } catch (error) {
      console.error('Error toggling schedule:', error);
      setMessage({ type: 'error', text: 'Failed to update schedule' });
    }
  };

  const handleRunScheduleNow = async (scheduleId) => {
    try {
      setMessage({ type: 'info', text: 'Running scheduled report...' });
      await api.post(`/reports/schedules/${scheduleId}/run`);
      setMessage({ type: 'success', text: 'Scheduled report executed successfully' });
      fetchReportHistory();
    } catch (error) {
      console.error('Error running schedule:', error);
      setMessage({ type: 'error', text: 'Failed to run scheduled report' });
    }
  };

  const formatFileSize = (bytes) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
  };

  const reportTypes = [
    { value: 'comprehensive', label: 'Comprehensive Report' },
    { value: 'occupancy', label: 'Occupancy Report' },
    { value: 'financial', label: 'Financial Report' },
    { value: 'performance', label: 'Performance Report' }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold text-white">Report Management</h1>
        </div>

        {/* Message Alert */}
        {message && (
          <div className={`p-4 rounded-lg border ${
            message.type === 'success' ? 'bg-green-500/10 border-green-500/30 text-green-400' :
            message.type === 'error' ? 'bg-red-500/10 border-red-500/30 text-red-400' :
            'bg-blue-500/10 border-blue-500/30 text-blue-400'
          }`}>
            <div className="flex items-center gap-2">
              {message.type === 'success' && <CheckCircle className="w-5 h-5" />}
              {message.type === 'error' && <AlertCircle className="w-5 h-5" />}
              {message.type === 'info' && <Clock className="w-5 h-5" />}
              <span>{message.text}</span>
            </div>
          </div>
        )}

        {/* Report Generator */}
        <Card className="bg-slate-800/50 border-slate-700">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-xl text-white">
              <FileText className="w-5 h-5 text-blue-400" />
              Generate Report
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <Label className="text-slate-300">Report Type</Label>
                <Select value={reportType} onValueChange={setReportType}>
                  <SelectTrigger className="border-slate-600 bg-slate-900/50 text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {reportTypes.map(type => (
                      <SelectItem key={type.value} value={type.value}>
                        {type.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="text-slate-300">Date Range</Label>
                <Select value={dateRange} onValueChange={setDateRange}>
                  <SelectTrigger className="border-slate-600 bg-slate-900/50 text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="today">Today</SelectItem>
                    <SelectItem value="yesterday">Yesterday</SelectItem>
                    <SelectItem value="last7days">Last 7 Days</SelectItem>
                    <SelectItem value="last30days">Last 30 Days</SelectItem>
                    <SelectItem value="last90days">Last 90 Days</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="text-slate-300">Format</Label>
                <Select value={format} onValueChange={setFormat}>
                  <SelectTrigger className="border-slate-600 bg-slate-900/50 text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pdf">PDF</SelectItem>
                    <SelectItem value="csv">CSV</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex gap-3">
              <Button
                onClick={handleGenerateReport}
                disabled={isGenerating}
                className="flex-1 bg-blue-600 hover:bg-blue-700"
              >
                {isGenerating ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent mr-2" />
                    Generating...
                  </>
                ) : (
                  <>
                    <Download className="w-4 h-4 mr-2" />
                    Download Report
                  </>
                )}
              </Button>
            </div>

            <div className="border-t border-slate-700 pt-4 mt-4">
              <Label className="text-slate-300 mb-2 block">Email Report</Label>
              <div className="flex gap-3">
                <Input
                  type="email"
                  placeholder="Enter email address"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="flex-1 border-slate-600 bg-slate-900/50 text-white"
                />
                <Button
                  onClick={handleEmailReport}
                  disabled={isEmailing || !email}
                  className="bg-green-600 hover:bg-green-700"
                >
                  {isEmailing ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent mr-2" />
                      Sending...
                    </>
                  ) : (
                    <>
                      <Mail className="w-4 h-4 mr-2" />
                      Send Email
                    </>
                  )}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Report History */}
        <Card className="bg-slate-800/50 border-slate-700">
          <CardHeader>
            <CardTitle className="text-lg text-white">Report History</CardTitle>
          </CardHeader>
          <CardContent>
            {reportHistory.length === 0 ? (
              <div className="text-center py-8 text-slate-400">
                <FileText className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p>No reports generated yet</p>
              </div>
            ) : (
              <div className="space-y-3">
                {reportHistory.map((report) => (
                  <div
                    key={report.fileName}
                    className="flex items-center justify-between p-4 rounded-lg bg-slate-900/50 border border-slate-700 hover:border-slate-600 transition-all"
                  >
                    <div className="flex items-center gap-3">
                      <FileText className="w-5 h-5 text-blue-400" />
                      <div>
                        <p className="font-medium text-white">{report.fileName}</p>
                        <p className="text-xs text-slate-400">
                          {new Date(report.createdAt).toLocaleString()} • {formatFileSize(report.size)} • {report.type}
                        </p>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        className="border-slate-600 hover:bg-slate-700"
                        onClick={() => handleDownloadFromHistory(report.fileName)}
                      >
                        <Download className="w-4 h-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="border-slate-600 hover:bg-red-900/20 hover:border-red-600"
                        onClick={() => handleDeleteReport(report.fileName)}
                      >
                        <Trash2 className="w-4 h-4 text-red-400" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Scheduled Reports */}
        <Card className="bg-slate-800/50 border-slate-700">
          <CardHeader>
            <CardTitle className="text-lg text-white flex items-center gap-2">
              <Clock className="w-5 h-5 text-purple-400" />
              Scheduled Reports
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {schedules.map((schedule) => (
                <div
                  key={schedule.id}
                  className="flex items-center justify-between p-4 rounded-lg bg-slate-900/50 border border-slate-700"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-3">
                      <h4 className="font-medium text-white">{schedule.name}</h4>
                      <span className={`text-xs px-2 py-1 rounded ${
                        schedule.enabled ? 'bg-green-500/20 text-green-400' : 'bg-slate-700 text-slate-400'
                      }`}>
                        {schedule.enabled ? 'Active' : 'Inactive'}
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 mt-1">
                      Schedule: {schedule.schedule}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      className="border-slate-600 hover:bg-slate-700"
                      onClick={() => handleRunScheduleNow(schedule.id)}
                    >
                      Run Now
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className={`border-slate-600 ${
                        schedule.enabled ? 'hover:bg-red-900/20' : 'hover:bg-green-900/20'
                      }`}
                      onClick={() => handleToggleSchedule(schedule.id, schedule.enabled)}
                    >
                      {schedule.enabled ? 'Disable' : 'Enable'}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default ReportsPage;
