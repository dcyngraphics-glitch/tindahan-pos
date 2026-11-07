import { useState, useEffect } from 'react';
import { useAppStore } from './stores/appStore';
import { useAuthStore } from './stores/authStore';
import { AuthProvider, useAuth } from './context/AuthContext';
import { useCloudSession } from './hooks/useCloudSession';
import { UserInteractionPrompt } from './components/UserInteractionPrompt';
import { ModeNav } from './components/ModeNav';
import { CashierScreen } from './screens/CashierScreen';
import { InventoryScreen } from './screens/InventoryScreen';
import { DashboardScreen } from './screens/DashboardScreen';
import { ScannerScreen } from './screens/ScannerScreen';
import { TransactionHistoryScreen } from './screens/TransactionHistoryScreen';
import { CustomerDisplay } from './screens/CustomerDisplayScreen';
import { LoginScreen } from './components/LoginScreen';
import { seedCatalogIfEmpty, E2E_MODE } from './services/db';
import { getLowStockProducts } from './services/products';
import { useIsAtLeast } from './hooks/useResponsive';

export default function App() {
  return (
    <AuthProvider>
      <AuthGate />
    </AuthProvider>
  );
}

/**
 * The app's gate: nobody reaches the POS without a Dexie Cloud account.
 *
 * Three states, because "not signed in yet" and "still reading the session from
 * storage" are different: db.cloud.currentUser starts as UNAUTHORIZED_USER with
 * isLoading:true, and rendering the login screen during that window would flash it on
 * every cold start for users who are perfectly well signed in.
 */
function AuthGate() {
  const { isLoading, isLoggedIn, error } = useCloudSession();
  const { role: storedRole } = useAuthStore();
  const [isCustomerView, setIsCustomerView] = useState(window.location.hash === '#customer');

  useEffect(() => {
    const handleHashChange = () => setIsCustomerView(window.location.hash === '#customer');
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  if (isCustomerView) {
    return <CustomerDisplay />;
  }

  // E2E_MODE (see services/db.ts) renders the main app from the seeded `tindahan_auth`
  // role instead of waiting for a cloud session no test can complete. Tying it to the
  // seeded role (rather than to the flag alone) is what lets the logout tests work:
  // once logout clears the role, the gate falls back to the login screen.
  const showMain = isLoggedIn || (E2E_MODE && storedRole !== null);

  return (
    <>
      {showMain ? (
        <MainApp />
      ) : isLoading ? (
        <div className="min-h-dvh bg-gradient-to-br from-amber-500 via-amber-600 to-slate-900 flex items-center justify-center p-4">
          <p className="text-white text-lg font-extrabold">Loading...</p>
        </div>
      ) : error ? (
        // The local database is the app. If it cannot be opened there is nothing useful
        // to show, so say so plainly instead of spinning forever.
        <div className="min-h-dvh bg-gradient-to-br from-amber-500 via-amber-600 to-slate-900 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 text-center">
            <h1 className="text-lg font-black text-slate-900 mb-2">Storage unavailable</h1>
            <p className="text-sm text-slate-600">{error}</p>
          </div>
        </div>
      ) : (
        <LoginScreen />
      )}

      {/* Mounted at the root, not inside a branch, so db.cloud.userInteraction is
          always observed — the login prompts need it while signed out, and the
          "unsynced changes" logout confirmation can fire from any screen. */}
      <UserInteractionPrompt />
    </>
  );
}

function MainApp() {
  const { mode } = useAppStore();
  const { role: storedRole } = useAuthStore();
  const { signOut } = useAuth();
  // A returning user's role is persisted; a fresh sign-in defaults to the till.
  const role = storedRole ?? 'cashier';
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [lowStockCount, setLowStockCount] = useState(0);
  const isTabletOrLarger = useIsAtLeast('tablet');

  useEffect(() => {
    seedCatalogIfEmpty().then(() => {
      getLowStockProducts().then(prods => setLowStockCount(prods.length)).catch(() => {});
    });
  }, []);

  // Refresh low stock count when mode changes
  useEffect(() => {
    getLowStockProducts().then(prods => setLowStockCount(prods.length)).catch(() => {});
  }, [mode]);

  // Inventory staff on mobile: show nav by default (not collapsible)
  useEffect(() => {
    if (role === 'inventory' && !isTabletOrLarger) {
      setSidebarOpen(true);
    }
  }, [role, isTabletOrLarger]);

  const handleLogout = () => {
    // signOut() signs out of Dexie Cloud and clears the persisted role. It rejects when
    // the user dismisses the unsynced-changes confirmation, in which case the session
    // (local role included) is deliberately kept.
    void signOut().catch((err: unknown) => {
      console.error('[auth] Sign-out failed:', err);
    });
  };

  return (
    <div className="min-h-dvh bg-slate-100 flex flex-col relative">
      {/* Top Header Bar with Menu Button */}
      <header className="bg-white border-b border-slate-200 px-4 py-3 flex items-center justify-between sticky top-0 z-30 shadow-xs">
        <div className="flex items-center gap-3">
          {/* Show menu button for cashier on tablet/PC, or for any mobile user to open navigation drawer */}
          {(role === 'cashier' && isTabletOrLarger) || role === 'inventory' || !isTabletOrLarger ? (
            <button
              onClick={() => setSidebarOpen(true)}
              aria-label="Open menu"
              className="relative p-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 flex items-center gap-2 font-bold min-h-[44px] min-w-[44px] transition"
            >
              <span className="text-xl">☰</span>
              <span className="text-xs hidden sm:inline">Menu</span>
              {lowStockCount > 0 && (
                <span className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full ring-2 ring-white" />
              )}
            </button>
          ) : null}
          <div>
            <h1 className="text-base sm:text-lg font-extrabold text-slate-900">
              {role === 'inventory' ? '📦 Inventory Portal' : '💰 Cashier POS'}
            </h1>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs bg-amber-100 text-amber-900 px-3 py-1 rounded-full font-bold">
            {role}
          </span>
          <button
            onClick={handleLogout}
            className="px-3 py-1.5 bg-slate-100 hover:bg-red-50 hover:text-red-600 text-slate-700 text-xs font-bold rounded-xl transition min-h-[44px]"
          >
            Logout
          </button>
        </div>
      </header>

      {/* ModeNav Sidebar - collapsible for all roles; visible by default for inventory staff on mobile */}
      <ModeNav
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        lowStockCount={lowStockCount}
      />

      {/* Main Screen Workspace */}
      <main className="flex-1 flex flex-col overflow-y-auto">
        {role === 'inventory' ? (
          <div className="w-full flex-1 flex flex-col bg-white">
            {mode === 'scanner' && <ScannerScreen />}
            {mode === 'inventory' && <InventoryScreen />}
            {mode === 'history' && <TransactionHistoryScreen />}
            {mode === 'dashboard' && <DashboardScreen />}
          </div>
        ) : (
          <div className="flex-1 flex flex-col w-full bg-white">
            {mode === 'cashier' && <CashierScreen />}
            {mode === 'history' && <TransactionHistoryScreen />}
            {mode === 'inventory' && <InventoryScreen />}
            {mode === 'dashboard' && <DashboardScreen />}
            {mode === 'scanner' && <ScannerScreen />}
          </div>
        )}
      </main>
    </div>
  );
}
