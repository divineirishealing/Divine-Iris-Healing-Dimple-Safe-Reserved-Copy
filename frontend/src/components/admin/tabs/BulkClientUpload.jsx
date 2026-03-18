import React, { useState } from 'react';
import axios from 'axios';
import { useToast } from '../../../hooks/use-toast';
import { Button } from '../../ui/button';
import { Upload, FileText, Loader2 } from 'lucide-react';

const API = process.env.REACT_APP_BACKEND_URL;

const BulkClientUpload = () => {
  const { toast } = useToast();
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [stats, setStats] = useState(null);

  const handleUpload = async () => {
    if (!file) return;
    setUploading(true);
    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await axios.post(`${API}/api/admin/clients/upload-bulk`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      setStats(res.data.stats);
      toast({ title: 'Upload Complete', description: `Created: ${res.data.stats.created}, Updated: ${res.data.stats.updated}` });
    } catch (err) {
      toast({ title: 'Upload Failed', description: err.response?.data?.detail, variant: 'destructive' });
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white p-6 rounded-lg border shadow-sm">
        <h3 className="font-semibold text-gray-900 mb-2">Bulk Client Upload</h3>
        <p className="text-sm text-gray-500 mb-4">
          Upload Excel/CSV to create or update clients. <br/>
          <strong>Columns:</strong> Name, Email, Phone, City, Tier, Program, Payment Status, EMI Plan, Notes.
        </p>

        <div className="flex gap-4 items-end">
          <div className="flex-1">
            <label className="block text-xs font-medium text-gray-700 mb-1">Select File</label>
            <input 
              type="file" 
              accept=".csv, .xlsx, .xls"
              onChange={e => setFile(e.target.files[0])}
              className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-purple-50 file:text-purple-700 hover:file:bg-purple-100"
            />
          </div>
          <Button onClick={handleUpload} disabled={uploading || !file} className="bg-[#D4AF37] hover:bg-[#b8962e]">
            {uploading ? <Loader2 size={16} className="animate-spin mr-2" /> : <Upload size={16} className="mr-2" />}
            Upload Database
          </Button>
        </div>

        {stats && (
          <div className="mt-4 p-4 bg-gray-50 rounded border text-sm">
            <p className="font-semibold text-green-600">Results:</p>
            <ul className="list-disc pl-5 mt-1 space-y-1 text-gray-600">
              <li>New Clients Created: {stats.created}</li>
              <li>Existing Updated: {stats.updated}</li>
              {stats.errors.length > 0 && (
                <li className="text-red-600">Errors: {stats.errors.length} (Check console/logs)</li>
              )}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
};

export default BulkClientUpload;
