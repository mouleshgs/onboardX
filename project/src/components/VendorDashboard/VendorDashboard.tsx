import { useAuth } from '../../hooks/useAuth';
import { useContracts } from '../../hooks/useContracts';
import { TopBar } from '../Layout/TopBar';
import { ContractUpload } from '../ContractUpload/ContractUpload';
import { ContractList } from '../ContractList/ContractList';

export function VendorDashboard() {
  const { user, logout } = useAuth();
  const { contracts, loading, refetch } = useContracts(user?.email || '');

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-red-600 border-t-transparent"></div>
      </div>
    );
  }

  return (
    <div className="app-shell min-h-screen">
      <TopBar title="Vendor Dashboard" onLogout={logout} />
      
      <div className="max-w-4xl mx-auto py-8 px-6 space-y-8">
        <ContractUpload 
          vendorEmail={user.email}
          onUploadSuccess={refetch}
        />
        
        <ContractList
          contracts={contracts}
          vendorEmail={user.email}
          loading={loading}
          onRefresh={refetch}
        />
      </div>
    </div>
  );
}