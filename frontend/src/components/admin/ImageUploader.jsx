import React, { useState, useRef } from 'react';
import axios from 'axios';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Upload, X, Image as ImageIcon } from 'lucide-react';
import { useToast } from '../../hooks/use-toast';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

function resolveUrl(url) {
  if (!url) return '';
  if (url.startsWith('/api/image/')) return `${BACKEND_URL}${url}`;
  return url;
}

const ImageUploader = ({ value, onChange, label = "Image" }) => {
  const [uploading, setUploading] = useState(false);
  const [useUrl, setUseUrl] = useState(false);
  const [urlInput, setUrlInput] = useState(value || '');
  const { toast } = useToast();
  const fileInputRef = useRef(null);

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      toast({ title: 'File too large', description: 'Please select an image smaller than 5MB', variant: 'destructive' });
      return;
    }

    if (!file.type.startsWith('image/')) {
      toast({ title: 'Invalid file type', description: 'Please select an image file (JPG, PNG, GIF, WebP)', variant: 'destructive' });
      return;
    }

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const response = await axios.post(`${API}/upload/image`, formData, { headers: { 'Content-Type': 'multipart/form-data' } });
      onChange(response.data.url);
      toast({ title: 'Image uploaded successfully!' });
    } catch (error) {
      toast({ title: 'Upload failed', description: error.response?.data?.detail || 'Failed to upload image', variant: 'destructive' });
    } finally {
      setUploading(false);
    }
  };

  const handleUrlSubmit = () => {
    if (urlInput.trim()) {
      onChange(urlInput.trim());
      toast({ title: 'Image URL added' });
    }
  };

  const handleRemove = () => {
    onChange('');
    setUrlInput('');
  };

  const triggerFileSelect = () => {
    if (fileInputRef.current && !uploading) {
      fileInputRef.current.click();
    }
  };

  return (
    <div className="space-y-3">
      <label className="text-sm font-medium text-gray-700">{label}</label>

      <div className="flex gap-2 mb-3">
        <Button type="button" size="sm" variant={!useUrl ? 'default' : 'outline'} onClick={() => setUseUrl(false)} className="flex-1">
          <Upload size={16} className="mr-2" /> Upload Image
        </Button>
        <Button type="button" size="sm" variant={useUrl ? 'default' : 'outline'} onClick={() => setUseUrl(true)} className="flex-1">
          <ImageIcon size={16} className="mr-2" /> Use URL
        </Button>
      </div>

      {!useUrl ? (
        <div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleFileUpload}
            disabled={uploading}
            style={{ display: 'none' }}
          />
          <div
            onClick={triggerFileSelect}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') triggerFileSelect(); }}
            className={`border-2 border-dashed border-gray-300 rounded-lg p-6 flex flex-col items-center justify-center cursor-pointer hover:border-yellow-500 transition-colors ${
              uploading ? 'opacity-50 cursor-not-allowed' : ''
            }`}
          >
            {uploading ? (
              <div className="text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-yellow-600 mx-auto mb-3"></div>
                <p className="text-sm text-gray-600">Uploading...</p>
              </div>
            ) : (
              <>
                <Upload size={40} className="text-gray-400 mb-3" />
                <p className="text-sm text-gray-600 mb-1">Click to upload or drag and drop</p>
                <p className="text-xs text-gray-500">JPG, PNG, GIF, WebP (max 5MB)</p>
              </>
            )}
          </div>
        </div>
      ) : (
        <div className="flex gap-2">
          <Input type="url" placeholder="https://example.com/image.jpg" value={urlInput} onChange={(e) => setUrlInput(e.target.value)} className="flex-1" />
          <Button type="button" onClick={handleUrlSubmit}>Set URL</Button>
        </div>
      )}

      {value && (
        <div className="relative">
          <img src={resolveUrl(value)} alt="Preview" className="w-full h-48 object-cover rounded-lg border-2 border-gray-200" onError={(e) => { e.target.src = 'https://via.placeholder.com/400x300?text=Image+Not+Found'; }} />
          <button type="button" onClick={handleRemove} className="absolute top-2 right-2 bg-red-500 text-white rounded-full p-2 hover:bg-red-600 transition-colors shadow-lg">
            <X size={16} />
          </button>
          <div className="mt-2 p-2 bg-gray-50 rounded text-xs text-gray-600 break-all">{value}</div>
        </div>
      )}
    </div>
  );
};

export default ImageUploader;
