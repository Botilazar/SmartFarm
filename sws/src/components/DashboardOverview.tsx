import React from 'react';
import { 
  Sprout, Package, ArrowLeftRight, ShieldAlert, ArrowUpRight, ArrowDownRight, ChevronRight,
  QrCode, Plus, ChevronUp, ChevronDown, ArrowUpDown
} from 'lucide-react';
import { getStockStatus } from '../db/dbService';
import type { Material, Transaction } from '../db/dbService';
import { useTranslation } from '../context/LanguageContext';

interface DashboardOverviewProps {
  materials: Material[];
  transactions: Transaction[];
  setActiveView: (view: 'dashboard' | 'materials' | 'movements' | 'qr-codes' | 'users' | 'settings') => void;
  isMobile?: boolean;
  setShowScanner?: (s: boolean) => void;
  setShowNewMaterialModal?: (m: boolean) => void;
  setMobileTab?: (t: 'home' | 'materials' | 'qr' | 'movements' | 'profile') => void;
  onMobileStockCardClick?: (materialId: string) => void;
  loading?: boolean;
}

const categoryColors: { [key: string]: string } = {
  'Permetszerek': '#006837', // primary green
  'Műtrágyák': '#3b82f6',    // blue
  'Vetőmagok': '#eab308',    // yellow
  'Tápok': '#a855f7',        // purple
  'Adalékanyagok': '#ec4899',// pink
  'Egyéb': '#64748b'         // gray
};

