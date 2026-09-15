import React, { useState, useEffect, useCallback } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { fetchBeds } from '@/features/beds/bedsSlice';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from '@/components/ui/select';
import { Calendar } from 'lucide-react';
import { FileText, Download, Mail, Printer, CheckCircle } from 'lucide-react';
import api from '@/services/api';

const reportTypes = [
  { value: 'comprehensive', label: 'Comprehensive Report', description: 'Occupancy over the period, admissions, discharges and cleaning' },
  { value: 'occupancy', label: 'Occupancy Report', description: 'Average, peak and lowest occupancy for the period' },
  { value: 'performance', label: 'Performance Report', description: 'Admissions, discharges, length of stay and cleaning times' },
];

const formatFileSize = (bytes) => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const saveBlob = (blob, fileName) => {
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', fileName);
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
};

const ReportGenerator = () => {
  const dispatch = useDispatch();
  const { bedsList, status } = useSelector((state) => state.beds);
  const [reportType, setReportType] = useState('comprehensive');
  const [dateRange, setDateRange] = useState('last7days');
  const [selectedWards, setSelectedWards] = useState([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isPrinting, setIsPrinting] = useState(false);
  const [reportGenerated, setReportGenerated] = useState(false);
  const [reportHistory, setReportHistory] = useState([]);
  const [historyError, setHistoryError] = useState(null);
  const [emailAddress, setEmailAddress] = useState('');
  const [isEmailing, setIsEmailing] = useState(false);
  const [emailFormat, setEmailFormat] = useState('pdf');

  useEffect(() => {
    if (status === 'idle') {
      dispatch(fetchBeds());
    }
  }, [dispatch, status]);

  // Reports saved on the server
  const fetchReportHistory = useCallback(async () => {
    try {
      setHistoryError(null);
      const response = await api.get('/reports/history', { params: { limit: 10 } });
      setReportHistory(response.data.data || []);
    } catch (error) {
      console.error('Error loading report history:', error);
      setHistoryError('Failed to load report history');
    }
  }, []);

  useEffect(() => {
    fetchReportHistory();

    // Load cached email address
    const cachedEmail = localStorage.getItem('reportEmailAddress');
    if (cachedEmail) {
      setEmailAddress(cachedEmail);
    }
  }, [fetchReportHistory]);

  const wards = ['All Wards', ...new Set(bedsList.map(bed => bed.ward))];

  const getReportRequest = () => ({
    reportType,
    dateRange,
    wards: selectedWards.length > 0 && !selectedWards.includes('All Wards') ? selectedWards : []
  });

  const requestPdf = async () => {
    const response = await api.post('/reports/generate/pdf', getReportRequest(), { responseType: 'blob' });
    return new Blob([response.data], { type: 'application/pdf' });
  };

  const handleGenerateReport = async () => {
    setIsGenerating(true);
    try {
      const pdf = await requestPdf();
      saveBlob(pdf, `report_${Date.now()}.pdf`);
      setReportGenerated(true);
      setTimeout(() => setReportGenerated(false), 3000);
      fetchReportHistory();
    } catch (error) {
      console.error('Error generating report:', error);
      alert('Failed to generate report. Please try again.');
    } finally {
      setIsGenerating(false);
    }
  };

  const handlePrintReport = async () => {
    // Open the window before the request so pop-up blockers allow it
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      alert('Please allow pop-ups to print the report');
      return;
    }

    setIsPrinting(true);
    try {
      const pdf = await requestPdf();
      printWindow.location.href = window.URL.createObjectURL(pdf);
      fetchReportHistory();
    } catch (error) {
      console.error('Error preparing report for printing:', error);
      printWindow.close();
      alert('Failed to prepare the report for printing.');
    } finally {
      setIsPrinting(false);
    }
  };

  const handleDownloadCsv = async () => {
    try {
      const response = await api.post('/reports/generate/csv', getReportRequest(), { responseType: 'blob' });
      saveBlob(new Blob([response.data], { type: 'text/csv' }), `report_${Date.now()}.csv`);
      fetchReportHistory();
    } catch (error) {
      console.error('Error downloading CSV:', error);
      alert('Failed to download CSV report');
    }
  };

  const downloadSavedReport = async (report) => {
    try {
      const response = await api.get(`/reports/download/${report.fileName}`, { responseType: 'blob' });
      saveBlob(new Blob([response.data]), report.fileName);
    } catch (error) {
      console.error('Error downloading report:', error);
      alert('Failed to download report');
    }
  };

  const deleteSavedReport = async (report) => {
    try {
      await api.delete(`/reports/${report.fileName}`);
      fetchReportHistory();
    } catch (error) {
      console.error('Error deleting report:', error);
      alert('Failed to delete report');
    }
  };

  const toggleWard = (ward) => {
    setSelectedWards((prev) =>
      prev.includes(ward) ? prev.filter((w) => w !== ward) : [...prev, ward]
    );
  };

  const handleEmailReport = async () => {
    if (!emailAddress) {
      alert('Please enter an email address');
      return;
    }

    if (!emailAddress.includes('@')) {
      alert('Please enter a valid email address');
      return;
    }

    setIsEmailing(true);

    try {
      await api.post('/reports/email', {
        ...getReportRequest(),
        email: emailAddress,
        format: emailFormat
      });

      // Cache the email address for future use
      localStorage.setItem('reportEmailAddress', emailAddress);

      alert(`Report sent successfully to ${emailAddress}!`);
      fetchReportHistory();
    } catch (error) {
      console.error('Error sending email:', error);
      // The server refuses addresses that are not registered, approved accounts - show why
      alert(error.response?.data?.message || 'Failed to send email. Please check your email configuration in the backend.');
    } finally {
      setIsEmailing(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Report Configuration */}
      <Card className="bg-neutral-900 border-neutral-700">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-xl">
            <FileText className="w-5 h-5 text-blue-400" />
            Generate Report
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Report Type Selection */}
          <div className="space-y-4">
            <Label className="text-slate-300 block mt-2">Report Type</Label>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {reportTypes.map((type) => (
                <div
                  key={type.value}
                  onClick={() => setReportType(type.value)}
                  className={`p-4 rounded-lg border cursor-pointer transition-all ${reportType === type.value
                    ? 'border-blue-500 bg-blue-500/10'
                    : 'border-neutral-700 bg-neutral-900 hover:border-neutral-600'
                    }`}
                >
                  <div className="flex items-start justify-between text-left">
                    <div className="text-left">
                      <h4 className="font-semibold text-white mb-1 text-left">{type.label}</h4>
                      <p className="text-sm text-neutral-400 text-left">{type.description}</p>
                    </div>
                    {reportType === type.value && (
                      <CheckCircle className="w-5 h-5 text-blue-400" />
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Date Range */}
          <div className="space-y-4">
            <Label className="text-slate-300 block mt-2">Date Range</Label>
            <Select value={dateRange} onValueChange={setDateRange}>
              <SelectTrigger className="border-neutral-600">
                <Calendar className="w-4 h-4 mr-2" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="today">Today</SelectItem>
                <SelectItem value="yesterday">Yesterday</SelectItem>
                <SelectItem value="last7days">Last 7 Days</SelectItem>
                <SelectItem value="last30days">Last 30 Days</SelectItem>
                <SelectItem value="last90days">Last 90 Days</SelectItem>
                <SelectItem value="thisMonth">This Month</SelectItem>
                <SelectItem value="lastMonth">Last Month</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Ward Selection */}
          <div className="space-y-4">
            <Label className="text-slate-300 block mt-2">Select Wards</Label>
            <div className="grid grid-cols-2 gap-3">
              {wards.map((ward) => (
                <div
                  key={ward}
                  className="flex items-center space-x-2 p-3 rounded-lg bg-neutral-900 border border-neutral-700"
                >
                  <Checkbox
                    id={ward}
                    checked={selectedWards.includes(ward)}
                    onCheckedChange={() => toggleWard(ward)}
                    className="border-neutral-600"
                  />
                  <label
                    htmlFor={ward}
                    className="text-sm text-slate-300 cursor-pointer select-none"
                  >
                    {ward}
                  </label>
                </div>
              ))}
            </div>
          </div>

          {/* Generate Button */}
          <Button
            onClick={handleGenerateReport}
            disabled={isGenerating}
            className="w-full h-12 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white"
          >
            {isGenerating ? (
              <>
                <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent mr-2" />
                Generating Report...
              </>
            ) : reportGenerated ? (
              <>
                <CheckCircle className="w-5 h-5 mr-2" />
                Report Generated Successfully!
              </>
            ) : (
              <>
                <FileText className="w-5 h-5 mr-2" />
                Generate Report
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Email Report Section */}
      <Card className="bg-neutral-900 border-neutral-700">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Mail className="w-5 h-5 text-green-400" />
            Email Report
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label className="text-slate-300 mb-2 block">Email Address</Label>
              <Input
                type="email"
                placeholder="recipient@example.com"
                value={emailAddress}
                onChange={(e) => setEmailAddress(e.target.value)}
                className="border-neutral-600 bg-neutral-900 text-white"
                disabled={isEmailing}
              />
            </div>
            <div>
              <Label className="text-slate-300 mb-2 block">Format</Label>
              <Select value={emailFormat} onValueChange={setEmailFormat} disabled={isEmailing}>
                <SelectTrigger className="border-neutral-600 bg-neutral-900 text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pdf">PDF</SelectItem>
                  <SelectItem value="csv">CSV</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <Button
            onClick={handleEmailReport}
            disabled={isEmailing || !emailAddress}
            className="w-full bg-green-600 hover:bg-green-700 text-white"
          >
            {isEmailing ? (
              <>
                <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent mr-2" />
                Sending Email...
              </>
            ) : (
              <>
                <Mail className="w-5 h-5 mr-2" />
                Send Report via Email
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Quick Actions */}
      <Card className="bg-neutral-900 border-neutral-700">
        <CardHeader>
          <CardTitle className="text-lg">Quick Actions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Button
              variant="outline"
              className="h-auto flex-col gap-2 py-4 border-neutral-600 hover:bg-neutral-700"
              onClick={handleDownloadCsv}
            >
              <Download className="w-6 h-6 text-blue-400" />
              <span className="text-sm">Download CSV</span>
            </Button>
            <Button
              variant="outline"
              className="h-auto flex-col gap-2 py-4 border-neutral-600 hover:bg-neutral-700"
              onClick={handlePrintReport}
              disabled={isPrinting}
            >
              <Printer className="w-6 h-6 text-purple-400" />
              <span className="text-sm">{isPrinting ? 'Preparing...' : 'Print Report'}</span>
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Recent Reports (saved on the server) */}
      <Card className="bg-neutral-900 border-neutral-700">
        <CardHeader>
          <CardTitle className="text-lg">Recent Reports</CardTitle>
        </CardHeader>
        <CardContent>
          {historyError && (
            <p className="text-sm text-red-400 mb-3">{historyError}</p>
          )}
          {reportHistory.length === 0 ? (
            <div className="text-left py-8 text-neutral-400">
              <FileText className="w-12 h-12 mb-3 opacity-50" />
              <p>No reports generated yet</p>
              <p className="text-sm mt-1">Generate your first report to see it here</p>
            </div>
          ) : (
            <div className="space-y-3">
              {reportHistory.map((report) => (
                <div
                  key={report.fileName}
                  className="flex items-center justify-between p-4 rounded-lg bg-neutral-900 border border-neutral-700 hover:border-neutral-600 transition-all"
                >
                  <div className="flex items-center gap-3">
                    <FileText className="w-5 h-5 text-blue-400" />
                    <div>
                      <p className="font-medium text-white">{report.type} report</p>
                      <p className="text-xs text-neutral-400">
                        {new Date(report.createdAt).toLocaleString()} • {formatFileSize(report.size)}
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      className="border-neutral-600 hover:bg-neutral-700"
                      onClick={() => downloadSavedReport(report)}
                      title="Download report"
                    >
                      <Download className="w-4 h-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="border-neutral-600 hover:bg-red-900/20 hover:border-red-600"
                      onClick={() => deleteSavedReport(report)}
                      title="Delete report"
                    >
                      <span className="text-red-400">×</span>
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default ReportGenerator;
