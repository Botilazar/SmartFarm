import React, { useState, useEffect } from 'react';
import { 
  Sprout, Search, Bell, LogOut, LayoutDashboard, Package, 
  Plus, ArrowLeftRight, QrCode, Users as UsersIcon, 
  Settings as SettingsIcon
} from 'lucide-react';
import { dbService, getStockStatus } from '../db/dbService';
import type { Material, Transaction, UserProfile } from '../db/dbService';
import { MaterialForm } from './MaterialForm';
import { QRScanner } from './QRScanner';

// Import refactored subcomponents
import { DashboardOverview } from './DashboardOverview';
import { MaterialsView } from './MaterialsView';
import { MovementsView } from './MovementsView';
import { QrCodesView } from './QrCodesView';
import { UsersView } from './UsersView';
import { SettingsView } from './SettingsView';
import { TransactionModal } from './TransactionModal';
import { QrPrintModal } from './QrPrintModal';
import { DeleteConfirmModal } from './DeleteConfirmModal';

interface DashboardProps {
  user: { name: string; email: string; role: 'admin' | 'operator' };
  onLogout: () => void;
}

export const Dashboard: React.FC<DashboardProps> = ({ user, onLogout }) => {
  // Navigation states
  const [activeView, setActiveView] = useState<'dashboard' | 'materials' | 'movements' | 'qr-codes' | 'users' | 'settings'>('dashboard');
  const [mobileTab, setMobileTab] = useState<'home' | 'search' | 'qr' | 'movements' | 'profile'>('home');
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
  
  // Data states
  const [materials, setMaterials] = useState<Material[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [deleteConfirmMaterial, setDeleteConfirmMaterial] = useState<Material | null>(null);
  const [_loading, setLoading] = useState(true);
  
  // Interaction states
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [showNewMaterialModal, setShowNewMaterialModal] = useState(false);
  const [showScanner, setShowScanner] = useState(false);
  
  // Selected material for transaction (Checkout / Intake)
  const [transactionMaterial, setTransactionMaterial] = useState<Material | null>(null);

  // Selected material for viewing QR
  const [viewingQrMaterial, setViewingQrMaterial] = useState<Material | null>(null);
  
  // Track system status
  const isMock = dbService.isMockMode();

  // Listen to window size
  useEffect(() => {
    const handleResize = () => {
      const mobile = window.innerWidth <= 768;
      setIsMobile(mobile);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Fetch data
  const loadData = async () => {
    setLoading(true);
    try {
      await dbService.init();
      const mats = await dbService.getMaterials();
      const txs = await dbService.getTransactions();
      const usrs = await dbService.getUserProfiles();
      setMaterials(mats);
      setTransactions(txs);
      setUsers(usrs);
    } catch (err) {
      console.error('Failed to load data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Handle Material Addition
  const handleAddMaterial = async (newMatData: Omit<Material, 'qr_code_url'>) => {
    try {
      const created = await dbService.addMaterial(newMatData);
      
      // Also log transaction for intake
      if (created.quantity > 0) {
        await dbService.addTransaction({
          material_id: created.id,
          material_name: created.name,
          type: 'intake',
          quantity: created.quantity,
          user_name: user.name,
          notes: 'Kezdő raktárkészlet feltöltése'
        });
      }

      setShowNewMaterialModal(false);
      await loadData();
    } catch (err: any) {
      alert(err.message || 'Mentés sikertelen.');
    }
  };

  // Open transaction dialog on QR Scan success or Manual click
  const handleScanSuccess = async (materialId: string) => {
    setShowScanner(false);
    const mat = materials.find((m) => m.id === materialId);
    if (mat) {
      setTransactionMaterial(mat);
    } else {
      alert(`Anyag nem található azonosító alapján: ${materialId}`);
    }
  };

  // Handle Material Deletion
  const handleDeleteMaterial = (material: Material) => {
    setDeleteConfirmMaterial(material);
  };

  // Stats calculation for notifications badge
  const lowStockCount = materials.filter(m => getStockStatus(m.quantity, m.max_quantity) !== 'green').length;

  // ----------------------------------------------------
  // DESKTOP INTERFACE RENDERING
  // ----------------------------------------------------

  const renderDesktopLayout = () => {
    return (
      <div className="app-container">
        {/* Sidebar */}
        <aside className="desktop-sidebar">
          <div className="sidebar-header">
            <Sprout className="sidebar-footer-logo" size={32} />
            <h1 className="brand-name" style={{ margin: 0, fontSize: '20px' }}>SmartFarm</h1>
          </div>

          <nav className="sidebar-nav">
            <button 
              className={`nav-item ${activeView === 'dashboard' ? 'active' : ''}`}
              onClick={() => setActiveView('dashboard')}
            >
              <LayoutDashboard size={18} />
              <span>Dashboard</span>
            </button>
            <button 
              className={`nav-item ${activeView === 'materials' ? 'active' : ''}`}
              onClick={() => setActiveView('materials')}
            >
              <Package size={18} />
              <span>Anyagok</span>
            </button>
            <button 
              className="nav-item"
              onClick={() => setShowNewMaterialModal(true)}
            >
              <Plus size={18} />
              <span>Új anyag</span>
            </button>
            <button 
              className={`nav-item ${activeView === 'movements' ? 'active' : ''}`}
              onClick={() => setActiveView('movements')}
            >
              <ArrowLeftRight size={18} />
              <span>Készletmozgások</span>
            </button>
            <button 
              className={`nav-item ${activeView === 'qr-codes' ? 'active' : ''}`}
              onClick={() => setActiveView('qr-codes')}
            >
              <QrCode size={18} />
              <span>QR-kódok</span>
            </button>
            <button 
              className={`nav-item ${activeView === 'users' ? 'active' : ''}`}
              onClick={() => setActiveView('users')}
            >
              <UsersIcon size={18} />
              <span>Felhasználók</span>
            </button>
            <button 
              className={`nav-item ${activeView === 'settings' ? 'active' : ''}`}
              onClick={() => setActiveView('settings')}
            >
              <SettingsIcon size={18} />
              <span>Beállítások</span>
            </button>
          </nav>

          <div className="sidebar-footer">
            <Sprout className="sidebar-footer-logo" size={24} />
            <div className="sidebar-footer-text">
              <h4>SmartFarm Raktár</h4>
              <p>Verzió 1.2.0</p>
            </div>
          </div>
        </aside>

        {/* Main Content Area */}
        <div className="main-layout">
          {/* Topbar Header */}
          <header className="desktop-header">
            <div className="search-bar-wrapper">
              <Search className="input-icon" size={18} style={{ left: '14px' }} />
              <input 
                type="text" 
                className="search-input" 
                placeholder="Keresés anyag, azonosító vagy hely szerint..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  if (activeView !== 'materials') setActiveView('materials');
                }}
              />
              <span className="search-shortcut">⌘ K</span>
            </div>

            <div className="header-actions">
              <button 
                className="btn-secondary" 
                style={{ padding: '8px 14px', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px' }}
                onClick={() => setShowScanner(true)}
              >
                <QrCode size={16} />
                <span>QR Beolvasás</span>
              </button>

              <button className="icon-btn-badge" aria-label="Értesítések">
                <Bell size={20} />
                {lowStockCount > 0 && <span className="badge-dot">{lowStockCount}</span>}
              </button>

              <div className="profile-dropdown-btn">
                <img 
                  src={`https://ui-avatars.com/api/?name=${encodeURIComponent(user.name)}&background=006837&color=fff`} 
                  alt={user.name} 
                  className="profile-avatar" 
                />
                <div className="profile-info">
                  <div className="profile-name">{user.name}</div>
                  <div className="profile-role">{user.role === 'admin' ? 'Raktárvezető' : 'Raktári dolgozó'}</div>
                </div>
              </div>

              <button 
                className="icon-btn-badge" 
                style={{ color: 'var(--danger)' }} 
                title="Kijelentkezés"
                onClick={onLogout}
              >
                <LogOut size={20} />
              </button>
            </div>
          </header>

          {/* Demo notice bar */}
          {isMock && (
            <div className="demo-mode-bar">
              <span>Jelenleg offline Demó / LocalStorage üzemmódban fut a rendszer.</span>
              <a onClick={() => setActiveView('settings')}>Supabase csatlakozási adatok megadása</a>
            </div>
          )}

          {/* Dynamic views loader */}
          <main className="page-content">
            {activeView === 'dashboard' && (
              <DashboardOverview 
                materials={materials} 
                transactions={transactions} 
                setActiveView={setActiveView} 
              />
            )}
            {activeView === 'materials' && (
              <MaterialsView
                materials={materials}
                searchQuery={searchQuery}
                setSearchQuery={setSearchQuery}
                selectedCategory={selectedCategory}
                setSelectedCategory={setSelectedCategory}
                user={user}
                onAddTransactionClick={setTransactionMaterial}
                onPrintQrClick={setViewingQrMaterial}
                onDeleteClick={handleDeleteMaterial}
              />
            )}
            {activeView === 'movements' && (
              <MovementsView transactions={transactions} />
            )}
            {activeView === 'qr-codes' && (
              <QrCodesView 
                materials={materials} 
                onPrintQrClick={setViewingQrMaterial} 
              />
            )}
            {activeView === 'users' && (
              <UsersView users={users} />
            )}
            {activeView === 'settings' && (
              <SettingsView isMock={isMock} />
            )}
          </main>
        </div>
      </div>
    );
  };

  // ----------------------------------------------------
  // MOBILE INTERFACE RENDERING
  // ----------------------------------------------------

  const renderMobileLayout = () => {
    // Current mobile sub-view based on bottom navigation
    return (
      <div className="mobile-app-layout">
        {/* Mobile top header */}
        <header className="mobile-header">
          <div className="mobile-header-top">
            <div className="mobile-brand-title">
              <Sprout size={24} />
              <span>SmartFarm</span>
            </div>
            <div className="mobile-header-icons">
              <button className="mobile-badge-btn" onClick={() => setShowScanner(true)}>
                <QrCode size={22} />
              </button>
              <button className="mobile-badge-btn">
                <Bell size={22} />
                {lowStockCount > 0 && <span className="badge-dot" style={{ top: '-2px', right: '-2px' }} />}
              </button>
              <img 
                src={`https://ui-avatars.com/api/?name=${encodeURIComponent(user.name)}&background=fff&color=006837`} 
                alt={user.name} 
                className="mobile-avatar-img" 
                onClick={onLogout}
              />
            </div>
          </div>

          <div className="mobile-search-row">
            <div className="mobile-search-wrapper">
              <Search className="input-icon" size={16} style={{ left: '12px', color: 'rgba(255,255,255,0.7)' }} />
              <input 
                type="text" 
                className="mobile-search-input" 
                placeholder="Keresés anyag, azonosító vagy hely..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setMobileTab('search');
                }}
              />
            </div>
          </div>
        </header>

        {/* Mobile Page Content Area */}
        <main className="mobile-body">
          {isMock && (
            <div className="demo-mode-bar" style={{ borderRadius: '8px', marginBottom: '16px', padding: '6px' }}>
              <span>LocalStorage Demo Mód</span>
            </div>
          )}

          {mobileTab === 'home' && (
            <DashboardOverview
              materials={materials}
              transactions={transactions}
              setActiveView={setActiveView}
              isMobile={true}
              setShowScanner={setShowScanner}
              setShowNewMaterialModal={setShowNewMaterialModal}
              setMobileTab={setMobileTab}
              onMobileStockCardClick={handleScanSuccess}
            />
          )}

          {mobileTab === 'search' && (
            <MaterialsView
              materials={materials}
              searchQuery={searchQuery}
              setSearchQuery={setSearchQuery}
              selectedCategory={selectedCategory}
              setSelectedCategory={setSelectedCategory}
              user={user}
              onAddTransactionClick={setTransactionMaterial}
              onPrintQrClick={setViewingQrMaterial}
              onDeleteClick={handleDeleteMaterial}
              isMobile={true}
              onMobileScanClick={handleScanSuccess}
            />
          )}

          {mobileTab === 'movements' && (
            <MovementsView transactions={transactions} isMobile={true} />
          )}

          {mobileTab === 'profile' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', alignItems: 'center', textAlign: 'center', paddingTop: '20px' }}>
              <img 
                src={`https://ui-avatars.com/api/?name=${encodeURIComponent(user.name)}&background=006837&color=fff&size=128`} 
                alt={user.name} 
                style={{ width: '96px', height: '96px', borderRadius: '50%', border: '3px solid var(--primary)', boxShadow: 'var(--shadow-md)' }}
              />
              <div>
                <h3 style={{ fontSize: '18px', fontWeight: 700 }}>{user.name}</h3>
                <p style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>{user.email}</p>
                <span 
                  style={{
                    display: 'inline-block',
                    padding: '4px 12px',
                    backgroundColor: 'var(--primary-light)',
                    color: 'var(--primary)',
                    borderRadius: '12px',
                    fontSize: '11px',
                    fontWeight: 600,
                    marginTop: '8px'
                  }}
                >
                  {user.role === 'admin' ? 'Raktárvezető' : 'Kezelő'}
                </span>
              </div>

              <div style={{ width: '100%', marginTop: '20px' }}>
                <button 
                  type="button" 
                  className="btn-secondary" 
                  style={{ width: '100%', borderColor: 'var(--danger)', color: 'var(--danger)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
                  onClick={onLogout}
                >
                  <LogOut size={16} />
                  <span>Kijelentkezés</span>
                </button>
              </div>
            </div>
          )}
        </main>

        {/* Mobile bottom navigation tab bar */}
        <nav className="mobile-tab-bar">
          <button 
            className={`mobile-tab-item ${mobileTab === 'home' ? 'active' : ''}`}
            onClick={() => setMobileTab('home')}
          >
            <LayoutDashboard size={20} />
            <span>Főoldal</span>
          </button>
          <button 
            className={`mobile-tab-item ${mobileTab === 'search' ? 'active' : ''}`}
            onClick={() => setMobileTab('search')}
          >
            <Search size={20} />
            <span>Keresés</span>
          </button>
          <button 
            className={`mobile-tab-item ${mobileTab === 'qr' ? 'active' : ''}`}
            onClick={() => {
              setMobileTab('home');
              setShowScanner(true);
            }}
          >
            <QrCode size={22} style={{ color: 'var(--primary)' }} />
            <span style={{ color: 'var(--primary)', fontWeight: 600 }}>QR scan</span>
          </button>
          <button 
            className={`mobile-tab-item ${mobileTab === 'movements' ? 'active' : ''}`}
            onClick={() => setMobileTab('movements')}
          >
            <ArrowLeftRight size={20} />
            <span>Mozgások</span>
          </button>
          <button 
            className={`mobile-tab-item ${mobileTab === 'profile' ? 'active' : ''}`}
            onClick={() => setMobileTab('profile')}
          >
            <UsersIcon size={20} />
            <span>Profil</span>
          </button>
        </nav>
      </div>
    );
  };

  // ----------------------------------------------------
  // DIALOG / MODAL RENDERING
  // ----------------------------------------------------

  return (
    <>
      {/* Layout switch based on viewport */}
      {isMobile ? renderMobileLayout() : renderDesktopLayout()}

      {/* 1. Modal: SCANNER */}
      {showScanner && (
        <QRScanner 
          onScanSuccess={handleScanSuccess} 
          onClose={() => setShowScanner(false)} 
        />
      )}

      {/* 2. Modal: NEW MATERIAL FORM */}
      {showNewMaterialModal && (
        <MaterialForm
          onSave={handleAddMaterial}
          onCancel={() => setShowNewMaterialModal(false)}
          existingIds={materials.map(m => m.id)}
        />
      )}

      {/* 3. Modal: TRANSACTION POPUP SHEET (Check-out/in) */}
      {transactionMaterial && (
        <TransactionModal
          material={transactionMaterial}
          userName={user.name}
          onClose={() => setTransactionMaterial(null)}
          onSubmitSuccess={async () => {
            setTransactionMaterial(null);
            await loadData();
          }}
        />
      )}

      {/* 4. Modal: VIEW QR FOR PRINT */}
      {viewingQrMaterial && (
        <QrPrintModal
          material={viewingQrMaterial}
          onClose={() => setViewingQrMaterial(null)}
        />
      )}

      {/* 5. Modal: DELETE CONFIRMATION POPUP */}
      {deleteConfirmMaterial && (
        <DeleteConfirmModal
          material={deleteConfirmMaterial}
          onClose={() => setDeleteConfirmMaterial(null)}
          onDeleteSuccess={async () => {
            setDeleteConfirmMaterial(null);
            await loadData();
          }}
        />
      )}
    </>
  );
};
