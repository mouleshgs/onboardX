import { RefreshCw } from 'lucide-react';
import { ContractCard } from './ContractCard';
import type { Contract } from '../../types';

interface ContractListProps {
  contracts: Contract[];
  vendorEmail: string;
  loading: boolean;
  onRefresh: () => void;
}

export function ContractList({ contracts, vendorEmail, loading, onRefresh }: ContractListProps) {
  if (loading && contracts.length === 0) {
    return (
      <div className="panel bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <h4 className="text-lg font-semibold text-gray-800 mb-4">Your contracts</h4>
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-2 border-red-600 border-t-transparent"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="panel bg-white rounded-xl shadow-sm border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-6">
        <h4 className="text-lg font-semibold text-gray-800">Your contracts</h4>
        <button
          onClick={onRefresh}
          disabled={loading}
          className="flex items-center gap-2 px-3 py-2 text-sm text-gray-600 hover:text-gray-800 transition-colors disabled:opacity-50"
        >
          <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>
      
      <div className="list space-y-4">
        {contracts.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            No contracts yet
          </div>
        ) : (
          contracts
            .slice()
            .reverse()
            .map((contract) => (
              <ContractCard
                key={contract.id}
                contract={contract}
                vendorEmail={vendorEmail}
              />
            ))
        )}
      </div>
    </div>
  );
}