import { useState, useEffect, lazy, Suspense } from 'react';
import { useAppStore, modeFromLocation } from './stores/appStore';
import { useAuthStore } from './stores/authStore';
import { AuthProvider, useAuth } from './context/AuthContext';
import { useCloudSession } from './hooks/useCloudSession';
import { UserInteractionPrompt } from './components/UserInteractionPrompt';
import { ModeNav } from './components/ModeNav';
import { ConfirmDialog } from './components/ConfirmDialog';
import { CashierPinGate } from './components/CashierPinGate';
import { CashierScreen } from './screens/CashierScreen';
import { InventoryScreen } from './screens/InventoryScreen';
import { ScannerScreen } from './screens/ScannerScreen';
import { TransactionHistoryScreen } from './screens/TransactionHistoryScreen';
import { UtangScreen } from './screens/UtangScreen';
import { SyncIndicator } from './components/SyncIndicator';
import { CustomerDisplay } from './screens/CustomerDisplayScreen';
import { LoginScreen } from './components/LoginScreen';
import { seedCatalogIfEmpty, E2E_MODE } from './services/db';
import { getLowStockProducts } from './services/products';
import { useIsAtLeast } from './hooks/useResponsive';

// recharts is heavy and only the dashboard uses it, so it is fetched when the
// dashboard opens instead of on every page load.
const DashboardScreen = lazy(() =>
  import('./screens/DashboardScreen').then(m => ({ default: m.DashboardScreen }))
);

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
    const syncFromUrl = () => {
      setIsCustomerView(window.location.hash === '#customer');
      // Back/Forward and manual hash edits change the mode; adopt it without
      // writing another history entry.
      const mode = modeFromLocation();
      if (mode) useAppStore.getState().setMode(mode, { updateUrl: false });
    };
    window.addEventListener('hashchange', syncFromUrl);
    window.addEventListener('popstate', syncFromUrl);
    return () => {
      window.removeEventListener('hashchange', syncFromUrl);
      window.removeEventListener('popstate', syncFromUrl);
    };
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
  // Which Dexie Cloud account this device is signed in as — the answer to
  // "whose device is this?" when two people share one store.
  const { email: accountEmail } = useCloudSession();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [logoutConfirmOpen, setLogoutConfirmOpen] = useState(false);
  const [logoutError, setLogoutError] = useState('');
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

  // One logout path for both the header button and the drawer entry: the header
  // used to sign out immediately while the drawer asked first.
  const handleLogout = () => {
    setLogoutError('');
    setLogoutConfirmOpen(true);
  };

  const confirmLogout = () => {
    setLogoutConfirmOpen(false);
    // signOut() uploads any pending changes before signing out, and rejects if
    // they cannot be uploaded — logging out anyway would offer to discard them.
    // Keeping the session and showing the reason is the safe outcome.
    void signOut().catch((err: unknown) => {
      setLogoutError(err instanceof Error ? err.message : 'Could not sign out. Please try again.');
    });
  };

  const app = (
    <div className="h-dvh bg-slate-100 flex flex-col relative overflow-hidden">
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
          {/* Not a heading: each screen owns exactly one h1, and this bar is
              chrome that repeats on every screen. The account line underneath
              shows which email this device is signed in as. */}
          <div className="min-w-0">
            <div className="text-base sm:text-lg font-extrabold text-slate-900 leading-tight">
              {role === 'inventory' ? '📦 Inventory Portal' : '💰 Cashier POS'}
            </div>
            {accountEmail && (
              <div
                className="text-xs text-slate-500 leading-tight truncate max-w-[160px] sm:max-w-[280px]"
                title={accountEmail}
              >
                ✉ {accountEmail}
              </div>
            )}
          </div>
        </div>
        <div className="flex items-center gap-3">
          <SyncIndicator />
          <span className="text-xs bg-amber-100 text-amber-900 px-3 py-1 rounded-full font-bold capitalize">
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

      {logoutError && (
        <div className="bg-red-50 border-b border-red-200 px-4 py-3 flex items-start justify-between gap-3">
          <p className="text-sm text-red-700 font-medium">{logoutError}</p>
          <button
            onClick={() => setLogoutError('')}
            aria-label="Dismiss"
            className="shrink-0 text-red-600 font-bold"
          >
            ✕
          </button>
        </div>
      )}

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
            <Suspense fallback={null}>
              {mode === 'dashboard' && <DashboardScreen />}
            </Suspense>
          </div>
        ) : (
          <div className="flex-1 flex flex-col w-full bg-white min-h-0">
            {mode === 'cashier' && <CashierScreen />}
            {mode === 'utang' && <UtangScreen />}
            {mode === 'history' && <TransactionHistoryScreen />}
            {mode === 'inventory' && <InventoryScreen />}
            <Suspense fallback={null}>
              {mode === 'dashboard' && <DashboardScreen />}
            </Suspense>
            {mode === 'scanner' && <ScannerScreen />}
          </div>
        )}
      </main>

      <ConfirmDialog
        open={logoutConfirmOpen}
        title="Log Out?"
        message="You will be signed out of your account on this device."
        confirmLabel="Log Out"
        onConfirm={confirmLogout}
        onCancel={() => setLogoutConfirmOpen(false)}
      />
    </div>
  );

  // The cashier shift is locked behind the PIN; inventory staff are not.
  return role === 'cashier' ? <CashierPinGate>{app}</CashierPinGate> : app;
}
