import React, { useState, useRef, useEffect } from 'react';
import axios from 'axios';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Upload, X, Image as ImageIcon } from 'lucide-react';
import { useToast } from '../../hooks/use-toast';
import { resolveImageUrl } from '../../lib/imageUtils';
import { getApiUrl, isUploadApiReachable } from '../../lib/config';

function uploadReachable() {
  return isUploadApiReachable();
}

function uploadErrorMessage(error) {
  if (!uploadReachable()) {
    return 'Photo upload is not wired up: on Vercel set REACT_APP_BACKEND_URL to your **Render API** URL (https://….onrender.com), then redeploy the **frontend** so uploads hit the backend.';
  }
  const detail = error?.response?.data?.detail;
  if (typeof detail === 'string') {
    if (/temporary disk|ephemeral|durable storage|AWS S3|S3 is not|S3 upload failed|S3 is not enabled/i.test(detail)) {
      return detail;
    }
    if (/S3|AWS|AccessDenied|bucket|credentials/i.test(detail)) {
      return `${detail} — On the API host (e.g. Render backend), add AWS_S3_BUCKET, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, and AWS_REGION, then redeploy.`;
    }
    return detail;
  }
  if (error?.response?.status === 503) {
    return typeof detail === 'string'
      ? detail
      : 'Storage is not configured for persistent images. Configure AWS S3 on the API service (bucket, region, credentials) and redeploy.';
  }
  if (error?.code === 'ERR_NETWORK' || error?.message === 'Network Error') {
    return 'Your browser could not reach the API. Try again in a minute, or ask your host to check that the backend URL is correct and the backend has been redeployed.';
  }
  return error?.message || 'Upload failed. Please try again or use “Use URL” to paste an image link.';
}

const ImageUploader = ({ value, onChange, label = "Image" }) => {
  const [uploading, setUploading] = useState(false);
  const [useUrl, setUseUrl] = useState(false);
  const [urlInput, setUrlInput] = useState(value || '');
  const [dragOver, setDragOver] = useState(false);
  const { toast } = useToast();
  const fileInputRef = useRef(null);

  useEffect(() => {
    setUrlInput(value || '');
  }, [value]);

  const uploadFile = async (file) => {
    if (!file) return;
    if (!uploadReachable()) {
      toast({ title: 'Upload not available', description: uploadErrorMessage(null), variant: 'destructive' });
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast({ title: 'File too large', description: 'Max 10MB', variant: 'destructive' });
      return;
    }
    if (!file.type.startsWith('image/')) {
      toast({ title: 'Invalid file', description: 'Please select an image file', variant: 'destructive' });
      return;
    }
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const apiBase = getApiUrl().replace(/\/$/, '');
      const response = await axios.post(`${apiBase}/upload/image`, formData, {
        timeout: 30000,
      });
      onChange(response.data.url);
      toast({ title: 'Image uploaded!' });
    } catch (error) {
      console.error('Upload error:', error);
      toast({ title: 'Upload failed', description: uploadErrorMessage(error), variant: 'destructive' });
    } finally {
      setUploading(false);
    }
  };

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (file) uploadFile(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) uploadFile(file);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy';
    setDragOver(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);
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
    if (fileInputRef.current && !uploading) fileInputRef.current.click();
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
          <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileChange} disabled={uploading} style={{ display: 'none' }} />
          <div
            onClick={triggerFileSelect}
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragEnter={handleDragOver}
            onDragLeave={handleDragLeave}
            role="button"
            tabIndex={0}
            data-testid="image-upload-dropzone"
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') triggerFileSelect(); }}
            className={`border-2 border-dashed rounded-lg p-6 flex flex-col items-center justify-center cursor-pointer transition-colors ${
              uploading ? 'opacity-50 cursor-not-allowed border-gray-300' :
              dragOver ? 'border-[#D4AF37] bg-[#D4AF37]/5' : 'border-gray-300 hover:border-[#D4AF37]'
            }`}
          >
            {uploading ? (
              <div className="text-center pointer-events-none">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#D4AF37] mx-auto mb-3"></div>
                <p className="text-sm text-gray-600">Uploading...</p>
              </div>
            ) : (
              <div className="pointer-events-none flex flex-col items-center">
                <Upload size={40} className={`mb-3 ${dragOver ? 'text-[#D4AF37]' : 'text-gray-400'}`} />
                <p className="text-sm text-gray-600 mb-1">{dragOver ? 'Drop image here' : 'Click to upload or drag and drop'}</p>
                <p className="text-xs text-gray-500">JPG, PNG, GIF, WebP (max 10MB)</p>
              </div>
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
          <img src={resolveImageUrl(value)} alt="Preview" className="w-full h-48 object-cover rounded-lg border-2 border-gray-200"
            onError={(e) => { e.target.src = 'https://via.placeholder.com/400x300?text=Image+Not+Found'; }} />
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
