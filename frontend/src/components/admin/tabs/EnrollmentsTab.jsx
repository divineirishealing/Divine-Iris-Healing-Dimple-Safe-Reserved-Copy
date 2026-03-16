import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useToast } from '../../../hooks/use-toast';
import { FileSpreadsheet, Download, Search, Users } from 'lucide-react';
import { Input } from '../../ui/input';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const STATUS_MAP = {
  completed: { label: 'Completed', color: 'bg-green-100 text-green-700' },
  pending: { label: 'Pending', color: 'bg-yellow-100 text-yellow-700' },
  india_payment_proof_submitted: { label: 'Proof Submitted', color: 'bg-blue-100 text-blue-700' },
  india_payment_rejected: { label: 'Rejected', color: 'bg-red-100 text-red-700' },
};

const EnrollmentsTab = () => {
  const { toast } = useToast();
  const [enrollments, setEnrollments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  useEffect(() => {
    loadEnrollments();
  }, []);

  const loadEnrollments = async () => {
    try {
      const r = await axios.get(`${API}/india-payments/admin/enrollments`);
      setEnrollments(r.data);
    } catch {
      toast({ title: 'Failed to load enrollments', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const handleExport = async () => {
    try {
      const r = await axios.get(`${API}/india-payments/admin/enrollments/export`, { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([r.data]));
      const a = document.createElement('a');
      a.href = url;
      a.download = `enrollments_${new Date().toISOString().split('T')[0]}.xlsx`;
      a.click();
      window.URL.revokeObjectURL(url);
      toast({ title: 'Excel downloaded!' });
    } catch {
      toast({ title: 'Export failed', variant: 'destructive' });
    }
  };

  const filtered = enrollments.filter(e => {
    const matchSearch = !search || [e.id, e.booker_name, e.booker_email, e.item_title]
      .filter(Boolean).some(f => f.toLowerCase().includes(search.toLowerCase()));
    const matchStatus = statusFilter === 'all' || e.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const statusCounts = {
    all: enrollments.length,
    completed: enrollments.filter(e => e.status === 'completed').length,
    pending: enrollments.filter(e => !e.status || e.status === 'pending').length,
    india_payment_proof_submitted: enrollments.filter(e => e.status === 'india_payment_proof_submitted').length,
  };

  return (
    <div data-testid="enrollments-tab">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <FileSpreadsheet size={18} className="text-[#D4AF37]" />
          <h2 className="text-lg font-semibold text-gray-900">Enrollments</h2>
          <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full font-medium">
            {enrollments.length} total
          </span>
        </div>
        <button onClick={handleExport} data-testid="export-enrollments"
          className="flex items-center gap-1.5 text-[10px] px-4 py-2 rounded-full bg-green-600 text-white hover:bg-green-700 transition-colors font-medium">
          <Download size={12} /> Download Excel
        </button>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 mb-4">
        <div className="relative flex-1 max-w-xs">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <Input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search by name, email, ID..." className="pl-9 text-xs h-9" data-testid="enrollment-search" />
        </div>
        <div className="flex gap-1">
          {Object.entries({ all: 'All', completed: 'Completed', pending: 'Pending', india_payment_proof_submitted: 'Proof Submitted' }).map(([k, v]) => (
            <button key={k} onClick={() => setStatusFilter(k)}
              className={`text-[10px] px-3 py-1 rounded-full transition-colors ${statusFilter === k ? 'bg-[#D4AF37] text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
              {v} ({statusCounts[k] || 0})
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      {loading ? (
        <div className="text-center py-12 text-gray-400 text-sm">Loading...</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-gray-400 text-sm">No enrollments found</div>
      ) : (
        <div className="overflow-x-auto border rounded-lg">
          <table className="w-full text-xs">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="text-left px-3 py-2 font-semibold text-gray-600">Receipt ID</th>
                <th className="text-left px-3 py-2 font-semibold text-gray-600">Booker</th>
                <th className="text-left px-3 py-2 font-semibold text-gray-600">Program</th>
                <th className="text-left px-3 py-2 font-semibold text-gray-600">Participants</th>
                <th className="text-left px-3 py-2 font-semibold text-gray-600">Status</th>
                <th className="text-left px-3 py-2 font-semibold text-gray-600">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {filtered.map(e => {
                const s = STATUS_MAP[e.status] || { label: e.status || 'Unknown', color: 'bg-gray-100 text-gray-600' };
                return (
                  <tr key={e.id} className="hover:bg-gray-50">
                    <td className="px-3 py-2.5 font-mono text-purple-700 font-medium">{e.id}</td>
                    <td className="px-3 py-2.5">
                      <p className="font-medium text-gray-900">{e.booker_name}</p>
                      <p className="text-gray-400">{e.booker_email}</p>
                    </td>
                    <td className="px-3 py-2.5">
                      <p className="text-gray-700">{e.item_title || '-'}</p>
                      <p className="text-gray-400 capitalize">{e.item_type || ''}</p>
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-1">
                        <Users size={12} className="text-gray-400" />
                        <span className="font-medium">{e.participant_count || e.participants?.length || 0}</span>
                      </div>
                      {e.participants?.map((p, i) => (
                        <p key={i} className="text-gray-400 text-[10px] truncate max-w-[150px]">{p.name}</p>
                      ))}
                    </td>
                    <td className="px-3 py-2.5">
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${s.color}`}>{s.label}</span>
                    </td>
                    <td className="px-3 py-2.5 text-gray-500">
                      {e.created_at ? new Date(e.created_at).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' }) : '-'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default EnrollmentsTab;
