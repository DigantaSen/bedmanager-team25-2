import React, { useState, useMemo } from 'react';
import { Search, ArrowUpDown, ArrowUp, ArrowDown, User, Clock, Bed } from 'lucide-react';

const OccupantTable = ({ beds, onSelectBed }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [sortField, setSortField] = useState('bedId');
  const [sortDirection, setSortDirection] = useState('asc');
  const [wardFilter, setWardFilter] = useState('all');

  // Get unique wards from beds
  const wards = useMemo(() => {
    const uniqueWards = [...new Set(beds.map(bed => bed.ward))];
    return uniqueWards.sort();
  }, [beds]);

  // Filter and sort beds
  const filteredAndSortedBeds = useMemo(() => {
    let result = [...beds];

    // Apply search filter
    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase();
      result = result.filter(bed => 
        bed.bedId.toLowerCase().includes(searchLower) ||
        bed.patientName?.toLowerCase().includes(searchLower) ||
        bed.patientId?.toLowerCase().includes(searchLower) ||
        bed.ward.toLowerCase().includes(searchLower)
      );
    }

    // Apply ward filter
    if (wardFilter !== 'all') {
      result = result.filter(bed => bed.ward === wardFilter);
    }

    // Apply sorting
    result.sort((a, b) => {
      let aValue = a[sortField];
      let bValue = b[sortField];

      // Handle nested timeInBed.days
      if (sortField === 'timeInBed') {
        aValue = a.timeInBed?.days || 0;
        bValue = b.timeInBed?.days || 0;
      }

      // Handle string comparison
      if (typeof aValue === 'string' && typeof bValue === 'string') {
        return sortDirection === 'asc' 
          ? aValue.localeCompare(bValue)
          : bValue.localeCompare(aValue);
      }

      // Handle number comparison
      if (sortDirection === 'asc') {
        return aValue > bValue ? 1 : -1;
      } else {
        return aValue < bValue ? 1 : -1;
      }
    });

    return result;
  }, [beds, searchTerm, sortField, sortDirection, wardFilter]);

  const handleSort = (field) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const SortIcon = ({ field }) => {
    if (sortField !== field) {
      return <ArrowUpDown className="w-4 h-4 text-zinc-500" />;
    }
    return sortDirection === 'asc' 
      ? <ArrowUp className="w-4 h-4 text-cyan-500" />
      : <ArrowDown className="w-4 h-4 text-cyan-500" />;
  };

  return (
    <div className="space-y-4">
      {/* Search and Filter Bar */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-zinc-500" />
          <input
            type="text"
            placeholder="Search by bed ID, patient name, or patient ID..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white placeholder-zinc-500 focus:outline-none focus:border-cyan-500 transition-colors"
          />
        </div>
        
        <select
          value={wardFilter}
          onChange={(e) => setWardFilter(e.target.value)}
          className="px-4 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white focus:outline-none focus:border-cyan-500 transition-colors"
        >
          <option value="all">All Wards</option>
          {wards.map(ward => (
            <option key={ward} value={ward}>{ward}</option>
          ))}
        </select>
      </div>

      {/* Results Count */}
      <div className="text-sm text-zinc-400">
        Showing {filteredAndSortedBeds.length} of {beds.length} occupied beds
      </div>

      {/* Table */}
      <div className="overflow-x-auto bg-zinc-900 border border-zinc-800 rounded-lg">
        <table className="w-full">
          <thead>
            <tr className="border-b border-zinc-800">
              <th 
                className="text-left px-6 py-4 text-zinc-400 font-semibold cursor-pointer hover:text-cyan-500 transition-colors"
                onClick={() => handleSort('bedId')}
              >
                <div className="flex items-center gap-2">
                  <Bed className="w-4 h-4" />
                  Bed ID
                  <SortIcon field="bedId" />
                </div>
              </th>
              <th 
                className="text-left px-6 py-4 text-zinc-400 font-semibold cursor-pointer hover:text-cyan-500 transition-colors"
                onClick={() => handleSort('ward')}
              >
                <div className="flex items-center gap-2">
                  Ward
                  <SortIcon field="ward" />
                </div>
              </th>
              <th 
                className="text-left px-6 py-4 text-zinc-400 font-semibold cursor-pointer hover:text-cyan-500 transition-colors"
                onClick={() => handleSort('patientName')}
              >
                <div className="flex items-center gap-2">
                  <User className="w-4 h-4" />
                  Patient Name
                  <SortIcon field="patientName" />
                </div>
              </th>
              <th className="text-left px-6 py-4 text-zinc-400 font-semibold">
                Patient ID
              </th>
              <th 
                className="text-left px-6 py-4 text-zinc-400 font-semibold cursor-pointer hover:text-cyan-500 transition-colors"
                onClick={() => handleSort('timeInBed')}
              >
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4" />
                  Time in Bed
                  <SortIcon field="timeInBed" />
                </div>
              </th>
              <th className="text-left px-6 py-4 text-zinc-400 font-semibold">
                Admission Time
              </th>
              <th className="text-left px-6 py-4 text-zinc-400 font-semibold">
                Actions
              </th>
            </tr>
          </thead>
          <tbody>
            {filteredAndSortedBeds.length === 0 ? (
              <tr>
                <td colSpan="7" className="px-6 py-8 text-center text-zinc-500">
                  {searchTerm || wardFilter !== 'all' 
                    ? 'No beds match your search criteria'
                    : 'No occupied beds found'}
                </td>
              </tr>
            ) : (
              filteredAndSortedBeds.map((bed) => (
                <tr 
                  key={bed._id} 
                  className="border-b border-zinc-800 hover:bg-zinc-800/50 transition-colors"
                >
                  <td className="px-6 py-4">
                    <span className="text-cyan-500 font-mono font-bold">
                      {bed.bedId}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <span className="px-3 py-1 bg-blue-500/10 text-blue-500 rounded-full text-sm font-semibold">
                      {bed.ward}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-white">
                    {bed.patientName || <span className="text-zinc-500 italic">N/A</span>}
                  </td>
                  <td className="px-6 py-4 text-zinc-300 font-mono text-sm">
                    {bed.patientId || <span className="text-zinc-500 italic">N/A</span>}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex flex-col">
                      <span className="text-white font-semibold">
                        {bed.timeInBed?.formatted || 'N/A'}
                      </span>
                      <span className="text-xs text-zinc-500">
                        {bed.timeInBed?.days ? `${bed.timeInBed.days} days` : ''}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-zinc-400 text-sm">
                    {bed.admissionTime 
                      ? new Date(bed.admissionTime).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        })
                      : 'N/A'}
                  </td>
                  <td className="px-6 py-4">
                    <button
                      onClick={() => onSelectBed(bed)}
                      className="px-4 py-2 bg-cyan-500/10 text-cyan-500 rounded-lg hover:bg-cyan-500/20 transition-colors font-semibold text-sm"
                    >
                      View Details
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default OccupantTable;
