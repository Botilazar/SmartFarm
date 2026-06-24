import React from 'react';
import { 
  Sprout, Package, ArrowLeftRight, ShieldAlert, ArrowUpRight, ArrowDownRight, ChevronRight,
  Plus, QrCode, ClipboardList
} from 'lucide-react';
import { getStockStatus } from '../db/dbService';
import type { Material, Transaction } from '../db/dbService';

interface DashboardOverviewProps {
  materials: Material[];
  transactions: Transaction[];
  setActiveView: (view: 'dashboard' | 'materials' | 'movements' | 'qr-codes' | 'users' | 'settings') => void;
  isMobile?: boolean;
  setShowScanner?: (s: boolean) => void;
  setShowNewMaterialModal?: (m: boolean) => void;
  setMobileTab?: (t: 'home' | 'search' | 'qr' | 'movements' | 'profile') => void;
  onMobileStockCardClick?: (materialId: string) => void;
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
  onMobileStockCardClick
}) => {
  const totalMaterialsCount = materials.length;

  const greenCount = materials.filter(m => getStockStatus(m.quantity, m.max_quantity) === 'green').length;
  const yellowCount = materials.filter(m => getStockStatus(m.quantity, m.max_quantity) === 'yellow').length;
  const redCount = materials.filter(m => getStockStatus(m.quantity, m.max_quantity) === 'red').length;

  const lowStockCount = yellowCount + redCount;

  const transactionsToday = transactions.filter(t => {
    const today = new Date().toDateString();
    return new Date(t.timestamp).toDateString() === today;
  }).length;

  const categoryCounts = materials.reduce((acc, curr) => {
    acc[curr.category] = (acc[curr.category] || 0) + 1;
    return acc;
  }, {} as { [key: string]: number });

  const criticalStockItems = [...materials]
    .sort((a, b) => (a.quantity / a.max_quantity) - (b.quantity / b.max_quantity))
    .slice(0, 5);

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

  if (isMobile) {
    return (
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
          <button className="mobile-action-btn" onClick={() => setShowScanner && setShowScanner(true)}>
            <QrCode size={20} className="mobile-action-btn-icon" />
            <span className="mobile-action-btn-text">QR beolvasás</span>
          </button>

          <button className="mobile-action-btn" onClick={() => setShowNewMaterialModal && setShowNewMaterialModal(true)}>
            <Plus size={20} className="mobile-action-btn-icon" />
            <span className="mobile-action-btn-text">Új anyag</span>
          </button>

          <button className="mobile-action-btn" onClick={() => setMobileTab && setMobileTab('movements')}>
            <ArrowLeftRight size={20} className="mobile-action-btn-icon" />
            <span className="mobile-action-btn-text">Mozgások</span>
          </button>

          <button className="mobile-action-btn" onClick={() => setMobileTab && setMobileTab('search')}>
            <ClipboardList size={20} className="mobile-action-btn-icon" />
            <span className="mobile-action-btn-text">Készletlista</span>
          </button>
        </div>

        {/* Critical Stocks List */}
        <div className="mobile-section-header">
          <span className="mobile-section-title">Kritikus készlet</span>
          <button className="mobile-section-link" onClick={() => setMobileTab && setMobileTab('search')}>
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
                onClick={() => onMobileStockCardClick && onMobileStockCardClick(m.id)}
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
          <button className="mobile-section-link" onClick={() => setMobileTab && setMobileTab('movements')}>
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
    );
  }

  return (
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

      <div className="dashboard-details-grid">
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

        <div className="details-card">
          <div className="details-card-header">
            <h3 className="details-card-title">Kategória szerinti megoszlás</h3>
          </div>
          {renderDonutChart()}
        </div>
      </div>

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
  );
};
