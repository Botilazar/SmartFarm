import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Sprout, Search, Bell, LogOut, LayoutDashboard, Package,
  Plus, ArrowLeftRight, QrCode, Users as UsersIcon, ShieldCheck,
  Settings as SettingsIcon, ArrowUpRight, ArrowDownRight, ArrowLeft, ChevronRight
} from 'lucide-react';
import { dbService } from '../db/dbService';
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
import { AllowedEmailsView } from './AllowedEmailsView';
import { SettingsView } from './SettingsView';
import { TransactionModal } from './TransactionModal';
import { QrPrintModal } from './QrPrintModal';
import { DeleteConfirmModal } from './DeleteConfirmModal';
import { DeactivateConfirmModal } from './DeactivateConfirmModal';
import { RestoreConfirmModal } from './RestoreConfirmModal';

interface DashboardProps {
  user: { id: string; name: string; email: string; role: 'admin' | 'operator'; avatar_url?: string };
  onLogout: () => void;
  onUserUpdate?: (updatedUser: Partial<{ id: string; name: string; email: string; role: 'admin' | 'operator'; avatar_url?: string }>) => void;
}

export const Dashboard: React.FC<DashboardProps> = ({ user, onLogout, onUserUpdate }) => {
  const { t, language } = useTranslation();
  // Navigation states
  const [activeView, setActiveView] = useState<'dashboard' | 'materials' | 'movements' | 'qr-codes' | 'users' | 'allowed-emails' | 'settings'>('dashboard');
  const [mobileTab, setMobileTab] = useState<'home' | 'materials' | 'qr' | 'movements' | 'profile'>('home');
  const [profileSubView, setProfileSubView] = useState<'none' | 'qr-codes' | 'users' | 'allowed-emails'>('none');
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);

  // Data states
  const [materials, setMaterials] = useState<Material[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [deleteConfirmMaterial, setDeleteConfirmMaterial] = useState<Material | null>(null);
  const [deactivateConfirmMaterial, setDeactivateConfirmMaterial] = useState<Material | null>(null);
  const [restoreConfirmMaterial, setRestoreConfirmMaterial] = useState<Material | null>(null);
  const [loading, setLoading] = useState(true);

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
  const toastTimerRef = useRef<{ hide: ReturnType<typeof setTimeout> | null; remove: ReturnType<typeof setTimeout> | null }>({ hide: null, remove: null });
  const isInitialLoadRef = useRef(true);
  const prevTransactionsRef = useRef<Transaction[]>([]);

  // Selected material for transaction (Checkout / Intake)
  const [transactionMaterial, setTransactionMaterial] = useState<Material | null>(null);

  // Selected material for viewing QR
  const [viewingQrMaterial, setViewingQrMaterial] = useState<Material | null>(null);

  // Global search dropdown state
  const [showSearchDropdown, setShowSearchDropdown] = useState(false);
  const desktopSearchRef = useRef<HTMLDivElement>(null);
  const mobileSearchRef = useRef<HTMLDivElement>(null);

  // Compute live search results (min 2 chars)
  const headerSearchResults = React.useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (q.length < 2) return [];
    return materials.filter(m =>
      !m.is_inactive && (
        m.name.toLowerCase().includes(q) ||
        m.id.toLowerCase().includes(q) ||
        m.category.toLowerCase().includes(q) ||
        (m.location && m.location.toLowerCase().includes(q))
      )
    );
  }, [materials, searchQuery]);

  // Click outside listener to close search dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent | TouchEvent) => {
      const desktopClickedInside = desktopSearchRef.current && desktopSearchRef.current.contains(event.target as Node);
      const mobileClickedInside = mobileSearchRef.current && mobileSearchRef.current.contains(event.target as Node);

      if (!desktopClickedInside && !mobileClickedInside) {
        setShowSearchDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchstart', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, []);

  const handleSelectSearchResult = (material: Material) => {
    setShowSearchDropdown(false);
    setSearchQuery(material.name);
    setActiveView('materials');
    setMobileTab('materials');
  };

  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      setShowSearchDropdown(false);
      setActiveView('materials');
      setMobileTab('materials');
    } else if (e.key === 'Escape') {
      setShowSearchDropdown(false);
    }
  };

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

    const hoursStr = String(date.getHours()).padStart(2, '0');
    const minutesStr = String(date.getMinutes()).padStart(2, '0');

    if (language === 'hu') {
      if (diffMins < 1) return 'Épp most';
      if (diffMins < 60) return `${diffMins} perce`;
      if (diffHours < 24) {
        if (date.getDate() === now.getDate()) {
          return `Ma ${hoursStr}:${minutesStr}`;
        }
        return `Tegnap ${hoursStr}:${minutesStr}`;
      }
      if (diffDays === 1) {
        return `Tegnap ${hoursStr}:${minutesStr}`;
      }
      return `${date.getFullYear()}. ${String(date.getMonth() + 1).padStart(2, '0')}. ${String(date.getDate()).padStart(2, '0')}. ${hoursStr}:${minutesStr}`;
    } else if (language === 'de') {
      if (diffMins < 1) return 'Gerade eben';
      if (diffMins < 60) return `vor ${diffMins} Min.`;
      if (diffHours < 24) {
        if (date.getDate() === now.getDate()) {
          return `Heute ${hoursStr}:${minutesStr}`;
        }
        return `Gestern ${hoursStr}:${minutesStr}`;
      }
      if (diffDays === 1) {
        return `Gestern ${hoursStr}:${minutesStr}`;
      }
      return `${String(date.getDate()).padStart(2, '0')}.${String(date.getMonth() + 1).padStart(2, '0')}.${date.getFullYear()} ${hoursStr}:${minutesStr}`;
    } else {
      if (diffMins < 1) return 'Just now';
      if (diffMins < 60) return `${diffMins}m ago`;
      if (diffHours < 24) {
        if (date.getDate() === now.getDate()) {
          return `Today ${hoursStr}:${minutesStr}`;
        }
        return `Yesterday ${hoursStr}:${minutesStr}`;
      }
      if (diffDays === 1) {
        return `Yesterday ${hoursStr}:${minutesStr}`;
      }
      return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')} ${hoursStr}:${minutesStr}`;
    }
  };

  // Render notification text helper
  const renderNotificationText = (user_name: string, type: 'intake' | 'checkout', quantity: number, material_name: string) => {
    const qty = Math.abs(quantity);
    if (language === 'hu') {
      return (
        <>
          <strong>{user_name}</strong> {type === 'intake' ? 'bevételezett' : 'kiadott'} {qty} db <strong>{material_name}</strong> terméket.
        </>
      );
    } else if (language === 'de') {
      return (
        <>
          <strong>{user_name}</strong> hat {qty} Stk. <strong>{material_name}</strong> {type === 'intake' ? 'eingelagert' : 'ausgelagert'}.
        </>
      );
    } else {
      return (
        <>
          <strong>{user_name}</strong> {type === 'intake' ? 'stocked in' : 'checked out'} {qty} pcs of <strong>{material_name}</strong>.
        </>
      );
    }
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
          // eslint-disable-next-line react-hooks/set-state-in-effect
          triggerToast(newestTx);
        }
      }
      prevTransactionsRef.current = transactions;
    }
  }, [transactions]);

  // Clean up timers on unmount
  useEffect(() => {
    const timer = toastTimerRef.current;
    return () => {
      if (timer.hide) clearTimeout(timer.hide);
      if (timer.remove) clearTimeout(timer.remove);
    };
  }, []);

  // Fetch data
  const loadData = useCallback(async () => {
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
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadData();
  }, [loadData]);

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

      // Instant optimistic UI update
      setMaterials(prev => [created, ...prev]);
      setShowNewMaterialModal(false);

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
        const txs = await dbService.getTransactions();
        setTransactions(txs);
      }
    } catch (err: unknown) {
      alert((err as Error)?.message || 'Mentés sikertelen.');
      await loadData();
    }
  };

  // Handle Material Editing
  const handleEditMaterial = async (updatedData: Omit<Material, 'qr_code_url'>) => {
    if (!editingMaterial) return;
    try {
      const updatedMat: Material = {
        ...editingMaterial,
        name: updatedData.name.trim(),
        quantity: Number(updatedData.quantity),
        max_quantity: Number(updatedData.max_quantity),
        unit: updatedData.unit,
        category: updatedData.category,
        location: updatedData.location.toUpperCase(),
        image_url: updatedData.image_url,
        expiration_date: updatedData.expiration_date,
      };

      // Instant optimistic UI update
      setMaterials(prev => prev.map(m => m.id === editingMaterial.id ? updatedMat : m));
      setEditingMaterial(null);

      await dbService.updateMaterial(editingMaterial.id, {
        name: updatedData.name.trim(),
        quantity: Number(updatedData.quantity),
        max_quantity: Number(updatedData.max_quantity),
        unit: updatedData.unit,
        category: updatedData.category,
        location: updatedData.location.toUpperCase(),
        image_url: updatedData.image_url,
        expiration_date: updatedData.expiration_date,
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
        const txs = await dbService.getTransactions();
        setTransactions(txs);
      }
    } catch (err: unknown) {
      alert((err as Error)?.message || 'Módosítás sikertelen.');
      await loadData();
    }
  };

  // Open transaction dialog on QR Scan success or Manual click
  const handleScanSuccess = async (materialId: string) => {
    setShowScanner(false);
    const mat = materials.find((m) => m.id === materialId);
    if (mat) {
      if (mat.is_inactive) {
        const errorMsg = (t('matErrorInactiveScan') || 'Figyelem! A(z) "{name}" ({id}) anyag jelenleg inaktív. Tranzakció nem végezhető vele!')
          .replace('{name}', mat.name)
          .replace('{id}', mat.id);
        alert(errorMsg);
      } else {
        setTransactionMaterial(mat);
      }
    } else {
      alert(`Anyag nem található azonosító alapján: ${materialId}`);
    }
  };

  // Handle Material Deactivation (Admin function)
  const handleDeactivateMaterial = (material: Material) => {
    setDeactivateConfirmMaterial(material);
  };

  // Handle Material Restoration (Admin function)
  const handleRestoreMaterial = (material: Material) => {
    setRestoreConfirmMaterial(material);
  };

  // Handle Material Deletion
  const handleDeleteMaterial = (material: Material) => {
    setDeleteConfirmMaterial(material);
  };

  // Handle User Profile Update (Instant Optimistic Update)
  const handleUpdateUserProfile = async (userId: string, updates: Partial<UserProfile>) => {
    const targetUser = users.find(u => u.id === userId);
    if (updates.role !== undefined && targetUser && targetUser.email.toLowerCase() === user.email.toLowerCase()) {
      alert('Saját jogosultságodat biztonsági okokból nem módosíthatod!');
      return;
    }
    // Instant UI reaction (0ms)
    setUsers(prevUsers =>
      prevUsers.map(u => (u.id === userId ? { ...u, ...updates } : u))
    );
    try {
      await dbService.updateUserProfile(userId, updates);
    } catch (err: unknown) {
      await loadData();
      alert((err as Error)?.message || 'Hiba történt a módosítás során.');
    }
  };

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
          <div
            className="sidebar-header"
            onClick={() => {
              setActiveView('dashboard');
              setProfileSubView('none');
            }}
            style={{ cursor: 'pointer' }}
          >
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
            {user.role === 'admin' && (
              <>
                <button
                  className={`nav-item ${activeView === 'users' ? 'active' : ''}`}
                  onClick={() => setActiveView('users')}
                >
                  <UsersIcon size={18} />
                  <span>{t('navUsers')}</span>
                </button>

                <button
                  className={`nav-item ${activeView === 'allowed-emails' ? 'active' : ''}`}
                  onClick={() => setActiveView('allowed-emails')}
                >
                  <ShieldCheck size={18} />
                  <span>{t('navAllowedEmails')}</span>
                </button>
              </>
            )}
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
            <div className="search-bar-wrapper" ref={desktopSearchRef} style={{ position: 'relative' }}>
              <Search className="input-icon" size={18} />
              <input
                type="text"
                className="search-input"
                placeholder={t('searchPlaceholder')}
                value={searchQuery}
                onFocus={() => {
                  if (searchQuery.trim().length >= 2) setShowSearchDropdown(true);
                }}
                onChange={(e) => {
                  const val = e.target.value;
                  setSearchQuery(val);
                  if (val.trim().length >= 2) {
                    setShowSearchDropdown(true);
                  } else {
                    setShowSearchDropdown(false);
                  }
                }}
                onKeyDown={handleSearchKeyDown}
              />

              {/* Instant Search Results Dropdown */}
              {showSearchDropdown && searchQuery.trim().length >= 2 && (
                <div
                  className="search-dropdown-menu"
                  style={{
                    position: 'absolute',
                    top: 'calc(100% + 8px)',
                    left: 0,
                    right: 0,
                    backgroundColor: 'var(--bg-card)',
                    borderRadius: '12px',
                    border: '1px solid var(--border)',
                    boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.25)',
                    zIndex: 1000,
                    maxHeight: '360px',
                    overflowY: 'auto',
                    padding: '8px'
                  }}
                >
                  <div style={{ padding: '6px 10px 8px 10px', fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px', borderBottom: '1px solid var(--border)', marginBottom: '6px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span>{t('searchResultsTitle') || 'Keresési találatok'} ({headerSearchResults.length})</span>
                    <span style={{ fontSize: '10px', textTransform: 'none', fontWeight: 400, opacity: 0.8 }}>{t('pressEnterToView') || 'Nyomj ENTER-t a megtekintéshez'}</span>
                  </div>

                  {headerSearchResults.length === 0 ? (
                    <div style={{ padding: '16px 12px', textAlign: 'center', fontSize: '13px', color: 'var(--text-secondary)' }}>
                      {t('noSearchResults') || 'Nincs a keresési feltételnek megfelelő anyag.'}
                    </div>
                  ) : (
                    headerSearchResults.map((m) => (
                      <div
                        key={m.id}
                        onClick={() => handleSelectSearchResult(m)}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '12px',
                          padding: '10px 12px',
                          borderRadius: '8px',
                          cursor: 'pointer',
                          transition: 'background-color 0.15s ease',
                        }}
                        className="search-result-item"
                      >
                        <div style={{ width: '36px', height: '36px', borderRadius: '6px', backgroundColor: 'var(--bg-app)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, overflow: 'hidden' }}>
                          {m.image_url ? (
                            <img src={m.image_url} alt={m.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                          ) : (
                            <Package size={18} style={{ color: 'var(--primary)' }} />
                          )}
                        </div>

                        <div style={{ flex: 1, minWidth: 0, textAlign: 'left' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              {m.name}
                            </span>
                            <span style={{ fontFamily: 'monospace', fontSize: '11px', fontWeight: 700, padding: '1px 6px', borderRadius: '4px', backgroundColor: 'var(--bg-app)', color: 'var(--text-secondary)', border: '1px solid var(--border)', flexShrink: 0 }}>
                              {m.id}
                            </span>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '11px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                            <span>{m.category}</span>
                            {m.location && (
                              <span>• {m.location}</span>
                            )}
                          </div>
                        </div>

                        <div style={{ textAlign: 'right', flexShrink: 0 }}>
                          <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--primary)' }}>
                            {m.quantity} {m.unit}
                          </span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>

            <div className="header-actions">
              <button
                type="button"
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
                <QrCode size={16} style={{ color: 'var(--primary)' }} />
                <span>{t('qrScanBtn')}</span>
              </button>

              <div className="notification-bell-container" ref={desktopNotificationsRef}>
                <button
                  className="icon-btn-badge"
                  aria-label={t('notifAriaLabel')}
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
                      <h3>{t('notifTitle')}</h3>
                    </div>
                    <div className="notifications-dropdown-content">
                      {transactions.length === 0 ? (
                        <div className="notifications-empty">
                          {t('notifEmpty')}
                        </div>
                      ) : (
                        [...transactions]
                          .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
                          .slice(0, 5)
                          .map((tx) => (
                            <div
                              key={tx.id}
                              className="notification-item"
                              onClick={() => {
                                setActiveView('movements');
                                setShowNotifications(false);
                              }}
                            >
                              <div className={`notification-icon-wrapper ${tx.type}`}>
                                {tx.type === 'intake' ? <ArrowUpRight size={16} /> : <ArrowDownRight size={16} />}
                              </div>
                              <div className="notification-details">
                                <span className="notification-text">
                                  {renderNotificationText(tx.user_name, tx.type, tx.quantity, tx.material_name)}
                                </span>
                                <div className="notification-meta">
                                  <span className="notification-time">{formatRelativeTime(tx.timestamp)}</span>
                                  {tx.notes && <span className="notification-notes" title={tx.notes}>• {tx.notes}</span>}
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
                        {t('notifAll')}
                      </button>
                    </div>
                  </div>
                )}
              </div>

              <div
                className="profile-display"
                onClick={() => {
                  setActiveView('settings');
                  setProfileSubView('none');
                }}
                style={{ cursor: 'pointer' }}
              >
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
                materials={materials.filter(m => !m.is_inactive)}
                transactions={transactions}
                setActiveView={setActiveView}
                loading={loading}
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
                onDeactivateClick={handleDeactivateMaterial}
                onRestoreClick={handleRestoreMaterial}
              />
            )}
            {activeView === 'movements' && (
              <MovementsView transactions={transactions} />
            )}
            {activeView === 'qr-codes' && (
              <QrCodesView
                materials={materials.filter(m => !m.is_inactive)}
                onPrintQrClick={setViewingQrMaterial}
              />
            )}
            {activeView === 'users' && user.role === 'admin' && (
              <UsersView users={users} currentUserEmail={user.email} onUpdateUserProfile={handleUpdateUserProfile} />
            )}
            {activeView === 'allowed-emails' && user.role === 'admin' && (
              <AllowedEmailsView currentUserEmail={user.email} />
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
            <div
              className="mobile-brand-title"
              onClick={() => {
                setActiveView('dashboard');
                setProfileSubView('none');
                setMobileTab('home');
              }}
              style={{ cursor: 'pointer' }}
            >
              <Sprout size={24} />
              <span>SmartFarm</span>
            </div>
            <div className="mobile-header-icons">
              <button className="mobile-badge-btn" onClick={() => setShowScanner(true)}>
                <QrCode size={22} style={{ color: 'var(--primary)' }} />
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
                  aria-label={t('notifAriaLabel')}
                >
                  <Bell size={22} />
                  {unreadCount > 0 && <span className="badge-dot" style={{ top: '-2px', right: '-2px' }}>{unreadCount}</span>}
                </button>

                {showNotifications && (
                  <div className="notifications-dropdown mobile">
                    <div className="notifications-dropdown-header">
                      <h3>{t('notifTitle')}</h3>
                    </div>
                    <div className="notifications-dropdown-content">
                      {transactions.length === 0 ? (
                        <div className="notifications-empty">
                          {t('notifEmpty')}
                        </div>
                      ) : (
                        [...transactions]
                          .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
                          .slice(0, 5)
                          .map((tx) => (
                            <div
                              key={tx.id}
                              className="notification-item"
                              onClick={() => {
                                setMobileTab('movements');
                                setShowNotifications(false);
                              }}
                            >
                              <div className={`notification-icon-wrapper ${tx.type}`}>
                                {tx.type === 'intake' ? <ArrowUpRight size={16} /> : <ArrowDownRight size={16} />}
                              </div>
                              <div className="notification-details">
                                <span className="notification-text">
                                  {renderNotificationText(tx.user_name, tx.type, tx.quantity, tx.material_name)}
                                </span>
                                <div className="notification-meta">
                                  <span className="notification-time">{formatRelativeTime(tx.timestamp)}</span>
                                  {tx.notes && <span className="notification-notes" title={tx.notes}>• {tx.notes}</span>}
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
                        {t('notifAll')}
                      </button>
                    </div>
                  </div>
                )}
              </div>
              <img
                src={`https://ui-avatars.com/api/?name=${encodeURIComponent(user.name)}&background=fff&color=006837`}
                alt={user.name}
                className="mobile-avatar-img"
                onClick={() => {
                  setMobileTab('profile');
                  setProfileSubView('none');
                }}
                style={{ cursor: 'pointer' }}
              />
            </div>
          </div>

          <div className="mobile-search-row">
            <div className="mobile-search-wrapper" ref={mobileSearchRef} style={{ position: 'relative' }}>
              <Search className="input-icon" size={16} style={{ left: '12px', color: 'rgba(255,255,255,0.7)' }} />
              <input
                type="text"
                className="mobile-search-input"
                placeholder={t('searchPlaceholder')}
                value={searchQuery}
                onChange={(e) => {
                  const val = e.target.value;
                  setSearchQuery(val);
                  if (val.trim().length >= 2) {
                    setMobileTab('materials');
                    setActiveView('materials');
                  }
                }}
                onKeyDown={handleSearchKeyDown}
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
              materials={materials.filter(m => !m.is_inactive)}
              transactions={transactions}
              setActiveView={setActiveView}
              isMobile={true}
              setShowScanner={setShowScanner}
              setShowNewMaterialModal={setShowNewMaterialModal}
              setMobileTab={setMobileTab}
              onMobileStockCardClick={handleScanSuccess}
              loading={loading}
            />
          )}

          {mobileTab === 'materials' && (
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
              onDeactivateClick={handleDeactivateMaterial}
              onRestoreClick={handleRestoreMaterial}
              isMobile={true}
              onMobileScanClick={handleScanSuccess}
            />
          )}

          {mobileTab === 'movements' && (
            <MovementsView transactions={transactions} isMobile={true} />
          )}

          {mobileTab === 'profile' && (
            <div style={{ width: '100%' }}>
              {profileSubView === 'none' && (
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

                  <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '10px' }}>
                    <button
                      type="button"
                      className="btn-secondary"
                      style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px', width: '100%', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', background: 'var(--bg-card)', color: 'var(--text-primary)', fontWeight: 600 }}
                      onClick={() => setProfileSubView('qr-codes')}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <QrCode size={18} style={{ color: 'var(--primary)' }} />
                        <span>QR kódok megtekintése</span>
                      </div>
                      <ChevronRight size={16} style={{ color: 'var(--text-secondary)' }} />
                    </button>

                    {user.role === 'admin' && (
                      <>
                        <button
                          type="button"
                          className="btn-secondary"
                          style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px', width: '100%', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', background: 'var(--bg-card)', color: 'var(--text-primary)', fontWeight: 600 }}
                          onClick={() => setProfileSubView('users')}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <UsersIcon size={18} style={{ color: 'var(--primary)' }} />
                            <span>Felhasználók kezelése</span>
                          </div>
                          <ChevronRight size={16} style={{ color: 'var(--text-secondary)' }} />
                        </button>

                        <button
                          type="button"
                          className="btn-secondary"
                          style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px', width: '100%', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', background: 'var(--bg-card)', color: 'var(--text-primary)', fontWeight: 600 }}
                          onClick={() => setProfileSubView('allowed-emails')}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <ShieldCheck size={18} style={{ color: 'var(--primary)' }} />
                            <span>{t('navAllowedEmails')}</span>
                          </div>
                          <ChevronRight size={16} style={{ color: 'var(--text-secondary)' }} />
                        </button>
                      </>
                    )}
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

              {profileSubView === 'qr-codes' && (
                <div>
                  <button
                    onClick={() => setProfileSubView('none')}
                    style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px', color: 'var(--primary)', fontWeight: 600, fontSize: '13px' }}
                  >
                    <ArrowLeft size={16} /> Vissza a profilhoz
                  </button>
                  <QrCodesView materials={materials.filter(m => !m.is_inactive)} onPrintQrClick={setViewingQrMaterial} />
                </div>
              )}

              {profileSubView === 'users' && user.role === 'admin' && (
                <div>
                  <button
                    onClick={() => setProfileSubView('none')}
                    style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px', color: 'var(--primary)', fontWeight: 600, fontSize: '13px' }}
                  >
                    <ArrowLeft size={16} /> Vissza a profilhoz
                  </button>
                  <UsersView users={users} currentUserEmail={user.email} onUpdateUserProfile={handleUpdateUserProfile} />
                </div>
              )}

              {profileSubView === 'allowed-emails' && user.role === 'admin' && (
                <div>
                  <button
                    onClick={() => setProfileSubView('none')}
                    style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px', color: 'var(--primary)', fontWeight: 600, fontSize: '13px' }}
                  >
                    <ArrowLeft size={16} /> Vissza a profilhoz
                  </button>
                  <AllowedEmailsView currentUserEmail={user.email} />
                </div>
              )}
            </div>
          )}
        </main>

        {/* Mobile bottom navigation tab bar */}
        <nav className="mobile-tab-bar">
          <button
            type="button"
            className={`mobile-tab-item ${mobileTab === 'home' ? 'active' : ''}`}
            onClick={() => { setMobileTab('home'); setProfileSubView('none'); }}
          >
            <LayoutDashboard size={20} />
            <span>{t('navDashboard')}</span>
          </button>
          <button
            type="button"
            className={`mobile-tab-item ${mobileTab === 'materials' ? 'active' : ''}`}
            onClick={() => { setMobileTab('materials'); setProfileSubView('none'); }}
          >
            <Package size={20} />
            <span>{t('navMaterials')}</span>
          </button>
          <button
            type="button"
            className={`mobile-tab-item ${mobileTab === 'qr' || showScanner ? 'active' : ''}`}
            onClick={() => {
              setMobileTab('qr');
              setProfileSubView('none');
              setShowScanner(true);
            }}
          >
            <QrCode size={20} />
            <span>{t('qrScanBtn')}</span>
          </button>
          <button
            type="button"
            className={`mobile-tab-item ${mobileTab === 'movements' ? 'active' : ''}`}
            onClick={() => { setMobileTab('movements'); setProfileSubView('none'); }}
          >
            <ArrowLeftRight size={20} />
            <span>{t('navMovements')}</span>
          </button>
          <button
            type="button"
            className={`mobile-tab-item ${mobileTab === 'profile' ? 'active' : ''}`}
            onClick={() => { setMobileTab('profile'); setProfileSubView('none'); }}
          >
            <UsersIcon size={20} />
            <span>{t('navUsers')}</span>
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
          onClose={() => {
            setShowScanner(false);
            setMobileTab('home');
          }}
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

      {/* 5.1. Modal: DEACTIVATE CONFIRMATION POPUP */}
      {deactivateConfirmMaterial && (
        <DeactivateConfirmModal
          material={deactivateConfirmMaterial}
          onClose={() => setDeactivateConfirmMaterial(null)}
          onDeactivateSuccess={async () => {
            setDeactivateConfirmMaterial(null);
            await loadData();
          }}
        />
      )}

      {/* 5.2. Modal: RESTORE CONFIRMATION POPUP */}
      {restoreConfirmMaterial && (
        <RestoreConfirmModal
          material={restoreConfirmMaterial}
          onClose={() => setRestoreConfirmMaterial(null)}
          onRestoreSuccess={async () => {
            setRestoreConfirmMaterial(null);
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
              <span className="toast-title">{t('toastTitle')}</span>
              <span className="toast-desc">
                {renderNotificationText(toast.user_name, toast.type, toast.quantity, toast.material_name)}
              </span>
            </div>
          </>
        )}
      </div>
    </>
  );
};
