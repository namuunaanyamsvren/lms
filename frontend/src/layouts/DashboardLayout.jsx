import { useEffect, useState } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from '../components/dashboard/Sidebar';
import TopNavigation from '../components/dashboard/TopNavigation';
import MobileNavigation from '../components/dashboard/MobileNavigation';
import { fetchCurrentOrganization } from '../services/api';

export default function DashboardLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [organization, setOrganization] = useState(null);

  useEffect(() => {
    fetchCurrentOrganization().then(data => {
      setOrganization(data);
      if (data.settings?.primaryColor) {
        document.documentElement.style.setProperty('--organization-primary-color', data.settings.primaryColor);
      }
    }).catch(error => console.error('Failed to load organization branding:', error));
  }, []);

  const toggleSidebar = () => setSidebarOpen(!sidebarOpen);
  const toggleMobileMenu = () => setMobileMenuOpen(!mobileMenuOpen);

  return (
    <div data-dashboard-shell className="flex h-screen flex-col bg-slate-50 text-slate-900">
      {/* Top Navigation */}
      <TopNavigation
        onSidebarToggle={toggleSidebar}
        onMobileMenuToggle={toggleMobileMenu}
      />

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar - Desktop */}
        <div className="hidden md:block">
          <Sidebar isOpen={sidebarOpen} onToggle={toggleSidebar} organization={organization} />
        </div>

        {/* Mobile Navigation - Mobile */}
        <div className="md:hidden">
          {mobileMenuOpen && <MobileNavigation onClose={toggleMobileMenu} />}
        </div>

        {/* Main Content Area */}
        <main className="min-w-0 flex-1 overflow-auto bg-slate-50 transition-all duration-300">
          <div className="p-4 text-slate-900 md:p-6 lg:p-8">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
