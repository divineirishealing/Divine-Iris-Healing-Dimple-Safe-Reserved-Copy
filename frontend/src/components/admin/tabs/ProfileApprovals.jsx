import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useToast } from '../../../hooks/use-toast';
import { Button } from '../../ui/button';
import { Check, X, User } from 'lucide-react';

const API = process.env.REACT_APP_BACKEND_URL;

const ProfileApprovals = () => {
  const [requests, setRequests] = useState([]);
  const { toast } = useToast();

  const loadRequests = () => {
    axios.get(`${API}/api/admin/clients/approvals`)
      .then(res => setRequests(res.data))
      .catch(err => console.error(err));
  };

  useEffect(() => { loadRequests(); }, []);

  const handleAction = async (id, action) => {
    try {
      await axios.post(`${API}/api/admin/clients/${action}/${id}`);
      toast({ title: `Profile ${action}d` });
      loadRequests();
    } catch (err) {
      toast({ title: 'Error', variant: 'destructive' });
    }
  };

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold text-gray-900">Pending Profile Updates</h2>
      
      {requests.length === 0 && (
        <div className="text-center py-8 text-gray-400 border rounded-lg bg-gray-50">
          No pending approvals.
        </div>
      )}

      {requests.map(req => (
        <div key={req.id} className="bg-white border rounded-lg p-4 shadow-sm flex items-start gap-4">
          <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center shrink-0">
            <User size={20} className="text-gray-500" />
          </div>
          <div className="flex-1">
            <h3 className="font-semibold text-gray-900">{req.name} <span className="text-xs font-normal text-gray-500">({req.email})</span></h3>
            <div className="mt-2 grid grid-cols-2 gap-2 text-sm bg-amber-50 p-3 rounded border border-amber-100">
              {Object.entries(req.pending_profile_update || {}).map(([key, val]) => (
                <div key={key}>
                  <span className="text-amber-800 font-medium capitalize">{key.replace(/_/g, ' ')}:</span> 
                  <span className="ml-2 text-gray-700">{val}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <Button size="sm" className="bg-green-600 hover:bg-green-700" onClick={() => handleAction(req.id, 'approve')}>
              <Check size={14} className="mr-1" /> Approve
            </Button>
            <Button size="sm" variant="outline" className="text-red-600 border-red-200 hover:bg-red-50" onClick={() => handleAction(req.id, 'reject')}>
              <X size={14} className="mr-1" /> Reject
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
};

export default ProfileApprovals;