export const DashboardOverview: React.FC<DashboardOverviewProps> = ({ 
  materials, 
  transactions, 
  setActiveView,
  isMobile = false,
  setShowScanner,
  setShowNewMaterialModal,
  setMobileTab,
  onMobileStockCardClick,
  loading = false
}) => {
  const { t, language } = useTranslation();
  const [selectedNotes, setSelectedNotes] = React.useState<string | null>(null);
  
  const totalMaterialsCount = materials.length;

  const greenCount = materials.filter(m => getStockStatus(m.quantity, m.max_quantity) === 'green').length;
  const yellowCount = materials.filter(m => getStockStatus(m.quantity, m.max_quantity) === 'yellow').length;
  const redCount = materials.filter(m => getStockStatus(m.quantity, m.max_quantity) === 'red').length;

  const lowStockCount = yellowCount + redCount;

  const transactionsToday = transactions.filter(tItem => {
    const today = new Date().toDateString();
    return new Date(tItem.timestamp).toDateString() === today;
  }).length;

  const categoryCounts = materials.reduce((acc, curr) => {
    acc[curr.category] = (acc[curr.category] || 0) + 1;
    return acc;
  }, {} as { [key: string]: number });

  const [criticalSortField, setCriticalSortField] = React.useState<'status' | 'id' | 'name' | 'stock' | 'max_quantity' | 'level' | 'location' | null>(null);
  const [criticalSortDirection, setCriticalSortDirection] = React.useState<'asc' | 'desc'>('asc');

  const defaultCriticalItems = React.useMemo(() => {
    return [...materials]
      .sort((a, b) => (a.quantity / a.max_quantity) - (b.quantity / b.max_quantity))
      .slice(0, 5);
  }, [materials]);

  const criticalStockItems = React.useMemo(() => {
    if (!criticalSortField) return defaultCriticalItems;

    return [...defaultCriticalItems].sort((a, b) => {
      let valA: any = '';
      let valB: any = '';

      switch (criticalSortField) {
        case 'status':
          valA = getStockStatus(a.quantity, a.max_quantity);
          valB = getStockStatus(b.quantity, b.max_quantity);
          break;
        case 'id':
          valA = a.id;
          valB = b.id;
          break;
        case 'name':
          valA = a.name;
          valB = b.name;
          break;
        case 'stock':
          valA = a.quantity;
          valB = b.quantity;
          break;
        case 'max_quantity':
          valA = a.max_quantity;
          valB = b.max_quantity;
          break;
        case 'level':
          valA = a.quantity / a.max_quantity;
          valB = b.quantity / b.max_quantity;
          break;
        case 'location':
          valA = a.location;
          valB = b.location;
          break;
        default:
          return 0;
      }

      if (typeof valA === 'number' && typeof valB === 'number') {
        return criticalSortDirection === 'asc' ? valA - valB : valB - valA;
      }

      const strA = String(valA).toLowerCase();
      const strB = String(valB).toLowerCase();
      if (strA < strB) return criticalSortDirection === 'asc' ? -1 : 1;
      if (strA > strB) return criticalSortDirection === 'asc' ? 1 : -1;
      return 0;
    });
  }, [defaultCriticalItems, criticalSortField, criticalSortDirection]);

  const handleCriticalSort = (field: 'status' | 'id' | 'name' | 'stock' | 'max_quantity' | 'level' | 'location') => {
    if (criticalSortField === field) {
      setCriticalSortDirection(criticalSortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setCriticalSortField(field);
      setCriticalSortDirection('asc');
    }
  };

  const renderCriticalSortIcon = (field: 'status' | 'id' | 'name' | 'stock' | 'max_quantity' | 'level' | 'location') => {
    if (criticalSortField !== field) {
      return <ArrowUpDown size={12} style={{ opacity: 0.4, marginLeft: '6px' }} />;
    }
    return criticalSortDirection === 'asc' ? (
      <ChevronUp size={12} style={{ color: 'var(--primary)', marginLeft: '6px' }} />
    ) : (
      <ChevronDown size={12} style={{ color: 'var(--primary)', marginLeft: '6px' }} />
    );
  };

  const renderDonutChart = () => {
    const categoriesList = Object.keys(categoryColors);
    const total = materials.length || 1;
    let accumulatedPercent = 0;

    return (
      <div className="category-chart-container">
        <div className="donut-svg-wrapper">
          <svg viewBox="0 0 100 100" width="100%" height="100%">
            <circle cx="50" cy="50" r="40" fill="transparent" stroke="#e2e8f0" strokeWidth="12" />
            {categoriesList.map((cat) => {
              const count = categoryCounts[cat] || 0;
              const percent = (count / total) * 100;
              if (percent <= 0) return null;

              const radius = 40;
              const circumference = 2 * Math.PI * radius;
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
                  transform="rotate(-90 50 50)"
                />
              );
            })}
          </svg>
          <div className="donut-center-text">
            <p>{t('totalText')}</p>
            <h4>{totalMaterialsCount}</h4>
          </div>
        </div>

        <div className="legend-list">
          {categoriesList.map((cat) => {
            const count = categoryCounts[cat] || 0;
            const percent = totalMaterialsCount > 0 ? Math.round((count / totalMaterialsCount) * 100) : 0;
            return (
              <div key={cat} className="legend-item">
                <div className="legend-label-wrapper">
                  <div className="legend-color-dot" style={{ backgroundColor: categoryColors[cat] }} />
                  <span className="legend-name">{t(`cat_${cat}`)}</span>
                </div>
                <span className="legend-val">{count} {t('unitDb')} ({percent}%)</span>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const getLocaleDateString = () => {
    const locale = language === 'hu' ? 'hu-HU' : language === 'en' ? 'en-US' : 'de-DE';
    return new Date().toLocaleDateString(locale, { year: 'numeric', month: 'long', day: 'numeric' });
  };

  const getLocaleTimeString = (timestamp: string) => {
    const locale = language === 'hu' ? 'hu-HU' : language === 'en' ? 'en-US' : 'de-DE';
    return new Date(timestamp).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' });
  };

  if (isMobile) {
    return (
      <>
        {/* Mobile Stats grid */}
        <div style={{ display: 'flex', gap: '10px', overflowX: 'auto', paddingBottom: '4px', marginBottom: '20px' }}>
          <div className="mobile-stat-card">
            <div className="mobile-stat-card-header">
              <span className="mobile-stat-title">{t('cardTotalMaterials')}</span>
              <div className="mobile-stat-icon green"><Package size={16} /></div>
            </div>
            <div className="mobile-stat-card-value">{loading ? <span className="skeleton-loader skeleton-number" /> : totalMaterialsCount}</div>
            <span className="mobile-stat-card-change" style={{ color: 'var(--success)' }}>+5 {t('comparedToLastWeek')}</span>
          </div>

          <div className="mobile-stat-card">
            <div className="mobile-stat-card-header">
              <span className="mobile-stat-title">{t('cardLowStock')}</span>
              <div className="mobile-stat-icon red"><ShieldAlert size={16} /></div>
            </div>
            <div className="mobile-stat-card-value" style={{ color: 'var(--danger)' }}>{loading ? <span className="skeleton-loader skeleton-number" /> : lowStockCount}</div>
            <span className="mobile-stat-card-change" style={{ color: 'var(--warning)' }}>+3 {t('comparedToLastWeek')}</span>
          </div>

          <div className="mobile-stat-card">
            <div className="mobile-stat-card-header">
              <span className="mobile-stat-title">{t('cardTodayMovements')}</span>
              <div className="mobile-stat-icon green"><ArrowLeftRight size={16} /></div>
            </div>
            <div className="mobile-stat-card-value">{loading ? <span className="skeleton-loader skeleton-number" /> : transactionsToday}</div>
            <span className="mobile-stat-card-change" style={{ color: 'var(--success)' }}>+8 {t('comparedToYesterday')}</span>
          </div>
        </div>

        {/* Mobile Quick actions */}
        <div style={{ display: 'flex', gap: '10px', marginBottom: '24px' }}>
          <button
            type="button"
            className="btn-primary"
            style={{ flex: 1, padding: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', fontSize: '13px' }}
            onClick={() => setShowScanner && setShowScanner(true)}
          >
            <QrCode size={18} />
            <span>{t('qrScanBtn')}</span>
          </button>
          <button
            type="button"
            className="btn-secondary"
            style={{ flex: 1, padding: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', fontSize: '13px' }}
            onClick={() => setShowNewMaterialModal && setShowNewMaterialModal(true)}
          >
            <Plus size={18} />
            <span>{t('navNewMaterial')}</span>
          </button>
        </div>

        {/* Mobile critical inventory stock list */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
          <span className="mobile-section-title">{t('criticalStockTitle')}</span>
          <button className="mobile-section-link" onClick={() => setMobileTab && setMobileTab('materials')}>
            {t('viewAllCritical').split(' ')[0]} &gt;
          </button>
        </div>

        <div className="mobile-stock-list" style={{ marginBottom: '24px' }}>
          {loading ? (
            Array.from({ length: 3 }).map((_, idx) => (
              <div key={`sk-crit-${idx}`} className="mobile-stock-card" style={{ padding: '12px' }}>
                <div className="mobile-stock-card-left">
                  <div className="skeleton-loader" style={{ width: '40px', height: '40px', borderRadius: '4px' }} />
                  <div className="mobile-stock-info">
                    <div className="skeleton-loader skeleton-text" style={{ width: '120px', marginBottom: '6px' }} />
                    <div className="skeleton-loader skeleton-text" style={{ width: '80px', height: '12.5px' }} />
                  </div>
                </div>
                <div className="mobile-stock-card-right">
                  <div className="skeleton-loader skeleton-badge" style={{ width: '50px', height: '18px', marginBottom: '4px' }} />
                  <div className="skeleton-loader skeleton-badge" style={{ width: '30px', height: '12.5px' }} />
                </div>
              </div>
            ))
          ) : (
            criticalStockItems.map((m) => {
              const status = getStockStatus(m.quantity, m.max_quantity);
              const pct = Math.round((m.quantity / m.max_quantity) * 100);
              return (
                <div 
                  key={m.id} 
                  className="mobile-stock-card"
                  style={{ padding: '12px' }}
                  onClick={() => onMobileStockCardClick && onMobileStockCardClick(m.id)}
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
                      <p style={{ fontSize: '10px' }}>{t('statId')}: {m.id} • {t('statLocation')}: {m.location}</p>
                    </div>
                  </div>
                  <div className="mobile-stock-card-right">
                    <span className={`mobile-stock-qty ${status}`} style={{ fontSize: '13px' }}>{m.quantity} {m.unit}</span>
                    <span className="pct-badge" style={{ fontSize: '10px', margin: 0 }}>{pct}%</span>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Mobile recent movements list */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
          <span className="mobile-section-title">{t('movTitle')}</span>
          <button className="mobile-section-link" onClick={() => setMobileTab && setMobileTab('movements')}>
            {t('viewAllCritical').split(' ')[0]} &gt;
          </button>
        </div>

        <div className="mobile-stock-list">
          {loading ? (
            Array.from({ length: 3 }).map((_, idx) => (
              <div key={`sk-mov-${idx}`} className="mobile-stock-card" style={{ padding: '12px' }}>
                <div className="mobile-stock-card-left">
                  <div className="skeleton-loader" style={{ width: '28px', height: '28px', borderRadius: '50%' }} />
                  <div className="mobile-stock-info">
                    <div className="skeleton-loader skeleton-text" style={{ width: '100px', marginBottom: '6px' }} />
                    <div className="skeleton-loader skeleton-text" style={{ width: '60px', height: '12.5px' }} />
                  </div>
                </div>
                <div className="mobile-stock-card-right">
                  <div className="skeleton-loader skeleton-badge" style={{ width: '40px', height: '16px', marginBottom: '4px' }} />
                  <div className="skeleton-loader skeleton-badge" style={{ width: '30px', height: '12.5px' }} />
                </div>
              </div>
            ))
          ) : (
            transactions.slice(0, 3).map((tItem) => (
              <div key={tItem.id} className="mobile-stock-card" style={{ padding: '12px' }}>
                <div className="mobile-stock-card-left">
                  <div className={`movement-icon-wrapper ${tItem.type}`} style={{ width: '28px', height: '28px' }}>
                    {tItem.type === 'intake' ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
                  </div>
                  <div className="mobile-stock-info">
                    <h4 style={{ fontSize: '12px' }}>{tItem.material_name}</h4>
                    <p style={{ fontSize: '10px' }}>{tItem.user_name}</p>
                  </div>
                </div>
                <div className="mobile-stock-card-right">
                  <span className={`movement-qty ${tItem.type}`} style={{ fontSize: '12px' }}>
                    {tItem.quantity > 0 ? `+${tItem.quantity}` : tItem.quantity}
                  </span>
                  <span style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>
                    {getLocaleTimeString(tItem.timestamp)}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      </>
    );
  }

  return (
    <>
      <div className="page-title-section">
        <div>
          <h2 className="page-title">{t('dbTitle')}</h2>
          <p className="page-subtitle">{t('dbSubtitle')}</p>
        </div>
        <div style={{ color: 'var(--text-secondary)', fontSize: '13px', fontWeight: 500 }}>
          {getLocaleDateString()}
        </div>
      </div>

      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-info">
            <h3>{t('cardTotalMaterials')}</h3>
            <div className="stat-value">{loading ? <span className="skeleton-loader skeleton-number" /> : totalMaterialsCount}</div>
            <div className="stat-change up">
              <ArrowUpRight size={14} />
              <span>+5 {t('comparedToLastWeek')}</span>
            </div>
          </div>
          <div className="stat-icon-wrapper green">
            <Package size={22} />
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-info">
            <h3>{t('cardLowStock')}</h3>
            <div className="stat-value" style={{ color: 'var(--danger)' }}>{loading ? <span className="skeleton-loader skeleton-number" /> : lowStockCount}</div>
            <div className="stat-change down" style={{ color: 'var(--warning)' }}>
              <ArrowUpRight size={14} />
              <span>+3 {t('comparedToLastWeek')}</span>
            </div>
          </div>
          <div className="stat-icon-wrapper red">
            <ShieldAlert size={22} />
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-info">
            <h3>{t('cardTodayMovements')}</h3>
            <div className="stat-value">{loading ? <span className="skeleton-loader skeleton-number" /> : transactionsToday}</div>
            <div className="stat-change up">
              <ArrowUpRight size={14} />
              <span>+8 {t('comparedToYesterday')}</span>
            </div>
          </div>
          <div className="stat-icon-wrapper green">
            <ArrowLeftRight size={22} />
          </div>
        </div>
      </div>

      <div className="status-overview-grid">
        <div className="status-block-card">
          <div className="status-block-info">
            <div className="status-indicator-label">
              <div className="status-dot-large green" />
              <span>{t('levelGreen')}</span>
            </div>
            <div className="status-block-value">{loading ? <span className="skeleton-loader skeleton-number" style={{ height: '38px', width: '40px' }} /> : greenCount}</div>
            <div className="status-block-pct">
              {loading ? <span className="skeleton-loader skeleton-badge" /> : `${totalMaterialsCount > 0 ? Math.round((greenCount / totalMaterialsCount) * 100) : 0}%`}
            </div>
          </div>
          <Sprout className="status-block-bg-icon" size={48} />
        </div>

        <div className="status-block-card">
          <div className="status-block-info">
            <div className="status-indicator-label">
              <div className="status-dot-large yellow" />
              <span>{t('levelYellow')}</span>
            </div>
            <div className="status-block-value">{loading ? <span className="skeleton-loader skeleton-number" style={{ height: '38px', width: '40px' }} /> : yellowCount}</div>
            <div className="status-block-pct">
              {loading ? <span className="skeleton-loader skeleton-badge" /> : `${totalMaterialsCount > 0 ? Math.round((yellowCount / totalMaterialsCount) * 100) : 0}%`}
            </div>
          </div>
          <ShieldAlert className="status-block-bg-icon" size={48} />
        </div>

        <div className="status-block-card">
          <div className="status-block-info">
            <div className="status-indicator-label">
              <div className="status-dot-large red" />
              <span>{t('levelRed')}</span>
            </div>
            <div className="status-block-value">{loading ? <span className="skeleton-loader skeleton-number" style={{ height: '38px', width: '40px' }} /> : redCount}</div>
            <div className="status-block-pct">
              {loading ? <span className="skeleton-loader skeleton-badge" /> : `${totalMaterialsCount > 0 ? Math.round((redCount / totalMaterialsCount) * 100) : 0}%`}
            </div>
          </div>
          <ShieldAlert className="status-block-bg-icon" size={48} />
        </div>
      </div>

      <div className="dashboard-details-grid">
        <div className="details-card">
          <div className="details-card-header">
            <h3 className="details-card-title">{t('criticalStockTitle')}</h3>
            <button className="view-all-link" onClick={() => setActiveView('materials')}>
              <span>{t('viewAllCritical')}</span>
              <ChevronRight size={16} />
            </button>
          </div>

          <div className="data-table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th className="sortable" onClick={() => handleCriticalSort('status')}>
                    <div style={{ display: 'flex', alignItems: 'center' }}>
                      {t('statStatus')}
                      {renderCriticalSortIcon('status')}
                    </div>
                  </th>
                  <th className="sortable" onClick={() => handleCriticalSort('id')}>
                    <div style={{ display: 'flex', alignItems: 'center' }}>
                      {t('statId')}
                      {renderCriticalSortIcon('id')}
                    </div>
                  </th>
                  <th className="sortable" onClick={() => handleCriticalSort('name')}>
                    <div style={{ display: 'flex', alignItems: 'center' }}>
                      {t('statName')}
                      {renderCriticalSortIcon('name')}
                    </div>
                  </th>
                  <th className="sortable" onClick={() => handleCriticalSort('stock')}>
                    <div style={{ display: 'flex', alignItems: 'center' }}>
                      {t('statStock')}
                      {renderCriticalSortIcon('stock')}
                    </div>
                  </th>
                  <th className="sortable" onClick={() => handleCriticalSort('max_quantity')}>
                    <div style={{ display: 'flex', alignItems: 'center' }}>
                      MAX
                      {renderCriticalSortIcon('max_quantity')}
                    </div>
                  </th>
                  <th className="sortable" onClick={() => handleCriticalSort('level')}>
                    <div style={{ display: 'flex', alignItems: 'center' }}>
                      {t('statLevel')}
                      {renderCriticalSortIcon('level')}
                    </div>
                  </th>
                  <th className="sortable" onClick={() => handleCriticalSort('location')}>
                    <div style={{ display: 'flex', alignItems: 'center' }}>
                      {t('statLocation')}
                      {renderCriticalSortIcon('location')}
                    </div>
                  </th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  Array.from({ length: 3 }).map((_, idx) => (
                    <tr key={`sk-crit-row-${idx}`}>
                      <td><div className="skeleton-loader" style={{ width: '16px', height: '16px', borderRadius: '50%' }} /></td>
                      <td><div className="skeleton-loader skeleton-row-cell" style={{ width: '60px' }} /></td>
                      <td><div className="skeleton-loader skeleton-row-cell" style={{ width: '120px' }} /></td>
                      <td><div className="skeleton-loader skeleton-row-cell" style={{ width: '50px' }} /></td>
                      <td><div className="skeleton-loader skeleton-row-cell" style={{ width: '50px' }} /></td>
                      <td><div className="skeleton-loader skeleton-row-cell" style={{ width: '80px' }} /></td>
                      <td><div className="skeleton-loader skeleton-row-cell" style={{ width: '70px' }} /></td>
                    </tr>
                  ))
                ) : (
                  criticalStockItems.map((m) => {
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
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="details-card">
          <div className="details-card-header">
            <h3 className="details-card-title">{t('categoryDistribution')}</h3>
          </div>
          {renderDonutChart()}
        </div>
      </div>

      <div className="dashboard-details-grid" style={{ gridTemplateColumns: '1fr 1.5fr' }}>
        <div className="details-card" style={{ gridColumn: 'span 2' }}>
          <div className="details-card-header">
            <h3 className="details-card-title">{t('movTitle')}</h3>
            <button className="view-all-link" onClick={() => setActiveView('movements')}>
              <span>{t('viewAllCritical').split(' ')[0] + ' ' + t('navMovements').toLowerCase()}</span>
              <ChevronRight size={16} />
            </button>
          </div>

          <div className="movement-list" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            {loading ? (
              Array.from({ length: 4 }).map((_, idx) => (
                <div key={`sk-mov-grid-${idx}`} className="movement-item" style={{ border: '1px solid var(--border)', borderRadius: '8px', padding: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1, minWidth: 0 }}>
                    <div className="skeleton-loader" style={{ width: '36px', height: '36px', borderRadius: '50%', flexShrink: 0 }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div className="skeleton-loader skeleton-text" style={{ width: '120px', marginBottom: '6px' }} />
                      <div className="skeleton-loader skeleton-text" style={{ width: '70px', height: '12.5px' }} />
                    </div>
                  </div>
                  <div style={{ textAlign: 'right', flexShrink: 0, marginLeft: '12px' }}>
                    <div className="skeleton-loader skeleton-badge" style={{ width: '45px', height: '18px', marginBottom: '4px' }} />
                    <div className="skeleton-loader skeleton-text" style={{ width: '30px', height: '11px' }} />
                  </div>
                </div>
              ))
            ) : (
              transactions.slice(0, 4).map((tItem) => (
                <div key={tItem.id} className="movement-item" style={{ border: '1px solid var(--border)', borderRadius: '8px', padding: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', minWidth: 0 }}>
                  <div className="movement-left" style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0, flex: 1 }}>
                    <div className={`movement-icon-wrapper ${tItem.type}`} style={{ flexShrink: 0 }}>
                      {tItem.type === 'intake' ? <ArrowUpRight size={18} /> : <ArrowDownRight size={18} />}
                    </div>
                    <div className="movement-info" style={{ minWidth: 0, flex: 1 }}>
                      <h4 style={{ textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                        {tItem.material_name} <span className="material-id-badge" style={{ fontSize: '10px' }}>{tItem.material_id}</span>
                      </h4>
                      <p style={{ textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                        {tItem.user_name} •{' '}
                        {tItem.notes ? (
                          tItem.notes.length > 25 ? (
                            <span 
                              style={{ cursor: 'pointer', textDecoration: 'underline', color: 'var(--primary)', fontStyle: 'italic' }} 
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedNotes(tItem.notes || null);
                              }}
                              title={tItem.notes}
                            >
                              {tItem.notes.substring(0, 22)}...
                            </span>
                          ) : (
                            <span style={{ fontStyle: 'italic' }}>{tItem.notes}</span>
                          )
                        ) : '—'}
                      </p>
                    </div>
                  </div>
                  <div className="movement-right" style={{ flexShrink: 0, marginLeft: '12px' }}>
                    <span className={`movement-qty ${tItem.type}`}>
                      {tItem.quantity > 0 ? `+${tItem.quantity}` : tItem.quantity}
                    </span>
                    <div className="movement-time">
                      {getLocaleTimeString(tItem.timestamp)}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Modal for viewing long notes */}
      {selectedNotes && (
        <div className="modal-overlay" style={{ zIndex: 1000 }} onClick={() => setSelectedNotes(null)}>
          <div className="modal-card" style={{ maxWidth: '400px', width: '90%' }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title" style={{ fontSize: '16px', fontWeight: 700 }}>
                {t('movColNotes') || 'Megjegyzés'}
              </h3>
              <button 
                onClick={() => setSelectedNotes(null)} 
                style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '18px', color: 'var(--text-secondary)' }}
              >
                ✕
              </button>
            </div>
            <div className="modal-body" style={{ padding: '20px', textAlign: 'left', wordBreak: 'break-word', color: 'var(--text-primary)', fontSize: '14px', lineHeight: '1.6' }}>
              {selectedNotes}
            </div>
            <div className="modal-footer" style={{ padding: '12px 20px', display: 'flex', justifyContent: 'flex-end', borderTop: '1px solid var(--border)' }}>
              <button 
                type="button" 
                className="btn-primary" 
                style={{ padding: '8px 16px', fontSize: '13px', width: 'auto' }} 
                onClick={() => setSelectedNotes(null)}
              >
                {t('qrClose')}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
