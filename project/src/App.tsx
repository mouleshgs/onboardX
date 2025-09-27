import { useEffect, useState } from 'react';
import './styles.css';
import { useAuth } from './hooks/useAuth';
import { VendorDashboard } from './components/VendorDashboard/VendorDashboard';
import { DistributorDashboard } from './components/DistributorDashboard/DistributorDashboard';
import ContractViewer from './components/ContractViewer/ContractViewer';
import { LoginPage } from './components/Auth/LoginPage';

function App() {
  const { user, loading } = useAuth();
  const [currentPath, setCurrentPath] = useState(window.location.pathname);

  useEffect(() => {
    const handlePopState = () => {
      setCurrentPath(window.location.pathname);
    };
    
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  useEffect(() => {
    if (loading) return;

    // Handle authentication and routing
    if (!user) {
      if (currentPath !== '/login') {
        window.history.pushState({}, '', '/login');
        setCurrentPath('/login');
      }
      return;
    }

    // Redirect based on role if on login page
    if (currentPath === '/login') {
      const targetPath = user.role === 'vendor' ? '/' : '/distributor';
      window.history.pushState({}, '', targetPath);
      setCurrentPath(targetPath);
      return;
    }
  }, [user, loading, currentPath]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
  <div className="animate-spin rounded-full h-8 w-8 border-2 border-red-600 border-t-transparent"></div>
      </div>
    );
  }

  // Route handling
  if (!user) {
    return <LoginPage />;
  }

  // Handle different routes based on user role and current path
  if (currentPath === '/login') {
    return <LoginPage />;
  }
  // If path is /contract/:id show the in-app viewer
  // Match /contract/:id and ignore any trailing path segments (e.g. /pdf)
  const contractMatch = currentPath.match(/^\/contract\/([^\/]+)/);
  if (contractMatch) {
    const id = decodeURIComponent(contractMatch[1]);
    return <ContractViewer contractId={id} />;
  }
  if (currentPath === '/distributor' || (user.role === 'distributor' && currentPath === '/')) {
    return <DistributorDashboard />;
  }
  
  if (currentPath === '/' || user.role === 'vendor') {
    return <VendorDashboard />;
  }

  // Default fallback (guard user before checking role to satisfy TS narrowing)
  return user && (user.role as string) === 'vendor' ? <VendorDashboard /> : <DistributorDashboard />;
}

export default App;