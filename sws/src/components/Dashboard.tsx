import React, { useState, useEffect } from 'react';
import { 
  Sprout, Search, Bell, LogOut, LayoutDashboard, Package, 
  Plus, ArrowLeftRight, QrCode, ClipboardList, Users as UsersIcon, 
  Settings as SettingsIcon, ShieldAlert, ArrowUpRight, ArrowDownRight, 
  MapPin, ChevronRight, RefreshCw, Printer, X, AlertCircle
} from 'lucide-react';
import { dbService, getStockStatus } from '../db/dbService';
import type { Material, Transaction } from '../db/dbService';
import { MaterialForm } from './MaterialForm';
import { QRScanner } from './QRScanner';

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
  const [_loading, setLoading] = useState(true);
  
  // Interaction states
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [showNewMaterialModal, setShowNewMaterialModal] = useState(false);
  const [showScanner, setShowScanner] = useState(false);
  
  // Selected material for transaction (Checkout / Intake)
  const [transactionMaterial, setTransactionMaterial] = useState<Material | null>(null);
  const [transactionType, setTransactionType] = useState<'intake' | 'checkout'>('checkout');
  const [transactionQty, setTransactionQty] = useState<number>(1);
  const [transactionNotes, setTransactionNotes] = useState('');
  const [transactionError, setTransactionError] = useState<string | null>(null);

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
      setMaterials(mats);
      setTransactions(txs);
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
      setTransactionType('checkout');
      setTransactionQty(1);
      setTransactionNotes('');
      setTransactionError(null);
    } else {
      alert(`Anyag nem található azonosító alapján: ${materialId}`);
    }
  };

  // Submit Inventory transaction (Intake / Checkout)
  const handleTransactionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!transactionMaterial) return;
    setTransactionError(null);

    const qty = Number(transactionQty);
    if (qty <= 0) {
      setTransactionError('Kérjük adj meg pozitív számot!');
      return;
    }

    let newQty = transactionMaterial.quantity;
    if (transactionType === 'checkout') {
      if (qty > transactionMaterial.quantity) {
        setTransactionError(`Nincs elég készlet! Jelenleg elérhető: ${transactionMaterial.quantity} ${transactionMaterial.unit}`);
        return;
      }
      newQty -= qty;
    } else {
      // Intake
      newQty += qty;
    }

    try {
      // Update quantity
      await dbService.updateMaterialQuantity(transactionMaterial.id, newQty);
      
      // Log transaction
      await dbService.addTransaction({
        material_id: transactionMaterial.id,
        material_name: transactionMaterial.name,
        type: transactionType,
        quantity: transactionType === 'checkout' ? -qty : qty,
        user_name: user.name,
        notes: transactionNotes.trim() || undefined
      });

      setTransactionMaterial(null);
      await loadData();
    } catch (err: any) {
      setTransactionError(err.message || 'Tranzakció rögzítése sikertelen.');
    }
  };

  // Stats calculation
  const totalMaterialsCount = materials.length; // Expected: 128
  
  // Counts by levels
  const greenCount = materials.filter(m => getStockStatus(m.quantity, m.max_quantity) === 'green').length;
  const yellowCount = materials.filter(m => getStockStatus(m.quantity, m.max_quantity) === 'yellow').length;
  const redCount = materials.filter(m => getStockStatus(m.quantity, m.max_quantity) === 'red').length;

  const lowStockCount = yellowCount + redCount; // Expected: 15 + 31 = 46 or as configured

  // Transactions today
  const transactionsToday = transactions.filter(t => {
    const today = new Date().toDateString();
    return new Date(t.timestamp).toDateString() === today;
  }).length;

  // Category counts mapping
  const categoryCounts = materials.reduce((acc, curr) => {
    acc[curr.category] = (acc[curr.category] || 0) + 1;
    return acc;
  }, {} as { [key: string]: number });

  const categoryColors: { [key: string]: string } = {
    'Permetszerek': '#006837', // primary green
    'Műtrágyák': '#3b82f6',    // blue
    'Vetőmagok': '#eab308',    // yellow
    'Tápok': '#a855f7',        // purple
    'Adalékanyagok': '#ec4899',// pink
    'Egyéb': '#64748b'         // gray
  };

  // Filtered materials
  const filteredMaterials = materials.filter(m => {
    const matchesSearch = m.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          m.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          m.location.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = selectedCategory === 'All' || m.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  // Critical stock items (sorted by percentage ascending)
  const criticalStockItems = [...materials]
    .sort((a, b) => (a.quantity / a.max_quantity) - (b.quantity / b.max_quantity))
    .slice(0, 5);

  // Inline SVG Donut helper
  const renderDonutChart = () => {
    const categoriesList = Object.keys(categoryColors);
    const total = materials.length || 1;
    let accumulatedPercent = 0;

    return (
      <div className="category-chart-container">
        <div className="donut-svg-wrapper">
          <svg viewBox="0 0 100 100" width="100%" height="100%">
            {/* Base grey background */}
            <circle cx="50" cy="50" r="40" fill="transparent" stroke="#e2e8f0" strokeWidth="12" />
            {categoriesList.map((cat) => {
              const count = categoryCounts[cat] || 0;
              const percent = (count / total) * 100;
              if (percent <= 0) return null;

              const radius = 40;
              const circumference = 2 * Math.PI * radius; // ~251.2
              const strokeDasharray = `${(percent / 100) * circumference} ${circumference}`;
              const strokeDashoffset = `${-(accumulatedPercent / 100) * circumference}`;
              accumulatedPercent += percent;

              return (
                <circle
                  key={cat}
                  cx="50"
                  cy="50"
                  r={radius}
                  fill="transparent"
                  stroke={categoryColors[cat]}
                  strokeWidth="12"
                  strokeDasharray={strokeDasharray}
                  strokeDashoffset={strokeDashoffset}
                  transform="rotate(-90 50 50)" // Start from top
                />
              );
            })}
          </svg>
          <div className="donut-center-text">
            <p>Összesen</p>
            <h4>{totalMaterialsCount}</h4>
          </div>
        </div>

        <div className="legend-list">
          {categoriesList.map((cat) => {
            const count = categoryCounts[cat] || 0;
            const pct = totalMaterialsCount > 0 ? ((count / totalMaterialsCount) * 100).toFixed(1) : '0.0';
            return (
              <div key={cat} className="legend-item">
                <div className="legend-label-wrapper">
                  <div className="legend-color-dot" style={{ backgroundColor: categoryColors[cat] }} />
                  <span className="legend-name">{cat}</span>
                </div>
                <span className="legend-val">{count} db ({pct}%)</span>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  // ----------------------------------------------------
  // SUB-VIEW RENDERING
  // ----------------------------------------------------

  const renderMaterialsListView = () => (
    <div className="details-card" style={{ width: '100%' }}>
      <div className="details-card-header">
        <div>
          <h2 className="details-card-title">Készletlista és Keresés</h2>
          <p className="page-subtitle">Raktáron lévő anyagok részletes áttekintése</p>
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <select
            className="form-select"
            style={{ width: '160px', padding: '8px 12px' }}
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
          >
            <option value="All">Összes kategória</option>
            <option value="Permetszerek">Permetszerek</option>
            <option value="Műtrágyák">Műtrágyák</option>
            <option value="Vetőmagok">Vetőmagok</option>
            <option value="Tápok">Tápok</option>
            <option value="Adalékanyagok">Adalékanyagok</option>
            <option value="Egyéb">Egyéb</option>
          </select>
          <input
            type="text"
            className="form-input-text"
            style={{ width: '240px', padding: '8px 12px' }}
            placeholder="Keresés név / azonosító / hely..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      <div className="data-table-container">
        <table className="data-table">
          <thead>
            <tr>
              <th>Azonosító</th>
              <th>Megnevezés</th>
              <th>Kategória</th>
              <th>Raktárhely</th>
              <th>Készletszint</th>
              <th>Mértékegység</th>
              <th style={{ textAlign: 'right' }}>Műveletek</th>
            </tr>
          </thead>
          <tbody>
            {filteredMaterials.map((m) => {
              const status = getStockStatus(m.quantity, m.max_quantity);
              const pct = Math.round((m.quantity / m.max_quantity) * 100);
              
              return (
                <tr key={m.id}>
                  <td>
                    <span className="material-id-badge">{m.id}</span>
                  </td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      {m.image_url ? (
                        <img src={m.image_url} alt={m.name} style={{ width: '32px', height: '32px', borderRadius: '4px', objectFit: 'cover' }} />
                      ) : (
                        <div style={{ width: '32px', height: '32px', borderRadius: '4px', backgroundColor: 'var(--primary-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--primary)' }}>
                          <Package size={16} />
                        </div>
                      )}
                      <div>
                        <span style={{ fontWeight: 600 }}>{m.name}</span>
                      </div>
                    </div>
                  </td>
                  <td>{m.category}</td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--text-secondary)' }}>
                      <MapPin size={14} />
                      <span>{m.location}</span>
                    </div>
                  </td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span className={`qty-val ${status}`}>{m.quantity}</span>
                      <div className="progress-bar-container">
                        <div 
                          className={`progress-bar-fill ${status}`} 
                          style={{ width: `${Math.min(100, pct)}%` }}
                        />
                      </div>
                      <span className="pct-badge">{pct}%</span>
                    </div>
                  </td>
                  <td>{m.unit}</td>
                  <td style={{ textAlign: 'right' }}>
                    <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                      <button
                        type="button"
                        className="btn-secondary"
                        style={{ padding: '6px 12px', fontSize: '12px' }}
                        onClick={() => {
                          setTransactionMaterial(m);
                          setTransactionType('checkout');
                          setTransactionQty(1);
                          setTransactionNotes('');
                          setTransactionError(null);
                        }}
                      >
                        Kiadás / Bevétel
                      </button>
                      <button
                        type="button"
                        className="btn-secondary"
                        style={{ padding: '6px', color: 'var(--text-secondary)' }}
                        title="QR-kód megtekintése"
                        onClick={() => setViewingQrMaterial(m)}
                      >
                        <QrCode size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
            {filteredMaterials.length === 0 && (
              <tr>
                <td colSpan={7} style={{ textAlign: 'center', padding: '32px', color: 'var(--text-secondary)' }}>
                  Nem található a keresésnek megfelelő anyag.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );

  const renderMovementsView = () => (
    <div className="details-card" style={{ width: '100%' }}>
      <div className="details-card-header">
        <div>
          <h2 className="details-card-title">Készletmozgások Naplója</h2>
          <p className="page-subtitle">Minden bevételezés és kiadás időrendi követése</p>
        </div>
      </div>

      <div className="data-table-container">
        <table className="data-table">
          <thead>
            <tr>
              <th>Dátum / Idő</th>
              <th>Azonosító</th>
              <th>Megnevezés</th>
              <th>Típus</th>
              <th>Mennyiség</th>
              <th>Felhasználó</th>
              <th>Megjegyzés</th>
            </tr>
          </thead>
          <tbody>
            {transactions.map((t) => {
              const date = new Date(t.timestamp);
              const formattedDate = `${date.getFullYear()}. ${String(date.getMonth() + 1).padStart(2, '0')}. ${String(date.getDate()).padStart(2, '0')}. ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
              
              return (
                <tr key={t.id}>
                  <td style={{ color: 'var(--text-secondary)' }}>{formattedDate}</td>
                  <td><span className="material-id-badge">{t.material_id}</span></td>
                  <td style={{ fontWeight: 600 }}>{t.material_name}</td>
                  <td>
                    <span 
                      style={{
                        padding: '4px 8px',
                        borderRadius: '4px',
                        fontSize: '11px',
                        fontWeight: 600,
                        backgroundColor: t.type === 'intake' ? 'var(--primary-light)' : 'var(--danger-bg)',
                        color: t.type === 'intake' ? 'var(--primary)' : 'var(--danger)'
                      }}
                    >
                      {t.type === 'intake' ? 'Bevétel' : 'Kivétel'}
                    </span>
                  </td>
                  <td style={{ fontWeight: 700, color: t.type === 'intake' ? 'var(--success)' : 'var(--danger)' }}>
                    {t.quantity > 0 ? `+${t.quantity}` : t.quantity}
                  </td>
                  <td>{t.user_name}</td>
                  <td style={{ color: 'var(--text-secondary)', fontStyle: 'italic' }}>{t.notes || '—'}</td>
                </tr>
              );
            })}
            {transactions.length === 0 && (
              <tr>
                <td colSpan={7} style={{ textAlign: 'center', padding: '32px', color: 'var(--text-secondary)' }}>
                  Még nem történt készletmozgás.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );

  const renderQrCodesView = () => (
    <div className="details-card" style={{ width: '100%' }}>
      <div className="details-card-header">
        <div>
          <h2 className="details-card-title">QR-Kódok Generálása és Nyomtatása</h2>
          <p className="page-subtitle">Válassz ki egy anyagot a hozzá tartozó QR-kód letöltéséhez vagy nyomtatásához</p>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '20px' }}>
        {materials.map((m) => (
          <div 
            key={m.id} 
            className="qr-print-card"
            style={{ cursor: 'pointer', hover: 'transform scale(1.02)' } as any}
            onClick={() => setViewingQrMaterial(m)}
          >
            {m.qr_code_url ? (
              <img src={m.qr_code_url} alt={m.name} className="qr-image" style={{ width: '110px', height: '110px' }} />
            ) : (
              <div style={{ width: '110px', height: '110px', backgroundColor: 'var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                QR generálása...
              </div>
            )}
            <span className="qr-print-id" style={{ fontSize: '13px' }}>{m.id}</span>
            <span className="qr-print-name" style={{ fontSize: '11px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', width: '100%' }}>{m.name}</span>
          </div>
        ))}
      </div>
    </div>
  );

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
              <>
                <div className="page-title-section">
                  <div>
                    <h2 className="page-title">Főáttekintő dashboard</h2>
                    <p className="page-subtitle">Áttekintés a raktár készletéről és a legfontosabb mutatókról.</p>
                  </div>
                  <div style={{ color: 'var(--text-secondary)', fontSize: '13px', fontWeight: 500 }}>
                    {new Date().toLocaleDateString('hu-HU', { year: 'numeric', month: 'long', day: 'numeric' })}
                  </div>
                </div>

                {/* Dashboard Stats */}
                <div className="stats-grid">
                  <div className="stat-card">
                    <div className="stat-info">
                      <h3>Összes anyag</h3>
                      <div className="stat-value">{totalMaterialsCount}</div>
                      <div className="stat-change up">
                        <ArrowUpRight size={14} />
                        <span>+5 az előző héthez képest</span>
                      </div>
                    </div>
                    <div className="stat-icon-wrapper green">
                      <Package size={22} />
                    </div>
                  </div>

                  <div className="stat-card">
                    <div className="stat-info">
                      <h3>Alacsony készlet</h3>
                      <div className="stat-value" style={{ color: 'var(--danger)' }}>{lowStockCount}</div>
                      <div className="stat-change down" style={{ color: 'var(--warning)' }}>
                        <ArrowUpRight size={14} />
                        <span>+3 az előző héthez képest</span>
                      </div>
                    </div>
                    <div className="stat-icon-wrapper red">
                      <ShieldAlert size={22} />
                    </div>
                  </div>

                  <div className="stat-card">
                    <div className="stat-info">
                      <h3>Mai mozgások</h3>
                      <div className="stat-value">{transactionsToday}</div>
                      <div className="stat-change up">
                        <ArrowUpRight size={14} />
                        <span>+8 az előző naphoz képest</span>
                      </div>
                    </div>
                    <div className="stat-icon-wrapper green">
                      <ArrowLeftRight size={22} />
                    </div>
                  </div>
                </div>

                {/* Status blocks grid */}
                <div className="status-overview-grid">
                  <div className="status-block-card">
                    <div className="status-block-info">
                      <div className="status-indicator-label">
                        <div className="status-dot-large green" />
                        <span>Zöld szint (&gt;70%)</span>
                      </div>
                      <div className="status-block-value">{greenCount}</div>
                      <div className="status-block-pct">{totalMaterialsCount > 0 ? Math.round((greenCount / totalMaterialsCount) * 100) : 0}%</div>
                    </div>
                    <Sprout className="status-block-bg-icon" size={48} />
                  </div>

                  <div className="status-block-card">
                    <div className="status-block-info">
                      <div className="status-indicator-label">
                        <div className="status-dot-large yellow" />
                        <span>Sárga szint (40-70%)</span>
                      </div>
                      <div className="status-block-value">{yellowCount}</div>
                      <div className="status-block-pct">{totalMaterialsCount > 0 ? Math.round((yellowCount / totalMaterialsCount) * 100) : 0}%</div>
                    </div>
                    <ShieldAlert className="status-block-bg-icon" size={48} />
                  </div>

                  <div className="status-block-card">
                    <div className="status-block-info">
                      <div className="status-indicator-label">
                        <div className="status-dot-large red" />
                        <span>Piros szint (&lt;40%)</span>
                      </div>
                      <div className="status-block-value">{redCount}</div>
                      <div className="status-block-pct">{totalMaterialsCount > 0 ? Math.round((redCount / totalMaterialsCount) * 100) : 0}%</div>
                    </div>
                    <ShieldAlert className="status-block-bg-icon" size={48} />
                  </div>
                </div>

                {/* Double Column Grid */}
                <div className="dashboard-details-grid">
                  {/* Critical Inventory */}
                  <div className="details-card">
                    <div className="details-card-header">
                      <h3 className="details-card-title">Kritikus készletű anyagok</h3>
                      <button className="view-all-link" onClick={() => setActiveView('materials')}>
                        <span>Összes kritikus anyag megtekintése</span>
                        <ChevronRight size={16} />
                      </button>
                    </div>

                    <div className="data-table-container">
                      <table className="data-table">
                        <thead>
                          <tr>
                            <th>Státusz</th>
                            <th>Azonosító</th>
                            <th>Név</th>
                            <th>Készlet</th>
                            <th>Max</th>
                            <th>Szint</th>
                            <th>Hely</th>
                          </tr>
                        </thead>
                        <tbody>
                          {criticalStockItems.map((m) => {
                            const status = getStockStatus(m.quantity, m.max_quantity);
                            const pct = Math.round((m.quantity / m.max_quantity) * 100);
                            return (
                              <tr key={m.id}>
                                <td>
                                  <div className="material-status-cell">
                                    <div className={`status-dot ${status}`} />
                                  </div>
                                </td>
                                <td><span className="material-id-badge">{m.id}</span></td>
                                <td style={{ fontWeight: 600 }}>{m.name}</td>
                                <td><span className={`qty-val ${status}`}>{m.quantity} {m.unit}</span></td>
                                <td>{m.max_quantity} {m.unit}</td>
                                <td>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <div className="progress-bar-container" style={{ width: '60px' }}>
                                      <div className={`progress-bar-fill ${status}`} style={{ width: `${pct}%` }} />
                                    </div>
                                    <span style={{ fontSize: '11px' }}>{pct}%</span>
                                  </div>
                                </td>
                                <td>{m.location}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Category Donut chart */}
                  <div className="details-card">
                    <div className="details-card-header">
                      <h3 className="details-card-title">Kategória szerinti megoszlás</h3>
                    </div>
                    {renderDonutChart()}
                  </div>
                </div>

                {/* Bottom row: Recent movements */}
                <div className="dashboard-details-grid" style={{ gridTemplateColumns: '1fr 1.5fr' }}>
                  <div className="details-card" style={{ gridColumn: 'span 2' }}>
                    <div className="details-card-header">
                      <h3 className="details-card-title">Legutóbbi készletmozgások</h3>
                      <button className="view-all-link" onClick={() => setActiveView('movements')}>
                        <span>Összes mozgás megtekintése</span>
                        <ChevronRight size={16} />
                      </button>
                    </div>

                    <div className="movement-list" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                      {transactions.slice(0, 4).map((t) => (
                        <div key={t.id} className="movement-item" style={{ border: '1px solid var(--border)', borderRadius: '8px', padding: '12px' }}>
                          <div className="movement-left">
                            <div className={`movement-icon-wrapper ${t.type}`}>
                              {t.type === 'intake' ? <ArrowUpRight size={18} /> : <ArrowDownRight size={18} />}
                            </div>
                            <div className="movement-info">
                              <h4>{t.material_name} <span className="material-id-badge" style={{ fontSize: '10px' }}>{t.material_id}</span></h4>
                              <p>Végezte: {t.user_name} • {t.notes || 'Nincs megjegyzés'}</p>
                            </div>
                          </div>
                          <div className="movement-right">
                            <span className={`movement-qty ${t.type}`}>
                              {t.quantity > 0 ? `+${t.quantity}` : t.quantity}
                            </span>
                            <div className="movement-time">
                              {new Date(t.timestamp).toLocaleTimeString('hu-HU', { hour: '2-digit', minute: '2-digit' })}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </>
            )}

            {activeView === 'materials' && renderMaterialsListView()}
            {activeView === 'movements' && renderMovementsView()}
            {activeView === 'qr-codes' && renderQrCodesView()}
            
            {activeView === 'users' && (
              <div className="details-card">
                <h2 className="details-card-title" style={{ marginBottom: '16px' }}>Felhasználók Kezelése</h2>
                <div className="data-table-container">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Név</th>
                        <th>Email cím</th>
                        <th>Szerepkör</th>
                        <th>Státusz</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td style={{ fontWeight: 600 }}>Kovács Gábor</td>
                        <td>kovacs.gabor@ceg.hu</td>
                        <td>Raktárvezető (Admin)</td>
                        <td><span style={{ color: 'var(--success)', fontWeight: 600 }}>Aktív</span></td>
                      </tr>
                      <tr>
                        <td style={{ fontWeight: 600 }}>Kezelő János</td>
                        <td>kezelo.janos@ceg.hu</td>
                        <td>Kezelő</td>
                        <td><span style={{ color: 'var(--success)', fontWeight: 600 }}>Aktív</span></td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {activeView === 'settings' && (
              <div className="details-card" style={{ maxWidth: '600px' }}>
                <h2 className="details-card-title" style={{ marginBottom: '16px' }}>Rendszerbeállítások</h2>
                <h3 style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '8px' }}>Supabase Csatlakozás (Környezeti változók helyett)</h3>
                
                <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '20px' }}>
                  Ha a Supabase-t szeretnéd használni a helyi böngészőtárhely helyett, kérünk hozd létre a <code>.env.local</code> fájlt a projekt főkönyvtárában a következő kulcsokkal:
                </p>

                <div style={{ backgroundColor: '#1e293b', color: 'white', padding: '16px', borderRadius: '8px', fontFamily: 'monospace', fontSize: '13px', marginBottom: '20px' }}>
                  <div>VITE_SUPABASE_URL=https://sajat-projekt-azonosito.supabase.co</div>
                  <div>VITE_SUPABASE_ANON_KEY=sajat-anon-kulcs</div>
                </div>

                <div style={{ display: 'flex', gap: '10px' }}>
                  <button type="button" className="btn-primary" onClick={() => window.location.reload()}>
                    <RefreshCw size={16} style={{ marginRight: '6px' }} />
                    Rendszer Újratöltése
                  </button>
                </div>
              </div>
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
            <>
              {/* Horizontal Stats Row */}
              <div className="mobile-stats-row">
                <div className="mobile-stat-card">
                  <div className="mobile-stat-card-header">
                    <Package size={14} className="mobile-action-btn-icon" />
                    <span>Összes anyag</span>
                  </div>
                  <div className="mobile-stat-card-value">{totalMaterialsCount}</div>
                  <div className="mobile-stat-card-change" style={{ color: 'var(--success)' }}>+5 a héten ↑</div>
                </div>

                <div className="mobile-stat-card">
                  <div className="mobile-stat-card-header" style={{ color: 'var(--danger)' }}>
                    <ShieldAlert size={14} />
                    <span>Alacsony készlet</span>
                  </div>
                  <div className="mobile-stat-card-value" style={{ color: 'var(--danger)' }}>{lowStockCount}</div>
                  <div className="mobile-stat-card-change" style={{ color: 'var(--warning)' }}>+3 a héten ↑</div>
                </div>

                <div className="mobile-stat-card">
                  <div className="mobile-stat-card-header">
                    <ArrowLeftRight size={14} className="mobile-action-btn-icon" />
                    <span>Mai mozgások</span>
                  </div>
                  <div className="mobile-stat-card-value">{transactionsToday}</div>
                  <div className="mobile-stat-card-change" style={{ color: 'var(--success)' }}>+8 tegnap óta ↑</div>
                </div>
              </div>

              {/* Status Indicator block grid */}
              <div className="mobile-status-container">
                <div className="mobile-status-title">Készletszint áttekintés</div>
                <div className="mobile-status-row">
                  <div className="mobile-status-col green">
                    <div className="mobile-status-col-header">
                      <div className="status-dot green" />
                      <span>Zöld</span>
                    </div>
                    <div className="mobile-status-col-value">{greenCount}</div>
                    <div className="mobile-status-col-pct">{totalMaterialsCount > 0 ? Math.round((greenCount / totalMaterialsCount) * 100) : 0}%</div>
                  </div>

                  <div className="mobile-status-col yellow">
                    <div className="mobile-status-col-header">
                      <div className="status-dot yellow" />
                      <span>Sárga</span>
                    </div>
                    <div className="mobile-status-col-value">{yellowCount}</div>
                    <div className="mobile-status-col-pct">{totalMaterialsCount > 0 ? Math.round((yellowCount / totalMaterialsCount) * 100) : 0}%</div>
                  </div>

                  <div className="mobile-status-col red">
                    <div className="mobile-status-col-header">
                      <div className="status-dot red" />
                      <span>Piros</span>
                    </div>
                    <div className="mobile-status-col-value">{redCount}</div>
                    <div className="mobile-status-col-pct">{totalMaterialsCount > 0 ? Math.round((redCount / totalMaterialsCount) * 100) : 0}%</div>
                  </div>
                </div>
              </div>

              {/* Quick Actions Grid */}
              <div className="mobile-actions-grid">
                <button className="mobile-action-btn" onClick={() => setShowScanner(true)}>
                  <QrCode size={20} className="mobile-action-btn-icon" />
                  <span className="mobile-action-btn-text">QR beolvasás</span>
                </button>

                <button className="mobile-action-btn" onClick={() => setShowNewMaterialModal(true)}>
                  <Plus size={20} className="mobile-action-btn-icon" />
                  <span className="mobile-action-btn-text">Új anyag</span>
                </button>

                <button className="mobile-action-btn" onClick={() => setMobileTab('movements')}>
                  <ArrowLeftRight size={20} className="mobile-action-btn-icon" />
                  <span className="mobile-action-btn-text">Mozgások</span>
                </button>

                <button className="mobile-action-btn" onClick={() => setMobileTab('search')}>
                  <ClipboardList size={20} className="mobile-action-btn-icon" />
                  <span className="mobile-action-btn-text">Készletlista</span>
                </button>
              </div>

              {/* Critical Stocks List */}
              <div className="mobile-section-header">
                <span className="mobile-section-title">Kritikus készlet</span>
                <button className="mobile-section-link" onClick={() => setMobileTab('search')}>
                  Összes megtekintése &gt;
                </button>
              </div>

              <div className="mobile-stock-list">
                {criticalStockItems.map((m) => {
                  const status = getStockStatus(m.quantity, m.max_quantity);
                  const pct = Math.round((m.quantity / m.max_quantity) * 100);
                  return (
                    <div 
                      key={m.id} 
                      className="mobile-stock-card"
                      onClick={() => handleScanSuccess(m.id)}
                    >
                      <div className="mobile-stock-card-left">
                        <div className={`status-dot ${status}`} style={{ width: '10px', height: '10px' }} />
                        <div className="mobile-stock-info">
                          <h4>{m.id}</h4>
                          <p>{m.name}</p>
                        </div>
                      </div>
                      <div className="mobile-stock-card-right">
                        <span className={`mobile-stock-qty ${status}`}>{m.quantity} {m.unit}</span>
                        <div className="progress-bar-container" style={{ width: '60px' }}>
                          <div className={`progress-bar-fill ${status}`} style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Recent movements */}
              <div className="mobile-section-header">
                <span className="mobile-section-title">Legutóbbi mozgások</span>
                <button className="mobile-section-link" onClick={() => setMobileTab('movements')}>
                  Összes megtekintése &gt;
                </button>
              </div>

              <div className="mobile-stock-list">
                {transactions.slice(0, 3).map((t) => (
                  <div key={t.id} className="mobile-stock-card" style={{ padding: '12px' }}>
                    <div className="mobile-stock-card-left">
                      <div className={`movement-icon-wrapper ${t.type}`} style={{ width: '28px', height: '28px' }}>
                        {t.type === 'intake' ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
                      </div>
                      <div className="mobile-stock-info">
                        <h4 style={{ fontSize: '12px' }}>{t.material_name}</h4>
                        <p style={{ fontSize: '10px' }}>Kiadta: {t.user_name}</p>
                      </div>
                    </div>
                    <div className="mobile-stock-card-right">
                      <span className={`movement-qty ${t.type}`} style={{ fontSize: '12px' }}>
                        {t.quantity > 0 ? `+${t.quantity}` : t.quantity}
                      </span>
                      <span style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>
                        {new Date(t.timestamp).toLocaleTimeString('hu-HU', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}

          {mobileTab === 'search' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3 className="mobile-section-title">Raktári Anyagok</h3>
                <select
                  className="form-select"
                  style={{ width: '130px', padding: '6px', fontSize: '12px' }}
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                >
                  <option value="All">Összes kategória</option>
                  <option value="Permetszerek">Permetszerek</option>
                  <option value="Műtrágyák">Műtrágyák</option>
                  <option value="Vetőmagok">Vetőmagok</option>
                  <option value="Tápok">Tápok</option>
                  <option value="Adalékanyagok">Adalékanyagok</option>
                  <option value="Egyéb">Egyéb</option>
                </select>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {filteredMaterials.map((m) => {
                  const status = getStockStatus(m.quantity, m.max_quantity);
                  const pct = Math.round((m.quantity / m.max_quantity) * 100);
                  
                  return (
                    <div 
                      key={m.id} 
                      className="mobile-stock-card"
                      style={{ padding: '12px' }}
                      onClick={() => handleScanSuccess(m.id)}
                    >
                      <div className="mobile-stock-card-left">
                        {m.image_url ? (
                          <img src={m.image_url} alt={m.name} style={{ width: '40px', height: '40px', borderRadius: '4px', objectFit: 'cover' }} />
                        ) : (
                          <div style={{ width: '40px', height: '40px', borderRadius: '4px', backgroundColor: 'var(--primary-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--primary)' }}>
                            <Package size={20} />
                          </div>
                        )}
                        <div className="mobile-stock-info">
                          <h4 style={{ fontSize: '13px' }}>{m.name}</h4>
                          <p style={{ fontSize: '10px' }}>Azonosító: {m.id} • Hely: {m.location}</p>
                        </div>
                      </div>
                      <div className="mobile-stock-card-right">
                        <span className={`mobile-stock-qty ${status}`} style={{ fontSize: '13px' }}>{m.quantity} {m.unit}</span>
                        <span className="pct-badge" style={{ fontSize: '10px', margin: 0 }}>{pct}% szint</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {mobileTab === 'movements' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <h3 className="mobile-section-title">Minden mozgás</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {transactions.map((t) => (
                  <div key={t.id} className="mobile-stock-card" style={{ padding: '12px' }}>
                    <div className="mobile-stock-card-left">
                      <div className={`movement-icon-wrapper ${t.type}`} style={{ width: '28px', height: '28px' }}>
                        {t.type === 'intake' ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
                      </div>
                      <div className="mobile-stock-info" style={{ maxWidth: '170px' }}>
                        <h4 style={{ fontSize: '12px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.material_name}</h4>
                        <p style={{ fontSize: '10px' }}>{t.user_name} • {t.notes || 'Nincs megjegyzés'}</p>
                      </div>
                    </div>
                    <div className="mobile-stock-card-right">
                      <span className={`movement-qty ${t.type}`} style={{ fontSize: '12px' }}>
                        {t.quantity > 0 ? `+${t.quantity}` : t.quantity}
                      </span>
                      <span style={{ fontSize: '9px', color: 'var(--text-secondary)' }}>
                        {new Date(t.timestamp).toLocaleDateString('hu-HU', { month: '2-digit', day: '2-digit' })} {new Date(t.timestamp).toLocaleTimeString('hu-HU', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
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
        <div className="modal-overlay">
          <div className="modal-card" style={{ maxWidth: '440px' }}>
            <div className="modal-header">
              <div className="modal-title">
                {transactionMaterial.id} — Készletmódosítás
              </div>
              <button onClick={() => setTransactionMaterial(null)} aria-label="Bezárás">
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleTransactionSubmit}>
              <div className="modal-body">
                {/* Product quick info card */}
                <div 
                  style={{
                    display: 'flex',
                    gap: '12px',
                    padding: '12px',
                    backgroundColor: 'var(--bg-app)',
                    borderRadius: '8px',
                    border: '1px solid var(--border)',
                    marginBottom: '20px',
                  }}
                >
                  {transactionMaterial.image_url ? (
                    <img 
                      src={transactionMaterial.image_url} 
                      alt={transactionMaterial.name} 
                      style={{ width: '56px', height: '56px', borderRadius: '4px', objectFit: 'cover' }} 
                    />
                  ) : (
                    <div style={{ width: '56px', height: '56px', borderRadius: '4px', backgroundColor: 'var(--primary-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--primary)' }}>
                      <Package size={24} style={{ margin: '0 auto' }} />
                    </div>
                  )}
                  <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                    <h4 style={{ fontSize: '14px', fontWeight: 700 }}>{transactionMaterial.name}</h4>
                    <p style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                      Kategória: {transactionMaterial.category} • Hely: {transactionMaterial.location}
                    </p>
                    <p style={{ fontSize: '12px', fontWeight: 600, color: 'var(--primary)', marginTop: '2px' }}>
                      Jelenlegi készlet: {transactionMaterial.quantity} / {transactionMaterial.max_quantity} {transactionMaterial.unit}
                    </p>
                  </div>
                </div>

                {transactionError && (
                  <div
                    style={{
                      display: 'flex',
                      gap: '8px',
                      padding: '10px',
                      borderRadius: '6px',
                      backgroundColor: 'var(--danger-bg)',
                      color: 'var(--danger)',
                      fontSize: '12px',
                      marginBottom: '16px'
                    }}
                  >
                    <AlertCircle size={16} style={{ flexShrink: 0 }} />
                    <div>{transactionError}</div>
                  </div>
                )}

                {/* Transaction type switcher */}
                <div className="form-group">
                  <label className="form-label">Művelet Típusa</label>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button
                      type="button"
                      className="btn-secondary"
                      style={{
                        flex: 1,
                        backgroundColor: transactionType === 'checkout' ? 'var(--danger-bg)' : 'transparent',
                        borderColor: transactionType === 'checkout' ? 'var(--danger)' : 'var(--border)',
                        color: transactionType === 'checkout' ? 'var(--danger)' : 'var(--text-primary)',
                        fontWeight: transactionType === 'checkout' ? 700 : 500,
                      }}
                      onClick={() => setTransactionType('checkout')}
                    >
                      <ArrowDownRight size={16} style={{ marginRight: '6px' }} />
                      Kivétel (Kiadás)
                    </button>
                    <button
                      type="button"
                      className="btn-secondary"
                      style={{
                        flex: 1,
                        backgroundColor: transactionType === 'intake' ? 'var(--primary-light)' : 'transparent',
                        borderColor: transactionType === 'intake' ? 'var(--primary)' : 'var(--border)',
                        color: transactionType === 'intake' ? 'var(--primary)' : 'var(--text-primary)',
                        fontWeight: transactionType === 'intake' ? 700 : 500,
                      }}
                      onClick={() => setTransactionType('intake')}
                    >
                      <ArrowUpRight size={16} style={{ marginRight: '6px' }} />
                      Bevétel (Töltés)
                    </button>
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label" htmlFor="txQty">Mennyiség ({transactionMaterial.unit})</label>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <input
                      id="txQty"
                      type="number"
                      required
                      min="0.1"
                      step="any"
                      className="form-input-text"
                      style={{ flex: 1 }}
                      value={transactionQty === 0 ? '' : transactionQty}
                      onChange={(e) => setTransactionQty(Number(e.target.value))}
                    />
                    <div style={{ display: 'flex', gap: '4px' }}>
                      {[1, 2, 5, 10, 50].map((num) => (
                        <button
                          key={num}
                          type="button"
                          className="btn-secondary"
                          style={{ padding: '8px 12px', fontSize: '12px' }}
                          onClick={() => setTransactionQty(num)}
                        >
                          +{num}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label" htmlFor="txNotes">Megjegyzés (opcionális)</label>
                  <input
                    id="txNotes"
                    type="text"
                    className="form-input-text"
                    placeholder="pl. Napi permetezéshez, megrendelés érkezett..."
                    value={transactionNotes}
                    onChange={(e) => setTransactionNotes(e.target.value)}
                  />
                </div>
              </div>

              <div className="modal-footer">
                <button type="button" className="btn-secondary" onClick={() => setTransactionMaterial(null)}>
                  Mégsem
                </button>
                <button
                  type="submit"
                  className="btn-primary"
                  style={{
                    width: 'auto',
                    paddingInline: '24px',
                    backgroundColor: transactionType === 'checkout' ? 'var(--danger)' : 'var(--primary)',
                  }}
                >
                  Rögzítés
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 4. Modal: VIEW QR FOR PRINT */}
      {viewingQrMaterial && (
        <div className="modal-overlay">
          <div className="modal-card" style={{ maxWidth: '340px' }}>
            <div className="modal-header">
              <div className="modal-title">QR-Kód letöltés</div>
              <button onClick={() => setViewingQrMaterial(null)} aria-label="Bezárás">
                <X size={20} />
              </button>
            </div>
            <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <div 
                style={{
                  border: '1px solid var(--border)',
                  padding: '20px',
                  borderRadius: '12px',
                  backgroundColor: 'white',
                  textAlign: 'center',
                  boxShadow: 'var(--shadow-sm)',
                  width: '100%',
                }}
              >
                {viewingQrMaterial.qr_code_url ? (
                  <img src={viewingQrMaterial.qr_code_url} alt={viewingQrMaterial.name} style={{ width: '180px', height: '180px' }} />
                ) : (
                  <div style={{ width: '180px', height: '180px', backgroundColor: 'var(--border)' }} />
                )}
                <h4 style={{ fontFamily: 'monospace', fontSize: '18px', fontWeight: 700, marginTop: '12px' }}>{viewingQrMaterial.id}</h4>
                <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '4px' }}>{viewingQrMaterial.name}</p>
                <p style={{ fontSize: '11px', color: 'var(--text-light)', marginTop: '2px' }}>Helyszín: {viewingQrMaterial.location}</p>
              </div>

              <button 
                type="button" 
                className="btn-primary" 
                style={{ marginTop: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
                onClick={() => {
                  const printWin = window.open('', '_blank');
                  if (printWin) {
                    printWin.document.write(`
                      <html>
                        <head>
                          <title>QR kód nyomtatás - ${viewingQrMaterial.id}</title>
                          <style>
                            body { font-family: sans-serif; display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100vh; margin: 0; }
                            .card { border: 2px solid #ccc; padding: 30px; border-radius: 15px; text-align: center; }
                            img { width: 220px; height: 220px; }
                            h2 { margin: 15px 0 5px 0; font-family: monospace; font-size: 24px; }
                            p { margin: 0; color: #555; }
                          </style>
                        </head>
                        <body>
                          <div class="card">
                            <img src="${viewingQrMaterial.qr_code_url}" />
                            <h2>${viewingQrMaterial.id}</h2>
                            <p>${viewingQrMaterial.name}</p>
                            <p style="font-size: 12px; color: #999; margin-top: 5px;">SmartFarm Raktárhely: ${viewingQrMaterial.location}</p>
                          </div>
                          <script>
                            window.onload = function() { window.print(); window.close(); }
                          </script>
                        </body>
                      </html>
                    `);
                    printWin.document.close();
                  }
                }}
              >
                <Printer size={16} />
                <span>QR-Kód Nyomtatása</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
