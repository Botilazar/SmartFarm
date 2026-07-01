import React, { useState, useEffect, useRef } from 'react';
import {
  Sprout, Search, Bell, LogOut, LayoutDashboard, Package,
  Plus, ArrowLeftRight, QrCode, Users as UsersIcon,
  Settings as SettingsIcon, ArrowUpRight, ArrowDownRight
} from 'lucide-react';
import { dbService, getStockStatus } from '../db/dbService';
import type { Material, Transaction, UserProfile } from '../db/dbService';
import { supabase, isSupabaseConfigured } from '../db/supabaseClient';
import { MaterialForm } from './MaterialForm';
import { QRScanner } from './QRScanner';
import { useTranslation } from '../context/LanguageContext';

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
  user: { id: string; name: string; email: string; role: 'admin' | 'operator'; avatar_url?: string };
  onLogout: () => void;
  onUserUpdate?: (updatedUser: Partial<{ id: string; name: string; email: string; role: 'admin' | 'operator'; avatar_url?: string }>) => void;
}

export const Dashboard: React.FC<DashboardProps> = ({ user, onLogout, onUserUpdate }) => {
  const { t } = useTranslation();
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
  const [editingMaterial, setEditingMaterial] = useState<Material | null>(null);

  // Notifications states
  const [showNotifications, setShowNotifications] = useState(false);
  const [lastReadTimestamp, setLastReadTimestamp] = useState<string>(() => {
    return localStorage.getItem('smartfarm_last_read_notifications') || new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString();
  });
  const desktopNotificationsRef = useRef<HTMLDivElement>(null);
  const mobileNotificationsRef = useRef<HTMLDivElement>(null);

  // Toast states
  const [toast, setToast] = useState<Transaction | null>(null);
  const [toastVisible, setToastVisible] = useState(false);
  const toastTimerRef = useRef<{ hide: any; remove: any }>({ hide: null, remove: null });
  const isInitialLoadRef = useRef(true);
  const prevTransactionsRef = useRef<Transaction[]>([]);

  // Selected material for transaction (Checkout / Intake)
  const [transactionMaterial, setTransactionMaterial] = useState<Material | null>(null);

  // Selected material for viewing QR
  const [viewingQrMaterial, setViewingQrMaterial] = useState<Material | null>(null);

  // Track system status
  const isMock = dbService.isMockMode();

  // Relative time helper
  const formatRelativeTime = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return 'Épp most';
    if (diffMins < 60) return `${diffMins} perce`;
    if (diffHours < 24) {
      if (date.getDate() === now.getDate()) {
        return `Ma ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
      }
      return `Tegnap ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
    }
    if (diffDays === 1) {
      return `Tegnap ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
    }
    return `${date.getFullYear()}. ${String(date.getMonth() + 1).padStart(2, '0')}. ${String(date.getDate()).padStart(2, '0')}. ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
  };

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const desktopClickedInside = desktopNotificationsRef.current && desktopNotificationsRef.current.contains(event.target as Node);
      const mobileClickedInside = mobileNotificationsRef.current && mobileNotificationsRef.current.contains(event.target as Node);
      
      if (!desktopClickedInside && !mobileClickedInside) {
        setShowNotifications(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Listen to window size
  useEffect(() => {
    const handleResize = () => {
      const mobile = window.innerWidth <= 768;
      setIsMobile(mobile);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Trigger toast helper
  const triggerToast = (tx: Transaction) => {
    if (toastTimerRef.current.hide) clearTimeout(toastTimerRef.current.hide);
    if (toastTimerRef.current.remove) clearTimeout(toastTimerRef.current.remove);

    // Set content first (container is already in DOM)
    setToast(tx);
    
    // Add visible class in next frame for transition on enter
    setTimeout(() => {
      setToastVisible(true);
    }, 50);

    toastTimerRef.current.hide = setTimeout(() => {
      setToastVisible(false);
    }, 3050);

    toastTimerRef.current.remove = setTimeout(() => {
      setToast(null);
    }, 3400);
  };

  // Listen to new transactions to show toast
  useEffect(() => {
    if (transactions.length > 0) {
      if (isInitialLoadRef.current) {
        prevTransactionsRef.current = transactions;
        isInitialLoadRef.current = false;
        return;
      }

      if (transactions.length > prevTransactionsRef.current.length) {
        const newestTx = transactions[0];
        const timeDiff = Date.now() - new Date(newestTx.timestamp).getTime();
        if (timeDiff < 15000) {
          triggerToast(newestTx);
        }
      }
      prevTransactionsRef.current = transactions;
    }
  }, [transactions]);

  // Clean up timers on unmount
  useEffect(() => {
    return () => {
      if (toastTimerRef.current.hide) clearTimeout(toastTimerRef.current.hide);
      if (toastTimerRef.current.remove) clearTimeout(toastTimerRef.current.remove);
    };
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

  // Listen to realtime updates from Supabase
  useEffect(() => {
    if (!isSupabaseConfigured) return;

    const channel = supabase!
      .channel('schema-db-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'transactions' },
        async (payload) => {
          console.log('Realtime transaction update received:', payload);
          try {
            const txs = await dbService.getTransactions();
            setTransactions(txs);
          } catch (err) {
            console.error('Failed to load transactions via realtime:', err);
          }
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'materials' },
        async (payload) => {
          console.log('Realtime material update received:', payload);
          try {
            const mats = await dbService.getMaterials();
            setMaterials(mats);
          } catch (err) {
            console.error('Failed to load materials via realtime:', err);
          }
        }
      )
      .subscribe();

    return () => {
      supabase!.removeChannel(channel);
    };
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

  // Handle Material Editing
  const handleEditMaterial = async (updatedData: Omit<Material, 'qr_code_url'>) => {
    if (!editingMaterial) return;
    try {
      await dbService.updateMaterial(editingMaterial.id, {
        name: updatedData.name.trim(),
        quantity: Number(updatedData.quantity),
        max_quantity: Number(updatedData.max_quantity),
        unit: updatedData.unit,
        category: updatedData.category,
        location: updatedData.location.toUpperCase(),
        image_url: updatedData.image_url,
      });

      // Log a transaction if quantity was modified directly during editing
      const diff = Number(updatedData.quantity) - editingMaterial.quantity;
      if (diff !== 0) {
        await dbService.addTransaction({
          material_id: editingMaterial.id,
          material_name: updatedData.name.trim(),
          type: diff > 0 ? 'intake' : 'checkout',
          quantity: diff,
          user_name: user.name,
          notes: 'Készlet közvetlen korrekciója szerkesztéssel'
        });
      }

      setEditingMaterial(null);
      await loadData();
    } catch (err: any) {
      alert(err.message || 'Módosítás sikertelen.');
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
  
  // Calculate unread transactions for the bell badge
  const unreadCount = transactions.filter(
    (t) => new Date(t.timestamp).getTime() > new Date(lastReadTimestamp).getTime()
  ).length;

  const markNotificationsAsRead = () => {
    const nowStr = new Date().toISOString();
    setLastReadTimestamp(nowStr);
    localStorage.setItem('smartfarm_last_read_notifications', nowStr);
  };

  // ----------------------------------------------------
  // DESKTOP INTERFACE RENDERING
  // ----------------------------------------------------

  const renderDesktopLayout = () => {
    return (
      <div className="app-container">
        {/* Sidebar */}
        <aside className="desktop-sidebar">
          <div className="sidebar-header">
            <Sprout className="sidebar-header-logo" size={32} />
            <h1 className="brand-name" style={{ margin: 0, fontSize: '20px' }}>SmartFarm</h1>
          </div>

          <nav className="sidebar-nav">
            <button
              className={`nav-item ${activeView === 'dashboard' ? 'active' : ''}`}
              onClick={() => setActiveView('dashboard')}
            >
              <LayoutDashboard size={18} />
              <span>{t('navDashboard')}</span>
            </button>
            <button
              className={`nav-item ${activeView === 'materials' ? 'active' : ''}`}
              onClick={() => setActiveView('materials')}
            >
              <Package size={18} />
              <span>{t('navMaterials')}</span>
            </button>
            <button
              className="nav-item"
              onClick={() => setShowNewMaterialModal(true)}
            >
              <Plus size={18} />
              <span>{t('navNewMaterial')}</span>
            </button>
            <button
              className={`nav-item ${activeView === 'movements' ? 'active' : ''}`}
              onClick={() => setActiveView('movements')}
            >
              <ArrowLeftRight size={18} />
              <span>{t('navMovements')}</span>
            </button>
            <button
              className={`nav-item ${activeView === 'qr-codes' ? 'active' : ''}`}
              onClick={() => setActiveView('qr-codes')}
            >
              <QrCode size={18} />
              <span>{t('navQrCodes')}</span>
            </button>
            <button
              className={`nav-item ${activeView === 'users' ? 'active' : ''}`}
              onClick={() => setActiveView('users')}
            >
              <UsersIcon size={18} />
              <span>{t('navUsers')}</span>
            </button>
            <button
              className={`nav-item ${activeView === 'settings' ? 'active' : ''}`}
              onClick={() => setActiveView('settings')}
            >
              <SettingsIcon size={18} />
              <span>{t('navSettings')}</span>
            </button>
          </nav>

          <div className="sidebar-footer">
            <Sprout className="sidebar-footer-logo" size={24} />
            <div className="sidebar-footer-text">
              <h4>{t('appName')}</h4>
              <p>{t('version')}</p>
            </div>
          </div>
        </aside>

        {/* Main Content Area */}
        <div className="main-layout">
          {/* Topbar Header */}
          <header className="desktop-header">
            <div className="search-bar-wrapper">
              <Search className="input-icon" size={18} />
              <input
                type="text"
                className="search-input"
                placeholder={t('searchPlaceholder')}
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  if (activeView !== 'materials') setActiveView('materials');
                }}
              />
            </div>

            <div className="header-actions">
              <button
                className="btn-secondary"
                style={{ 
                  width: 'auto', 
                  minWidth: '130px', 
                  height: '38px', 
                  padding: '0 16px', 
                  fontSize: '13px', 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'center', 
                  gap: '6px', 
                  flexShrink: 0,
                  whiteSpace: 'nowrap'
                }}
                onClick={() => setShowScanner(true)}
              >
                <QrCode size={16} />
                <span>{t('qrScanBtn')}</span>
              </button>

              <div className="notification-bell-container" ref={desktopNotificationsRef}>
                <button
                  className="icon-btn-badge"
                  aria-label="Értesítések"
                  onClick={() => {
                    const nextShow = !showNotifications;
                    setShowNotifications(nextShow);
                    if (nextShow) {
                      markNotificationsAsRead();
                    }
                  }}
                >
                  <Bell size={20} />
                  {unreadCount > 0 && <span className="badge-dot">{unreadCount}</span>}
                </button>

                {showNotifications && (
                  <div className="notifications-dropdown">
                    <div className="notifications-dropdown-header">
                      <h3>Legutóbbi készletmozgások</h3>
                    </div>
                    <div className="notifications-dropdown-content">
                      {transactions.length === 0 ? (
                        <div className="notifications-empty">
                          Még nem történt készletmozgás.
                        </div>
                      ) : (
                        [...transactions]
                          .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
                          .slice(0, 5)
                          .map((t) => (
                            <div
                              key={t.id}
                              className="notification-item"
                              onClick={() => {
                                setActiveView('movements');
                                setShowNotifications(false);
                              }}
                            >
                              <div className={`notification-icon-wrapper ${t.type}`}>
                                {t.type === 'intake' ? <ArrowUpRight size={16} /> : <ArrowDownRight size={16} />}
                              </div>
                              <div className="notification-details">
                                <span className="notification-text">
                                  <strong>{t.user_name}</strong> {t.type === 'intake' ? 'bevételezett' : 'kiadott'} {Math.abs(t.quantity)} db <strong>{t.material_name}</strong> terméket.
                                </span>
                                <div className="notification-meta">
                                  <span className="notification-time">{formatRelativeTime(t.timestamp)}</span>
                                  {t.notes && <span className="notification-notes" title={t.notes}>• {t.notes}</span>}
                                </div>
                              </div>
                            </div>
                          ))
                      )}
                    </div>
                    <div className="notifications-dropdown-footer">
                      <button
                        onClick={() => {
                          setActiveView('movements');
                          setShowNotifications(false);
                        }}
                      >
                        Összes mozgás megtekintése
                      </button>
                    </div>
                  </div>
                )}
              </div>

              <div className="profile-display">
                <img
                  src={user.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.name)}&background=006837&color=fff`}
                  alt={user.name}
                  className="profile-avatar"
                />
                <div className="profile-info">
                  <div className="profile-name">{user.name}</div>
                  <div className="profile-role">{user.role === 'admin' ? t('roleAdmin') : t('roleOperator')}</div>
                </div>
              </div>

              <button
                className="icon-btn-badge logout-btn"
                title={t('navLogout')}
                onClick={onLogout}
              >
                <LogOut size={20} />
              </button>
            </div>
          </header>

          {/* Demo notice bar */}
          {isMock && (
            <div className="demo-mode-bar">
              <span>{t('demoNotice')}</span>
              <a onClick={() => setActiveView('settings')}>{t('demoLink')}</a>
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
                onEditClick={setEditingMaterial}
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
              <SettingsView isMock={isMock} user={user} onUserUpdate={onUserUpdate} />
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
              <div className="notification-bell-container" ref={mobileNotificationsRef} style={{ position: 'relative' }}>
                <button
                  className="mobile-badge-btn"
                  onClick={() => {
                    const nextShow = !showNotifications;
                    setShowNotifications(nextShow);
                    if (nextShow) {
                      markNotificationsAsRead();
                    }
                  }}
                  style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', display: 'flex', alignItems: 'center' }}
                >
                  <Bell size={22} />
                  {unreadCount > 0 && <span className="badge-dot" style={{ top: '-2px', right: '-2px' }}>{unreadCount}</span>}
                </button>

                {showNotifications && (
                  <div className="notifications-dropdown mobile">
                    <div className="notifications-dropdown-header">
                      <h3>Legutóbbi készletmozgások</h3>
                    </div>
                    <div className="notifications-dropdown-content">
                      {transactions.length === 0 ? (
                        <div className="notifications-empty">
                          Még nem történt készletmozgás.
                        </div>
                      ) : (
                        [...transactions]
                          .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
                          .slice(0, 5)
                          .map((t) => (
                            <div
                              key={t.id}
                              className="notification-item"
                              onClick={() => {
                                setMobileTab('movements');
                                setShowNotifications(false);
                              }}
                            >
                              <div className={`notification-icon-wrapper ${t.type}`}>
                                {t.type === 'intake' ? <ArrowUpRight size={16} /> : <ArrowDownRight size={16} />}
                              </div>
                              <div className="notification-details">
                                <span className="notification-text">
                                  <strong>{t.user_name}</strong> {t.type === 'intake' ? 'bevételezett' : 'kiadott'} {Math.abs(t.quantity)} db <strong>{t.material_name}</strong> terméket.
                                </span>
                                <div className="notification-meta">
                                  <span className="notification-time">{formatRelativeTime(t.timestamp)}</span>
                                  {t.notes && <span className="notification-notes" title={t.notes}>• {t.notes}</span>}
                                </div>
                              </div>
                            </div>
                          ))
                      )}
                    </div>
                    <div className="notifications-dropdown-footer">
                      <button
                        onClick={() => {
                          setMobileTab('movements');
                          setShowNotifications(false);
                        }}
                      >
                        Összes mozgás megtekintése
                      </button>
                    </div>
                  </div>
                )}
              </div>
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
              onEditClick={setEditingMaterial}
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
                src={user.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.name)}&background=006837&color=fff&size=128`}
                alt={user.name}
                style={{ width: '96px', height: '96px', borderRadius: '50%', border: '3px solid var(--primary)', boxShadow: 'var(--shadow-md)', objectFit: 'cover' }}
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

      {/* 2.1. Modal: EDIT MATERIAL FORM */}
      {editingMaterial && (
        <MaterialForm
          onSave={handleEditMaterial}
          onCancel={() => setEditingMaterial(null)}
          existingIds={materials.map(m => m.id)}
          initialData={editingMaterial}
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

      {/* Realtime Toast Notification */}
      <div 
        className={`realtime-toast ${toast ? toast.type : ''} ${toast && toastVisible ? 'visible' : 'exit'}`} 
        onClick={() => {
          if (!toast) return;
          if (isMobile) {
            setMobileTab('movements');
          } else {
            setActiveView('movements');
          }
          setToastVisible(false);
        }}
      >
        {toast && (
          <>
            <div className={`toast-icon-wrapper ${toast.type}`}>
              {toast.type === 'intake' ? <ArrowUpRight size={18} /> : <ArrowDownRight size={18} />}
            </div>
            <div className="toast-content">
              <span className="toast-title">Készletmozgás történt!</span>
              <span className="toast-desc">
                <strong>{toast.user_name}</strong> {toast.type === 'intake' ? 'bevételezett' : 'kiadott'} {Math.abs(toast.quantity)} db <strong>{toast.material_name}</strong> terméket.
              </span>
            </div>
          </>
        )}
      </div>
    </>
  );
};
