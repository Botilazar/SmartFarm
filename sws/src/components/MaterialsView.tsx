import React, { useState, useMemo } from 'react';
import { Package, MapPin, QrCode, Trash2, Pencil, Archive, ArchiveRestore, ChevronUp, ChevronDown, ArrowUpDown, Calendar, Download } from 'lucide-react';
import { getStockStatus } from '../db/dbService';
import type { Material } from '../db/dbService';
import { useTranslation } from '../context/LanguageContext';

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
  onDeactivateClick: (m: Material) => void;
  onRestoreClick: (m: Material) => void;
  isMobile?: boolean;
  onMobileScanClick?: (materialId: string) => void;
}

export const MaterialsView: React.FC<MaterialsViewProps> = ({
  materials,
  searchQuery,
  selectedCategory,
  setSelectedCategory,
  user,
  onAddTransactionClick,
  onPrintQrClick,
  onDeleteClick,
  onEditClick,
  onDeactivateClick,
  onRestoreClick,
  isMobile = false,
  onMobileScanClick
}) => {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<'active' | 'inactive'>('active');
  const [selectedGepFilter, setSelectedGepFilter] = useState<'All' | 'Igen' | 'Nem'>('All');
  const [sortField, setSortField] = useState<'name' | 'category' | 'location' | 'stock' | 'unit' | 'expiration' | null>('name');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

  const handleExportCSV = () => {
    const headers = [
      t('statId') || 'Azonosító',
      t('statName') || 'Név',
      t('colCategory') || 'Kategória',
      t('statLocation') || 'Hely',
      t('statStock') || 'Készlet',
      t('statMax') || 'Max',
      t('colUnit') || 'Mértékegység',
      t('matExpiration') || 'Lejárati idő'
    ];

    const rows = sortedMaterials.map(m => [
      m.id,
      m.name,
      t(`cat_${m.category}`) || m.category,
      m.location,
      m.quantity,
      m.max_quantity,
      m.unit,
      m.expiration_date || ''
    ]);

    const csvContent = "\uFEFF" + [
      headers.join(';'),
      ...rows.map(row => row.map(val => `"${String(val).replace(/"/g, '""')}"`).join(';'))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `smartfarm_keszlet_${new Date().toISOString().slice(0, 10)}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const getExpirationInfo = (expDate: string | undefined): {
    color: string;
    isExpired: boolean;
    category: 'more-than-year' | 'half-to-year' | 'week-to-half' | 'under-week' | 'none';
  } => {
    if (!expDate) return { color: 'var(--text-light)', isExpired: false, category: 'none' };
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const expiration = new Date(expDate);
    expiration.setHours(0, 0, 0, 0);

    const diffMs = expiration.getTime() - today.getTime();
    const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays < 0) {
      // Már lejárt -> piros
      return { color: '#ef4444', isExpired: true, category: 'under-week' };
    } else if (diffDays < 7) {
      // Azalatt (1 hét alatt) -> piros
      return { color: '#ef4444', isExpired: false, category: 'under-week' };
    } else if (diffDays <= 182) {
      // Félév és 1 hét között -> narancs
      return { color: '#f97316', isExpired: false, category: 'week-to-half' };
    } else if (diffDays <= 365) {
      // 1 év és félév között -> citrom (sárga)
      return { color: '#eab308', isExpired: false, category: 'half-to-year' };
    } else {
      // 1 évnél több -> szürke
      return { color: '#94a3b8', isExpired: false, category: 'more-than-year' };
    }
  };

  const handleSort = (field: 'name' | 'category' | 'location' | 'stock' | 'unit' | 'expiration') => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const renderSortIcon = (field: 'name' | 'category' | 'location' | 'stock' | 'unit' | 'expiration') => {
    if (sortField !== field) {
      return <ArrowUpDown size={12} style={{ opacity: 0.4, marginLeft: '6px' }} />;
    }
    return sortDirection === 'asc' ? (
      <ChevronUp size={12} style={{ color: 'var(--primary)', marginLeft: '6px' }} />
    ) : (
      <ChevronDown size={12} style={{ color: 'var(--primary)', marginLeft: '6px' }} />
    );
  };

  const filteredMaterials = useMemo(() => {
    return materials.filter(m => {
      const matchesSearch = m.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        m.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
        m.location.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesCategory = selectedCategory === 'All' || m.category === selectedCategory;
      const matchesGep = selectedGepFilter === 'All'
        ? true
        : selectedGepFilter === 'Igen'
          ? !!m.is_gep
          : !m.is_gep;

      const isArchived = !!m.is_inactive;
      const matchesTab = user.role === 'admin'
        ? (activeTab === 'inactive' ? isArchived : !isArchived)
        : !isArchived;

      return matchesSearch && matchesCategory && matchesGep && matchesTab;
    });
  }, [materials, searchQuery, selectedCategory, selectedGepFilter, activeTab, user.role]);

  // eslint-disable-next-line react-hooks/preserve-manual-memoization
  const sortedMaterials = useMemo(() => {
    if (!sortField) return filteredMaterials;
    return [...filteredMaterials].sort((a, b) => {
      let valA: string | number;
      let valB: string | number;

      switch (sortField) {
        case 'name':
          valA = a.name || '';
          valB = b.name || '';
          break;
        case 'category':
          valA = t(`cat_${a.category}`) || '';
          valB = t(`cat_${b.category}`) || '';
          break;
        case 'location':
          valA = a.location || '';
          valB = b.location || '';
          break;
        case 'stock':
          valA = a.quantity / a.max_quantity;
          valB = b.quantity / b.max_quantity;
          break;
        case 'unit':
          valA = a.unit || '';
          valB = b.unit || '';
          break;
        case 'expiration':
          valA = a.expiration_date || '9999-99-99';
          valB = b.expiration_date || '9999-99-99';
          break;
        default:
          return 0;
      }

      if (typeof valA === 'number' && typeof valB === 'number') {
        return sortDirection === 'asc' ? valA - valB : valB - valA;
      }

      const strA = String(valA).toLowerCase();
      const strB = String(valB).toLowerCase();
      if (strA < strB) return sortDirection === 'asc' ? -1 : 1;
      if (strA > strB) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });
  }, [filteredMaterials, sortField, sortDirection, t]);

  if (isMobile) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 className="mobile-section-title">{t('matTitle')}</h3>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <select
              className="form-select"
              style={{ width: '85px', padding: '6px', fontSize: '12px' }}
              value={selectedGepFilter}
              onChange={(e) => setSelectedGepFilter(e.target.value as 'All' | 'Igen' | 'Nem')}
            >
              <option value="All">GEP: Mind</option>
              <option value="Igen">GEP: Igen</option>
              <option value="Nem">GEP: Nem</option>
            </select>
            <select
              className="form-select"
              style={{ width: '100px', padding: '6px', fontSize: '12px' }}
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
            >
              <option value="All">{t('matAll')}</option>
              <option value="Permetszerek">{t('cat_Permetszerek')}</option>
              <option value="Műtrágyák">{t('cat_Műtrágyák')}</option>
              <option value="Vetőmagok">{t('cat_Vetőmagok')}</option>
              <option value="Tápok">{t('cat_Tápok')}</option>
              <option value="Adalékanyagok">{t('cat_Adalékanyagok')}</option>
              <option value="Egyéb">{t('cat_Egyéb')}</option>
            </select>
            <button
              type="button"
              className="btn-secondary"
              style={{ padding: '6px 8px', width: 'auto', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              onClick={handleExportCSV}
              title={t('btnExportCSV')}
            >
              <Download size={15} />
            </button>
          </div>
        </div>

        {user.role === 'admin' && (
          <div style={{ display: 'flex', gap: '12px', borderBottom: '1px solid var(--border)', paddingBottom: '4px' }}>
            <button
              type="button"
              style={{
                padding: '6px 12px',
                fontSize: '13px',
                fontWeight: 600,
                color: activeTab === 'active' ? 'var(--primary)' : 'var(--text-secondary)',
                border: 'none',
                borderBottom: activeTab === 'active' ? '2.5px solid var(--primary)' : '2.5px solid transparent',
                backgroundColor: 'transparent',
                cursor: 'pointer',
              }}
              onClick={() => setActiveTab('active')}
            >
              {t('matActiveTab') || 'Aktív készlet'}
            </button>
            <button
              type="button"
              style={{
                padding: '6px 12px',
                fontSize: '13px',
                fontWeight: 600,
                color: activeTab === 'inactive' ? 'var(--primary)' : 'var(--text-secondary)',
                border: 'none',
                borderBottom: activeTab === 'inactive' ? '2.5px solid var(--primary)' : '2.5px solid transparent',
                backgroundColor: 'transparent',
                cursor: 'pointer',
              }}
              onClick={() => setActiveTab('inactive')}
            >
              {t('matInactiveTab') || 'Inaktív'}
            </button>
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {sortedMaterials.map((m) => {
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
                    <p style={{ fontSize: '10px' }}>{t('statId')}: {m.id} • {t('statLocation')}: {m.location}</p>
                    {m.expiration_date && (() => {
                      const info = getExpirationInfo(m.expiration_date);
                      return (
                        <p style={{
                          fontSize: '9px',
                          color: info.color,
                          fontWeight: info.category === 'under-week' ? 700 : (info.category === 'week-to-half' ? 600 : 500),
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px',
                          marginTop: '2px'
                        }}>
                          <Calendar size={10} />
                          <span>{t('matExpiration')}: {m.expiration_date} {info.isExpired ? `(${t('matExpired')})` : ''}</span>
                        </p>
                      );
                    })()}
                  </div>
                </div>
                <div
                  className="mobile-stock-card-right"
                  style={{
                    marginRight: user.role === 'admin'
                      ? (activeTab === 'inactive' ? '64px' : '88px')
                      : '0px'
                  }}
                >
                  <span className={`mobile-stock-qty ${status}`} style={{ fontSize: '13px' }}>{m.quantity} {m.unit}</span>
                  <span className="pct-badge" style={{ fontSize: '10px', margin: 0 }}>{pct}%</span>
                </div>
                {user.role === 'admin' && (
                  <div
                    style={{
                      position: 'absolute',
                      right: '12px',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      display: 'flex',
                      gap: '6px'
                    }}
                    onClick={(e) => e.stopPropagation()}
                  >
                    {activeTab === 'inactive' ? (
                      <>
                        <button
                          type="button"
                          style={{ background: 'none', border: 'none', color: 'var(--primary)', padding: '4px' }}
                          title={t('matRestore') || 'Visszaállítás'}
                          onClick={() => onRestoreClick(m)}
                        >
                          <ArchiveRestore size={16} />
                        </button>
                        <button
                          type="button"
                          style={{ background: 'none', border: 'none', color: 'var(--danger)', padding: '4px' }}
                          title={t('matDelete')}
                          onClick={() => onDeleteClick(m)}
                        >
                          <Trash2 size={16} />
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          type="button"
                          style={{ background: 'none', border: 'none', color: 'var(--primary)', padding: '4px' }}
                          title={t('matEdit')}
                          onClick={() => onEditClick(m)}
                        >
                          <Pencil size={16} />
                        </button>
                        <button
                          type="button"
                          style={{ background: 'none', border: 'none', color: 'var(--warning)', padding: '4px' }}
                          title={t('matDeactivate') || 'Inaktiválás'}
                          onClick={() => onDeactivateClick(m)}
                        >
                          <Archive size={16} />
                        </button>
                        <button
                          type="button"
                          style={{ background: 'none', border: 'none', color: 'var(--danger)', padding: '4px' }}
                          title={t('matDelete')}
                          onClick={() => onDeleteClick(m)}
                        >
                          <Trash2 size={16} />
                        </button>
                      </>
                    )}
                  </div>
                )}
              </div>
            );
          })}
          {sortedMaterials.length === 0 && (
            <div style={{ textAlign: 'center', padding: '32px', color: 'var(--text-secondary)' }}>
              {t('matNoResults')}
            </div>
          )}
        </div>
      </div>
    );
  }

  // Desktop View
  return (
    <div className="details-card" style={{ width: '100%' }}>
      {/* Title block */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
        <div>
          <h2 className="details-card-title" style={{ margin: 0 }}>{t('matTitle')}</h2>
          <p className="page-subtitle" style={{ margin: 0 }}>{t('matSubtitle')}</p>
        </div>
      </div>

      {user.role === 'admin' && (
        <div style={{ display: 'flex', gap: '16px', borderBottom: '1px solid var(--border)', marginBottom: '16px' }}>
          <button
            type="button"
            style={{
              padding: '10px 16px',
              fontSize: '14px',
              fontWeight: 600,
              color: activeTab === 'active' ? 'var(--primary)' : 'var(--text-secondary)',
              border: 'none',
              borderBottom: activeTab === 'active' ? '3px solid var(--primary)' : '3px solid transparent',
              backgroundColor: 'transparent',
              cursor: 'pointer',
              transition: 'all 0.2s',
              marginBottom: '-1px'
            }}
            onClick={() => setActiveTab('active')}
          >
            {t('matActiveTab') || 'Aktív készlet'}
          </button>
          <button
            type="button"
            style={{
              padding: '10px 16px',
              fontSize: '14px',
              fontWeight: 600,
              color: activeTab === 'inactive' ? 'var(--primary)' : 'var(--text-secondary)',
              border: 'none',
              borderBottom: activeTab === 'inactive' ? '3px solid var(--primary)' : '3px solid transparent',
              backgroundColor: 'transparent',
              cursor: 'pointer',
              transition: 'all 0.2s',
              marginBottom: '-1px'
            }}
            onClick={() => setActiveTab('inactive')}
          >
            {t('matInactiveTab') || 'Inaktív archívum'}
          </button>
        </div>
      )}

      {/* Filters & Export Row */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px', marginBottom: '20px', width: '100%' }}>
        <div style={{ display: 'flex', gap: '20px', alignItems: 'center' }}>
          {/* GEP Filter */}
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
            <span style={{ fontSize: '13px', color: 'var(--text-secondary)', fontWeight: 500 }}>GEP</span>
            <div style={{ display: 'flex', gap: '6px', backgroundColor: 'var(--bg-app)', padding: '4px', borderRadius: '8px', border: '1px solid var(--border)' }}>
              {(['All', 'Igen', 'Nem'] as const).map((opt) => (
                <button
                  key={opt}
                  type="button"
                  style={{
                    padding: '6px 12px',
                    borderRadius: '6px',
                    fontSize: '12px',
                    fontWeight: selectedGepFilter === opt ? 600 : 500,
                    border: 'none',
                    backgroundColor: selectedGepFilter === opt ? 'var(--primary)' : 'transparent',
                    color: selectedGepFilter === opt ? 'white' : 'var(--text-secondary)',
                    cursor: 'pointer',
                    transition: 'all 0.2s'
                  }}
                  onClick={() => setSelectedGepFilter(opt)}
                >
                  {opt === 'All' ? 'Mind' : opt}
                </button>
              ))}
            </div>
          </div>

          {/* Categories Filter */}
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
            <span style={{ fontSize: '13px', color: 'var(--text-secondary)', fontWeight: 500 }}>{t('matCategories')}</span>
            <div style={{ display: 'flex', gap: '6px', backgroundColor: 'var(--bg-app)', padding: '4px', borderRadius: '8px', border: '1px solid var(--border)' }}>
              {['All', 'Permetszerek', 'Műtrágyák', 'Vetőmagok', 'Tápok', 'Adalékanyagok', 'Egyéb'].map((cat) => (
                <button
                  key={cat}
                  type="button"
                  style={{
                    padding: '6px 12px',
                    borderRadius: '6px',
                    fontSize: '12px',
                    fontWeight: selectedCategory === cat ? 600 : 500,
                    border: 'none',
                    backgroundColor: selectedCategory === cat ? 'var(--primary)' : 'transparent',
                    color: selectedCategory === cat ? 'white' : 'var(--text-secondary)',
                    cursor: 'pointer',
                    transition: 'all 0.2s'
                  }}
                  onClick={() => setSelectedCategory(cat)}
                >
                  {cat === 'All' ? t('matAll') : t(`cat_${cat}`)}
                </button>
              ))}
            </div>
          </div>
        </div>

        <button
          type="button"
          className="btn-secondary"
          style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 14px', width: 'auto', height: '34px', fontSize: '12px' }}
          onClick={handleExportCSV}
        >
          <Download size={14} />
          <span>{t('btnExportCSV')}</span>
        </button>
      </div>

      <div className="data-table-container">
        <table className="data-table">
          <thead>
            <tr>
              <th className="sortable" onClick={() => handleSort('name')}>
                <div style={{ display: 'flex', alignItems: 'center' }}>
                  {t('statName')}
                  {renderSortIcon('name')}
                </div>
              </th>
              <th className="sortable" onClick={() => handleSort('category')}>
                <div style={{ display: 'flex', alignItems: 'center' }}>
                  {t('colCategory')}
                  {renderSortIcon('category')}
                </div>
              </th>
              <th className="sortable" onClick={() => handleSort('location')}>
                <div style={{ display: 'flex', alignItems: 'center' }}>
                  {t('statLocation')}
                  {renderSortIcon('location')}
                </div>
              </th>
              <th className="sortable" onClick={() => handleSort('stock')}>
                <div style={{ display: 'flex', alignItems: 'center' }}>
                  {t('statStock')} / {t('statLevel')}
                  {renderSortIcon('stock')}
                </div>
              </th>
              <th className="sortable" onClick={() => handleSort('expiration')}>
                <div style={{ display: 'flex', alignItems: 'center' }}>
                  {t('matExpiration')}
                  {renderSortIcon('expiration')}
                </div>
              </th>
              <th className="sortable" onClick={() => handleSort('unit')}>
                <div style={{ display: 'flex', alignItems: 'center' }}>
                  {t('colUnit')}
                  {renderSortIcon('unit')}
                </div>
              </th>
              <th style={{ textAlign: 'right' }}>{t('matActions')}</th>
            </tr>
          </thead>
          <tbody>
            {sortedMaterials.map((m) => {
              const status = getStockStatus(m.quantity, m.max_quantity);
              const pct = Math.round((m.quantity / m.max_quantity) * 100);

              return (
                <tr
                  key={m.id}
                  style={{ cursor: 'pointer' }}
                  onClick={() => onAddTransactionClick(m)}
                  title={`${t('matIntake')} / ${t('matCheckout')}`}
                >
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
                  <td>{t(`cat_${m.category}`)}</td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--text-secondary)' }}>
                      <MapPin size={14} />
                      <span>{m.location}</span>
                    </div>
                  </td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span className={`qty-val ${status}`}>{m.quantity}</span>
                      <div className="progress-bar-container" style={{ cursor: 'pointer' }}>
                        <div
                          className={`progress-bar-fill ${status}`}
                          style={{ width: `${Math.min(100, pct)}%` }}
                        />
                      </div>
                      <span className="pct-badge">{pct}%</span>
                    </div>
                  </td>
                  <td>
                    {m.expiration_date ? (() => {
                      const info = getExpirationInfo(m.expiration_date);
                      return (
                        <span
                          style={{
                            color: info.color,
                            fontWeight: info.category === 'under-week' ? 700 : (info.category === 'week-to-half' ? 600 : 500)
                          }}
                        >
                          {m.expiration_date} {info.isExpired ? `(${t('matExpired')})` : ''}
                        </span>
                      );
                    })() : (
                      <span style={{ color: 'var(--text-light)', fontStyle: 'italic' }}>
                        {t('matNoExpiration')}
                      </span>
                    )}
                  </td>
                  <td>{m.unit}</td>
                  <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }} onClick={(e) => e.stopPropagation()}>
                    <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end', alignItems: 'center', flexWrap: 'nowrap' }}>
                      {activeTab === 'inactive' ? (
                        user.role === 'admin' && (
                          <>
                            <button
                              type="button"
                              className="btn-secondary"
                              style={{ padding: '6px', color: 'var(--primary)', width: 'auto' }}
                              title={t('matRestore') || 'Visszaállítás'}
                              onClick={() => onRestoreClick(m)}
                            >
                              <ArchiveRestore size={16} />
                            </button>
                            <button
                              type="button"
                              className="btn-secondary"
                              style={{ padding: '6px', color: 'var(--danger)', width: 'auto' }}
                              title={t('matDelete')}
                              onClick={() => onDeleteClick(m)}
                            >
                              <Trash2 size={16} />
                            </button>
                          </>
                        )
                      ) : (
                        <>
                          <button
                            type="button"
                            className="btn-secondary"
                            style={{ padding: '6px 10px', fontSize: '11px', width: 'auto' }}
                            onClick={() => onAddTransactionClick(m)}
                          >
                            {t('matIntake')} / {t('matCheckout')}
                          </button>
                          <button
                            type="button"
                            className="btn-secondary"
                            style={{ padding: '6px', color: 'var(--primary)', width: 'auto' }}
                            title={t('matPrint')}
                            onClick={() => onPrintQrClick(m)}
                          >
                            <QrCode size={16} style={{ color: 'var(--primary)' }} />
                          </button>
                          {user.role === 'admin' && (
                            <>
                              <button
                                type="button"
                                className="btn-secondary"
                                style={{ padding: '6px', color: 'var(--primary)', width: 'auto' }}
                                title={t('matEdit')}
                                onClick={() => onEditClick(m)}
                              >
                                <Pencil size={16} />
                              </button>
                              <button
                                type="button"
                                className="btn-secondary"
                                style={{ padding: '6px', color: 'var(--warning)', width: 'auto' }}
                                title={t('matDeactivate') || 'Inaktiválás'}
                                onClick={() => onDeactivateClick(m)}
                              >
                                <Archive size={16} />
                              </button>
                              <button
                                type="button"
                                className="btn-secondary"
                                style={{ padding: '6px', color: 'var(--danger)', width: 'auto' }}
                                title={t('matDelete')}
                                onClick={() => onDeleteClick(m)}
                              >
                                <Trash2 size={16} />
                              </button>
                            </>
                          )}
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
            {sortedMaterials.length === 0 && (
              <tr>
                <td colSpan={8} style={{ textAlign: 'center', padding: '32px', color: 'var(--text-secondary)' }}>
                  {t('matNoResults')}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
