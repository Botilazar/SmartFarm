import React from 'react';
import { Package, MapPin, QrCode, Trash2, Pencil } from 'lucide-react';
import { getStockStatus } from '../db/dbService';
import type { Material } from '../db/dbService';

interface MaterialsViewProps {
  materials: Material[];
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  selectedCategory: string;
  setSelectedCategory: (c: string) => void;
  user: { role: 'admin' | 'operator' };
  onAddTransactionClick: (m: Material) => void;
  onPrintQrClick: (m: Material) => void;
  onDeleteClick: (m: Material) => void;
  onEditClick: (m: Material) => void;
  isMobile?: boolean;
  onMobileScanClick?: (materialId: string) => void;
}

export const MaterialsView: React.FC<MaterialsViewProps> = ({
  materials,
  searchQuery,
  setSearchQuery,
  selectedCategory,
  setSelectedCategory,
  user,
  onAddTransactionClick,
  onPrintQrClick,
  onDeleteClick,
  onEditClick,
  isMobile = false,
  onMobileScanClick
}) => {
  const filteredMaterials = materials.filter(m => {
    const matchesSearch = m.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          m.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          m.location.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = selectedCategory === 'All' || m.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  if (isMobile) {
    return (
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
                style={{ padding: '12px', position: 'relative' }}
                onClick={() => onMobileScanClick && onMobileScanClick(m.id)}
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
                <div className="mobile-stock-card-right" style={{ marginRight: user.role === 'admin' ? '56px' : '0px' }}>
                  <span className={`mobile-stock-qty ${status}`} style={{ fontSize: '13px' }}>{m.quantity} {m.unit}</span>
                  <span className="pct-badge" style={{ fontSize: '10px', margin: 0 }}>{pct}% szint</span>
                </div>
                {user.role === 'admin' && (
                  <div 
                    style={{
                      position: 'absolute',
                      right: '12px',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      display: 'flex',
                      gap: '8px',
                    }}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <button
                      type="button"
                      style={{
                        color: 'var(--primary)',
                        background: 'transparent',
                        border: 'none',
                        padding: '4px'
                      }}
                      title="Szerkesztés"
                      onClick={() => onEditClick(m)}
                    >
                      <Pencil size={16} />
                    </button>
                    <button
                      type="button"
                      style={{
                        color: 'var(--danger)',
                        background: 'transparent',
                        border: 'none',
                        padding: '4px'
                      }}
                      title="Törlés"
                      onClick={() => onDeleteClick(m)}
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // Desktop view
  return (
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
              <th style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>Műveletek</th>
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
                  <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                    <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end', alignItems: 'center', flexWrap: 'nowrap' }}>
                      <button
                        type="button"
                        className="btn-secondary"
                        style={{ padding: '6px 10px', fontSize: '11px', width: 'auto' }}
                        onClick={() => onAddTransactionClick(m)}
                      >
                        Kiadás / Bevétel
                      </button>
                      <button
                        type="button"
                        className="btn-secondary"
                        style={{ padding: '6px', color: 'var(--text-secondary)', width: 'auto' }}
                        title="QR-kód megtekintése"
                        onClick={() => onPrintQrClick(m)}
                      >
                        <QrCode size={16} />
                      </button>
                      {user.role === 'admin' && (
                        <>
                          <button
                            type="button"
                            className="btn-secondary"
                            style={{ padding: '6px', color: 'var(--primary)', width: 'auto' }}
                            title="Anyag szerkesztése"
                            onClick={() => onEditClick(m)}
                          >
                            <Pencil size={16} />
                          </button>
                          <button
                            type="button"
                            className="btn-secondary"
                            style={{ padding: '6px', color: 'var(--danger)', width: 'auto' }}
                            title="Anyag törlése"
                            onClick={() => onDeleteClick(m)}
                          >
                            <Trash2 size={16} />
                          </button>
                        </>
                      )}
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
};
