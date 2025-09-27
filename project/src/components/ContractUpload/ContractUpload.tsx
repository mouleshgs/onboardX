import { useState } from 'react';
import { Upload, FileText } from 'lucide-react';
import type { UploadResponse } from '../../types';
import api from '../../api';
import showToast from '../../utils/toast';

interface ContractUploadProps {
  vendorEmail: string;
  onUploadSuccess: () => void;
}

export function ContractUpload({ vendorEmail, onUploadSuccess }: ContractUploadProps) {
  const [distributorEmail, setDistributorEmail] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<string>('');

  const handleSubmit = async () => {
    if (!distributorEmail.trim()) {
      showToast('Distributor email required', 'warn');
      return;
    }
    
    if (!file) {
      showToast('Select a PDF file', 'warn');
      return;
    }

    setUploading(true);
    setResult('');

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('distributorEmail', distributorEmail.trim());
      formData.append('vendorEmail', vendorEmail || 'vendor@local');
      formData.append('vendorId', vendorEmail.replace(/[^a-z0-9]/gi, '').toLowerCase());

      const response = await api.uploadContract(formData);
      const data: UploadResponse = await response.json();

      if (response.ok) {
        setResult(`Uploaded successfully! Contract ID: ${data.id}`);
        setDistributorEmail('');
        setFile(null);
        
        // Reset file input
        const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
        if (fileInput) fileInput.value = '';
        
        onUploadSuccess();

        if (data.storageUrl) {
          setResult(prev => prev + ` - View in Dropbox`);
        }
      } else {
        setResult(`Error: ${(data as any).error || (data as any).detail || 'Unknown error'}`);
      }
    } catch (error) {
      setResult('Network error occurred');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="panel bg-white rounded-xl shadow-sm border border-gray-200 p-6">
      <h3 className="text-lg font-semibold text-gray-800 mb-6">
        Upload a contract PDF and send it to a distributor
      </h3>
      
      <div className="card bg-gray-50 rounded-lg p-6 border-0">
        <div className="flex gap-6 items-end">
          <div className="flex-1 space-y-4">
            <div className="form-row">
              <label className="block text-sm font-medium text-gray-600 mb-2">
                Distributor email
              </label>
              <input
                type="email"
                value={distributorEmail}
                onChange={(e) => setDistributorEmail(e.target.value)}
                placeholder="distributor@example.com"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 outline-none transition-colors"
                disabled={uploading}
              />
            </div>
            
            <div className="form-row">
              <label className="block text-sm font-medium text-gray-600 mb-2">
                Your email
              </label>
              <input
                type="email"
                value={vendorEmail}
                placeholder="you@vendor.com"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-100 text-gray-600"
                readOnly
              />
            </div>
            
            <div className="form-row">
              <label className="block text-sm font-medium text-gray-600 mb-2">
                Select PDF
              </label>
              <div className="relative">
                <input
                  type="file"
                  accept="application/pdf"
                  onChange={(e) => setFile(e.target.files?.[0] || null)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 outline-none transition-colors file:mr-3 file:py-1 file:px-3 file:rounded-md file:border-0 file:bg-red-50 file:text-red-700 file:font-medium hover:file:bg-red-100"
                  disabled={uploading}
                />
                {file && (
                  <div className="mt-2 flex items-center gap-2 text-sm text-gray-600">
                    <FileText size={16} />
                    {file.name}
                  </div>
                )}
              </div>
            </div>
          </div>
          
          <button
            onClick={handleSubmit}
            disabled={uploading}
            className="btn bg-red-600 text-white px-6 py-3 rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2 font-medium"
          >
            {uploading ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                Uploading...
              </>
            ) : (
              <>
                <Upload size={18} />
                Upload & Send
              </>
            )}
          </button>
        </div>
      </div>

      {result && (
        <div className={`mt-4 p-4 rounded-lg ${
          result.includes('Error') ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'
        }`}>
          {result}
        </div>
      )}
    </div>
  );
}