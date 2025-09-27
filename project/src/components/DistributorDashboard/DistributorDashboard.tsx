import { useState, useEffect } from 'react';
import { RefreshCw, Search } from 'lucide-react';
import { TopBar } from '../Layout/TopBar';
import { useAuth } from '../../hooks/useAuth';
import type { Contract } from '../../types';

export function DistributorDashboard() {
  const { user, logout } = useAuth();
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  const loadContracts = async () => {
    if (!user?.email) return;
    
    try {
      const response = await (await import('../../api')).default.getContracts();
      const allContracts = await response.json();
      
      // Filter contracts assigned to this distributor
      const myContracts = allContracts.filter((c: Contract) => 
        c.assignedToEmail && user.email && 
        c.assignedToEmail.toLowerCase() === user.email.toLowerCase()
      );
      
      setContracts(myContracts);
    } catch (error) {
      console.error('Failed to load contracts:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Load contracts once when component mounts or when the user email changes.
    // Removed automatic polling so the list only refreshes when the user clicks "Refresh".
    loadContracts();
    // cleanup: nothing to clean up because we don't set an interval anymore
  }, [user?.email]);

  const filteredContracts = contracts.filter(contract => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return (
      contract.id.toLowerCase().includes(term) ||
      (contract.originalName && contract.originalName.toLowerCase().includes(term))
    );
  });

  const signedCount = filteredContracts.filter(c => c.status === 'signed').length;

    if (!user) {
      return (
        <div className="min-h-screen flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-2 border-red-600 border-t-transparent"></div>
        </div>
      );
    }

  return (
    <div className="min-h-screen">
      <TopBar title="Distributor Dashboard" onLogout={logout} />
      
      <div className="max-w-6xl mx-auto py-8 px-6">
        {/* Header with Stats */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Your Contracts</h1>
              <p className="text-gray-600">Review and sign your assigned contracts</p>
            </div>
            <div className="flex items-center gap-4">
              <div className="text-sm text-gray-600">
                Signed: <span className="font-semibold text-green-600">{signedCount}</span>
              </div>
              <button
                onClick={loadContracts}
                disabled={loading}
                className="flex items-center gap-2 px-3 py-2 text-sm text-gray-600 hover:text-gray-800 transition-colors disabled:opacity-50"
              >
                <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
                Refresh
              </button>
            </div>
          </div>

          {/* Search */}
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
            <input
              type="text"
              placeholder="Search contracts..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 outline-none"
            />
          </div>
        </div>

        {/* Contracts Grid */}
        {loading && contracts.length === 0 ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-2 border-blue-600 border-t-transparent"></div>
          </div>
        ) : filteredContracts.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-gray-500 mb-2">
              {searchTerm ? 'No contracts match your search' : 'No contracts assigned to you yet'}
            </div>
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="text-red-600 hover:text-red-700 text-sm"
              >
                Clear search
              </button>
            )}
          </div>
        ) : (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {filteredContracts.map((contract) => (
              <ContractCard key={contract.id} contract={contract} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

interface ContractCardProps {
  contract: Contract;
}

function ContractCard({ contract }: ContractCardProps) {
  const getStatusColor = () => {
    switch (contract.status) {
      case 'signed':
        return 'bg-green-100 text-green-800';
      case 'pending':
        return 'bg-yellow-100 text-yellow-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const handleOpen = () => {
    // Navigate to contract viewer - we'll implement this route
    window.location.href = `/contract/${contract.id}`;
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between mb-4">
        <div className="flex-1">
          <h3 className="font-semibold text-gray-900 mb-1">
            {contract.originalName || contract.id}
          </h3>
          <p className="text-sm text-gray-500 mb-2">
            ID: {contract.id}
          </p>
          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor()}`}>
            {contract.status || 'pending'}
          </span>
        </div>
      </div>

      <div className="space-y-2 mb-4">
        <div className="text-sm text-gray-600">
          <span className="font-medium">From:</span> {contract.vendorEmail || '—'}
        </div>
        <div className="text-sm text-gray-600">
          <span className="font-medium">Created:</span> {new Date(contract.createdAt).toLocaleDateString()}
        </div>
      </div>

      <button
        onClick={handleOpen}
        className="w-full px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-medium"
      >
        {contract.status === 'signed' ? 'View Signed Contract' : 'Review & Sign'}
      </button>
    </div>
  );
}