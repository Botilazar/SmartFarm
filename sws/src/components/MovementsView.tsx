import React, { useState, useMemo } from 'react';
import { ArrowUpRight, ArrowDownRight, ChevronUp, ChevronDown, ArrowUpDown, Download } from 'lucide-react';
import type { Transaction } from '../db/dbService';
import { useTranslation } from '../context/LanguageContext';

interface MovementsViewProps {
  transactions: Transaction[];
  isMobile?: boolean;
}

export const MovementsView: React.FC<MovementsViewProps> = ({
  transactions,
  isMobile = false
}) => {
  const { t, language } = useTranslation();
  const [selectedNotes, setSelectedNotes] = useState<string | null>(null);
  const [sortField, setSortField] = useState<'timestamp' | 'material_id' | 'material_name' | 'type' | 'quantity' | 'user_name' | 'notes' | null>('timestamp');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

  const handleExportCSV = () => {
    const headers = [
      t('movColDate') || 'Dátum',
      t('statId') || 'Azonosító',
      t('statName') || 'Név',
      t('movColType') || 'Típus',
      t('movColQty') || 'Mennyiség',
      t('movColUser') || 'Felhasználó',
      t('movColNotes') || 'Megjegyzés'
    ];

    const rows = sortedTransactions.map(tx => [
      formatDateTime(tx.timestamp),
      tx.material_id,
      tx.material_name,
      tx.type === 'intake' ? t('movTypeIntake') : t('movTypeCheckout'),
      `${tx.quantity} ${tx.unit || ''}`,
      tx.user_name,
      tx.notes || ''
    ]);

    const csvContent = "\uFEFF" + [
      headers.join(';'),
      ...rows.map(row => row.map(val => `"${String(val).replace(/"/g, '""')}"`).join(';'))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `smartfarm_mozgasok_${new Date().toISOString().slice(0, 10)}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleSort = (field: 'timestamp' | 'material_id' | 'material_name' | 'type' | 'quantity' | 'user_name' | 'notes') => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection(field === 'timestamp' ? 'desc' : 'asc');
    }
  };

  const renderSortIcon = (field: 'timestamp' | 'material_id' | 'material_name' | 'type' | 'quantity' | 'user_name' | 'notes') => {
    if (sortField !== field) {
      return <ArrowUpDown size={12} style={{ opacity: 0.4, marginLeft: '6px' }} />;
    }
    return sortDirection === 'asc' ? (
      <ChevronUp size={12} style={{ color: 'var(--primary)', marginLeft: '6px' }} />
    ) : (
      <ChevronDown size={12} style={{ color: 'var(--primary)', marginLeft: '6px' }} />
    );
  };

  const sortedTransactions = useMemo(() => {
    if (!sortField) return transactions;
    return [...transactions].sort((a, b) => {
      let valA: any = '';
      let valB: any = '';

      switch (sortField) {
        case 'timestamp':
          valA = new Date(a.timestamp).getTime();
          valB = new Date(b.timestamp).getTime();
          break;
        case 'material_id':
          valA = a.material_id;
          valB = b.material_id;
          break;
        case 'material_name':
          valA = a.material_name;
          valB = b.material_name;
          break;
        case 'type':
          valA = a.type;
          valB = b.type;
          break;
        case 'quantity':
          valA = a.quantity;
          valB = b.quantity;
          break;
        case 'user_name':
          valA = a.user_name;
          valB = b.user_name;
          break;
        case 'notes':
          valA = a.notes || '';
          valB = b.notes || '';
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
  }, [transactions, sortField, sortDirection]);

  const formatDateTime = (timestamp: string) => {
    const date = new Date(timestamp);
    const locale = language === 'hu' ? 'hu-HU' : language === 'en' ? 'en-US' : 'de-DE';
    return date.toLocaleDateString(locale, { 
      year: 'numeric', 
      month: '2-digit', 
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getLocalizedType = (type: 'intake' | 'checkout') => {
    return type === 'intake' ? t('movTypeIntake') : t('movTypeCheckout');
  };

  if (isMobile) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 className="mobile-section-title" style={{ margin: 0 }}>{t('movTitle')}</h3>
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
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {sortedTransactions.map((tItem) => (
            <div key={tItem.id} className="mobile-stock-card" style={{ padding: '12px' }}>
              <div className="mobile-stock-card-left">
                <div className={`movement-icon-wrapper ${tItem.type}`} style={{ width: '28px', height: '28px' }}>
                  {tItem.type === 'intake' ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
                </div>
                <div className="mobile-stock-info" style={{ maxWidth: '170px' }}>
                  <h4 style={{ fontSize: '12px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{tItem.material_name}</h4>
                  <p style={{ fontSize: '10px' }}>
                    {tItem.user_name} •{' '}
                    {tItem.notes ? (
                      tItem.notes.length > 25 ? (
                        <span 
                          style={{ cursor: 'pointer', textDecoration: 'underline', color: 'var(--primary)' }} 
                          onClick={() => setSelectedNotes(tItem.notes || null)}
                        >
                          {tItem.notes.substring(0, 22)}...
                        </span>
                      ) : (
                        tItem.notes
                      )
                    ) : '—'}
                  </p>
                </div>
              </div>
              <div className="mobile-stock-card-right">
                <span className={`movement-qty ${tItem.type}`} style={{ fontSize: '12px' }}>
                  {tItem.quantity > 0 ? `+${tItem.quantity}` : tItem.quantity}
                </span>
                <span style={{ fontSize: '9px', color: 'var(--text-secondary)' }}>
                  {formatDateTime(tItem.timestamp)}
                </span>
              </div>
            </div>
          ))}
          {sortedTransactions.length === 0 && (
            <div style={{ textAlign: 'center', padding: '32px', color: 'var(--text-secondary)' }}>
              {t('movNoResults')}
            </div>
          )}
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
                  Bezárás
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // Desktop view
  return (
    <div className="details-card" style={{ width: '100%' }}>
      <div className="details-card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 className="details-card-title">{t('movTitle')}</h2>
          <p className="page-subtitle">{t('movSubtitle')}</p>
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
              <th className="sortable" onClick={() => handleSort('timestamp')}>
                <div style={{ display: 'flex', alignItems: 'center' }}>
                  {t('movColDate')}
                  {renderSortIcon('timestamp')}
                </div>
              </th>
              <th className="sortable" onClick={() => handleSort('material_id')}>
                <div style={{ display: 'flex', alignItems: 'center' }}>
                  {t('statId')}
                  {renderSortIcon('material_id')}
                </div>
              </th>
              <th className="sortable" onClick={() => handleSort('material_name')}>
                <div style={{ display: 'flex', alignItems: 'center' }}>
                  {t('statName')}
                  {renderSortIcon('material_name')}
                </div>
              </th>
              <th className="sortable" onClick={() => handleSort('type')}>
                <div style={{ display: 'flex', alignItems: 'center' }}>
                  {t('movColType')}
                  {renderSortIcon('type')}
                </div>
              </th>
              <th className="sortable" onClick={() => handleSort('quantity')}>
                <div style={{ display: 'flex', alignItems: 'center' }}>
                  {t('movColQty')}
                  {renderSortIcon('quantity')}
                </div>
              </th>
              <th className="sortable" onClick={() => handleSort('user_name')}>
                <div style={{ display: 'flex', alignItems: 'center' }}>
                  {t('movColUser')}
                  {renderSortIcon('user_name')}
                </div>
              </th>
              <th className="sortable" onClick={() => handleSort('notes')}>
                <div style={{ display: 'flex', alignItems: 'center' }}>
                  {t('movColNotes')}
                  {renderSortIcon('notes')}
                </div>
              </th>
            </tr>
          </thead>
          <tbody>
            {sortedTransactions.map((tItem) => {
              const hasLongNotes = tItem.notes && tItem.notes.length > 25;

              return (
                <tr key={tItem.id}>
                  <td style={{ color: 'var(--text-secondary)' }}>{formatDateTime(tItem.timestamp)}</td>
                  <td><span className="material-id-badge">{tItem.material_id}</span></td>
                  <td style={{ fontWeight: 600 }}>{tItem.material_name}</td>
                  <td>
                    <span 
                      style={{
                        padding: '4px 8px',
                        borderRadius: '4px',
                        fontSize: '11px',
                        fontWeight: 600,
                        backgroundColor: tItem.type === 'intake' ? 'var(--primary-light)' : 'var(--danger-bg)',
                        color: tItem.type === 'intake' ? 'var(--primary)' : 'var(--danger)'
                      }}
                    >
                      {getLocalizedType(tItem.type)}
                    </span>
                  </td>
                  <td style={{ fontWeight: 700, color: tItem.type === 'intake' ? 'var(--success)' : 'var(--danger)' }}>
                    {tItem.quantity > 0 ? `+${tItem.quantity}` : tItem.quantity}
                  </td>
                  <td>{tItem.user_name}</td>
                  
                  {hasLongNotes ? (
                    <td 
                      style={{ 
                        color: 'var(--text-secondary)', 
                        fontStyle: 'italic',
                        maxWidth: '180px',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        cursor: 'pointer',
                        textDecoration: 'underline'
                      }}
                      onClick={() => setSelectedNotes(tItem.notes || null)}
                      title="Kattints a részletekért"
                    >
                      {tItem.notes}
                    </td>
                  ) : (
                    <td 
                      style={{ 
                        color: 'var(--text-secondary)', 
                        fontStyle: 'italic',
                        maxWidth: '180px',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis'
                      }}
                    >
                      {tItem.notes || '—'}
                    </td>
                  )}
                </tr>
              );
            })}
            {sortedTransactions.length === 0 && (
              <tr>
                <td colSpan={7} style={{ textAlign: 'center', padding: '32px', color: 'var(--text-secondary)' }}>
                  {t('movNoResults')}
                </td>
              </tr>
            )}
          </tbody>
        </table>
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
                Bezárás
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
