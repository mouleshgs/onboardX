import { useState } from 'react';
import React from 'react';
import { API_BASE } from '../../api';
import { Send, CheckCircle, Clock, AlertCircle } from 'lucide-react';
import type { Contract, NudgeResponse } from '../../types';

interface ContractCardProps {
  contract: Contract;
  vendorEmail: string;
}

export function ContractCard({ contract, vendorEmail }: ContractCardProps) {
  const [nudging, setNudging] = useState(false);
  const [onboardingStatus, setOnboardingStatus] = useState<string>('Checking onboarding...');
  const [statusClass, setStatusClass] = useState('text-gray-500');
  const [onboardingProgress, setOnboardingProgress] = useState<number>(0);

  // Check onboarding progress on mount
  React.useEffect(() => {
    checkOnboardingProgress();
  }, [contract.id]);

  const checkOnboardingProgress = async () => {
    try {
      const response = await (await import('../../api')).default.getAccess(contract.id);
      if (!response.ok) {
        if (response.status === 403 || response.status === 404) {
          setOnboardingStatus('Onboarding: not started');
          setStatusClass('text-gray-500');
          return;
        }
        setOnboardingStatus('Onboarding: unknown');
        setStatusClass('text-gray-500');
        return;
      }

      const data = await response.json();
      const access = data?.access;
      
      if (!access) {
        setOnboardingStatus('Onboarding: not started');
        setStatusClass('text-gray-500');
        return;
      }

  const progress = typeof access.progress === 'number' ? access.progress : 0;
  setOnboardingProgress(progress);
      
      if (progress >= 100) {
        setOnboardingStatus('Onboarding: completed ✅');
        setStatusClass('text-green-600');
      } else {
        setOnboardingStatus(`Onboarding: ${progress}%`);
        setStatusClass('text-gray-500');
      }
    } catch (error) {
      setOnboardingStatus('Onboarding: unknown');
      setStatusClass('text-gray-500');
    }
  };

  const handleNudge = async () => {
    setNudging(true);
    
    try {
  const payload = { from: vendorEmail || 'vendor', to: contract.assignedToEmail || undefined };
      const response = await (await import('../../api')).default.postNudge(contract.id, payload);
      const data: NudgeResponse = await response.json();

      if (response.ok && data?.nudge) {
        alert(`Nudge sent to ${data.nudge.to || 'distributor'}\n\n"${data.nudge.message}"`);
      } else {
        alert(`Failed to send nudge: ${(data as any)?.error || (data as any)?.detail || 'unknown'}`);
      }
    } catch (error) {
      alert('Network error');
    } finally {
      setNudging(false);
    }
  };

  const handleView = () => {
    // Open the contract PDF directly in a new tab (do not navigate into the SPA contract view).
    // The backend serves the signed PDF at `/contract/:id/pdf` when available.
    const base = API_BASE || '';
    const url = `${base}/contract/${encodeURIComponent(contract.id)}/pdf`;
    window.open(url, '_blank');
  };

  const getStatusIcon = () => {
    switch (contract.status) {
      case 'signed':
        return <CheckCircle className="text-green-500" size={16} />;
      case 'pending':
        return <Clock className="text-yellow-500" size={16} />;
      default:
        return <AlertCircle className="text-gray-400" size={16} />;
    }
  };

  const getStatusColor = () => {
    switch (contract.status) {
      case 'signed':
        return 'text-green-600 bg-green-50';
      case 'pending':
        return 'text-yellow-600 bg-yellow-50';
      default:
        return 'text-gray-600 bg-gray-50';
    }
  };

  return (
    <div className="card bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between">
        <div className="meta flex-1">
          <div className="title font-medium text-gray-800 mb-1">
            {contract.originalName || contract.id}
          </div>
          <div className="sub text-sm text-gray-500 mb-2">
            ID: {contract.id} • 
            <span className={`inline-flex items-center gap-1 ml-2 px-2 py-1 rounded-full text-xs font-medium ${getStatusColor()}`}>
              {getStatusIcon()}
              {contract.status}
            </span>
          </div>
        </div>
        
        <div className="flex flex-col items-end gap-3">
          <div className="text-sm text-gray-600">
            To: {contract.assignedToEmail || '—'}
          </div>
          
          <div className={`text-xs ${statusClass}`}>
            {onboardingStatus}
          </div>
          
          <div className="flex gap-2">
            <button
              onClick={handleView}
              className="btn px-3 py-1.5 text-sm bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors"
            >
              {contract.status === 'signed' ? 'View Signed' : 'View'}
            </button>
            {onboardingProgress >= 100 && (
              <button
                onClick={() => {
                  // Open the external analytics dashboard with token
                  const url = 'http://localhost:3000/dashboard?token=ZqzEpHOW3JWMTbij1NlBKA9E..';
                  window.open(url, '_blank');
                }}
                className="btn px-3 py-1.5 text-sm bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors"
              >
                See analytics
              </button>
            )}
            
            <button
              onClick={handleNudge}
              disabled={nudging}
              className="btn secondary px-3 py-1.5 text-sm border border-gray-300 text-gray-600 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-1"
            >
              {nudging ? (
                <>
                  <div className="animate-spin rounded-full h-3 w-3 border-2 border-gray-400 border-t-transparent"></div>
                  Sending...
                </>
              ) : (
                <>
                  <Send size={14} />
                  Nudge Distributor
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}