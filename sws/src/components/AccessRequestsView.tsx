import React, { useState, useMemo, useEffect } from 'react';
import {
  Search, ShieldCheck, CheckCircle2, XCircle, Trash2, Plus, Download, Clock, Mail, User, AlertCircle
} from 'lucide-react';
import { dbService } from '../db/dbService';
import type { AccessRequest } from '../db/dbService';
import { useTranslation } from '../context/LanguageContext';

interface AccessRequestsViewProps {
  onRequestsUpdated?: () => void;
}

export const AccessRequestsView: React.FC<AccessRequestsViewProps> = ({ onRequestsUpdated }) => {
  const { t, language } = useTranslation();
  const [requests, setRequests] = useState<AccessRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'all' | 'pending' | 'approved' | 'rejected'>('all');
  
  // Modal for direct manual approval by admin
  const [showAddModal, setShowAddModal] = useState(false);
  const [addEmail, setAddEmail] = useState('');
  const [addName, setAddName] = useState('');
  const [addError, setAddError] = useState<string | null>(null);
  const [addLoading, setAddLoading] = useState(false);

  // Load requests
  const loadRequests = async () => {
    setLoading(true);
    try {
      const data = await dbService.getAccessRequests();
      setRequests(data);
    } catch (err) {
      console.error('Failed to load access requests:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRequests();
  }, []);

  const handleApprove = async (req: AccessRequest) => {
    try {
      await dbService.updateAccessRequestStatus(req.id, 'approved');
      await loadRequests();
      if (onRequestsUpdated) onRequestsUpdated();
    } catch (err) {
      console.error('Failed to approve request:', err);
    }
  };

  const handleReject = async (req: AccessRequest) => {
    try {
      await dbService.updateAccessRequestStatus(req.id, 'rejected');
      await loadRequests();
      if (onRequestsUpdated) onRequestsUpdated();
    } catch (err) {
      console.error('Failed to reject request:', err);
    }
  };

  const handleDelete = async (req: AccessRequest) => {
    if (window.confirm(`Biztosan törölni szeretnéd a(z) ${req.email} engedélykérését?`)) {
      try {
        await dbService.deleteAccessRequest(req.id);
        await loadRequests();
        if (onRequestsUpdated) onRequestsUpdated();
      } catch (err) {
        console.error('Failed to delete request:', err);
      }
    }
  };

  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAddError(null);

    if (!addEmail.trim()) {
      setAddError('Kérjük, add meg az e-mail címet!');
      return;
    }

    setAddLoading(true);
    try {
      await dbService.addApprovedEmailDirectly(addEmail.trim(), addName.trim() || undefined);
      setAddEmail('');
      setAddName('');
      setShowAddModal(false);
      await loadRequests();
      if (onRequestsUpdated) onRequestsUpdated();
    } catch (err: any) {
      setAddError(err.message || 'Hiba történt az e-mail engedélyezése során.');
    } finally {
      setAddLoading(false);
    }
  };

  const filteredRequests = useMemo(() => {
    return requests.filter(r => {
      const matchesSearch =
        (r.name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        r.email.toLowerCase().includes(searchQuery.toLowerCase());
      
      if (!matchesSearch) return false;

      if (activeTab === 'pending') return r.status === 'pending';
      if (activeTab === 'approved') return r.status === 'approved';
      if (activeTab === 'rejected') return r.status === 'rejected';
      return true;
    });
  }, [requests, searchQuery, activeTab]);

  const counts = useMemo(() => {
    return {
      all: requests.length,
      pending: requests.filter(r => r.status === 'pending').length,
      approved: requests.filter(r => r.status === 'approved').length,
      rejected: requests.filter(r => r.status === 'rejected').length,
    };
  }, [requests]);

  const handleExportCSV = () => {
    const headers = ['Email', 'Név', 'Státusz', 'Kérelem dátuma'];
    const rows = filteredRequests.map(r => [
      r.email,
      r.name || '',
      r.status === 'approved' ? 'Elfogadva' : r.status === 'rejected' ? 'Elutasítva' : 'Függőben',
      new Date(r.requested_at).toLocaleString('hu-HU')
    ]);

    const csvContent = "\uFEFF" + [
      headers.join(';'),
      ...rows.map(row => row.map(val => `"${String(val).replace(/"/g, '""')}"`).join(';'))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `smartfarm_engedelykeresek_${new Date().toISOString().slice(0, 10)}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const formatDate = (isoStr: string) => {
    const d = new Date(isoStr);
    return d.toLocaleString(language === 'hu' ? 'hu-HU' : language === 'de' ? 'de-DE' : 'en-US', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Top Header Card */}
      <div className="details-card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
              <ShieldCheck size={26} color="var(--primary)" />
              <h2 className="details-card-title" style={{ margin: 0 }}>Engedélykérések</h2>
            </div>
            <p style={{ margin: 0, fontSize: '13px', color: 'var(--text-secondary)' }}>
              A raktárhoz való hozzáférési kérelmek ellenőrzése és engedélyezése (Raktárvezetői felület).
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <button
              type="button"
              className="btn-secondary"
              onClick={handleExportCSV}
              style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 14px', fontSize: '13px', height: '38px', width: 'auto' }}
            >
              <Download size={15} />
              <span>CSV Export</span>
            </button>

            <button
              type="button"
              className="btn-primary"
              onClick={() => {
                setAddError(null);
                setShowAddModal(true);
              }}
              style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 16px', fontSize: '13px', height: '38px', width: 'auto' }}
            >
              <Plus size={16} />
              <span>Új email engedélyezése</span>
            </button>
          </div>
        </div>

        {/* Filters and Search Bar */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '20px', flexWrap: 'wrap', gap: '14px' }}>
          {/* Status Tabs */}
          <div style={{ display: 'flex', gap: '6px', backgroundColor: 'var(--bg-secondary)', padding: '4px', borderRadius: 'var(--radius-md)' }}>
            <button
              type="button"
              onClick={() => setActiveTab('all')}
              style={{
                padding: '6px 14px',
                borderRadius: 'var(--radius-sm)',
                fontSize: '13px',
                fontWeight: activeTab === 'all' ? 600 : 500,
                border: 'none',
                backgroundColor: activeTab === 'all' ? 'var(--card-bg)' : 'transparent',
                color: activeTab === 'all' ? 'var(--primary)' : 'var(--text-secondary)',
                cursor: 'pointer',
                boxShadow: activeTab === 'all' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              <span>Mind</span>
              <span style={{ fontSize: '11px', padding: '2px 6px', borderRadius: '10px', backgroundColor: 'var(--bg-hover)', color: 'var(--text-secondary)' }}>
                {counts.all}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('pending')}
              style={{
                padding: '6px 14px',
                borderRadius: 'var(--radius-sm)',
                fontSize: '13px',
                fontWeight: activeTab === 'pending' ? 600 : 500,
                border: 'none',
                backgroundColor: activeTab === 'pending' ? 'var(--card-bg)' : 'transparent',
                color: activeTab === 'pending' ? '#d97706' : 'var(--text-secondary)',
                cursor: 'pointer',
                boxShadow: activeTab === 'pending' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              <Clock size={14} color="#d97706" />
              <span>Függőben</span>
              {counts.pending > 0 && (
                <span style={{ fontSize: '11px', padding: '2px 6px', borderRadius: '10px', backgroundColor: '#fef3c7', color: '#b45309', fontWeight: 700 }}>
                  {counts.pending}
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('approved')}
              style={{
                padding: '6px 14px',
                borderRadius: 'var(--radius-sm)',
                fontSize: '13px',
                fontWeight: activeTab === 'approved' ? 600 : 500,
                border: 'none',
                backgroundColor: activeTab === 'approved' ? 'var(--card-bg)' : 'transparent',
                color: activeTab === 'approved' ? 'var(--success)' : 'var(--text-secondary)',
                cursor: 'pointer',
                boxShadow: activeTab === 'approved' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              <CheckCircle2 size={14} color="var(--success)" />
              <span>Elfogadva</span>
              <span style={{ fontSize: '11px', padding: '2px 6px', borderRadius: '10px', backgroundColor: 'var(--success-bg)', color: 'var(--success)' }}>
                {counts.approved}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('rejected')}
              style={{
                padding: '6px 14px',
                borderRadius: 'var(--radius-sm)',
                fontSize: '13px',
                fontWeight: activeTab === 'rejected' ? 600 : 500,
                border: 'none',
                backgroundColor: activeTab === 'rejected' ? 'var(--card-bg)' : 'transparent',
                color: activeTab === 'rejected' ? 'var(--danger)' : 'var(--text-secondary)',
                cursor: 'pointer',
                boxShadow: activeTab === 'rejected' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              <XCircle size={14} color="var(--danger)" />
              <span>Elutasítva</span>
              <span style={{ fontSize: '11px', padding: '2px 6px', borderRadius: '10px', backgroundColor: 'var(--danger-bg)', color: 'var(--danger)' }}>
                {counts.rejected}
              </span>
            </button>
          </div>

          {/* Search Box */}
          <div className="search-bar-wrapper" style={{ maxWidth: '280px', margin: 0 }}>
            <Search className="input-icon" size={18} />
            <input
              type="text"
              placeholder="Keresés név vagy e-mail..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="search-input"
            />
          </div>
        </div>
      </div>

      {/* Main Table Card */}
      <div className="details-card" style={{ padding: '0', overflow: 'hidden' }}>
        {loading ? (
          <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-secondary)' }}>
            Töltés...
          </div>
        ) : (
          <div className="data-table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>IGÉNYLŐ NEVE</th>
                  <th>EMAIL CÍM</th>
                  <th>KÉRELEM DÁTUMA</th>
                  <th>STÁTUSZ</th>
                  <th style={{ textAlign: 'right' }}>MŰVELETEK</th>
                </tr>
              </thead>
              <tbody>
                {filteredRequests.map((req) => (
                  <tr key={req.id}>
                    <td style={{ fontWeight: 600 }}>{req.name || 'Névtelen Igénylő'}</td>
                    <td>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                        <Mail size={14} style={{ color: 'var(--text-secondary)' }} />
                        {req.email}
                      </span>
                    </td>
                    <td style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                      {formatDate(req.requested_at)}
                    </td>
                    <td>
                      {req.status === 'pending' && (
                        <span
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            padding: '4px 10px',
                            borderRadius: '12px',
                            backgroundColor: '#fef3c7',
                            color: '#b45309',
                            fontSize: '12px',
                            fontWeight: 600
                          }}
                        >
                          <Clock size={12} />
                          Függőben
                        </span>
                      )}
                      {req.status === 'approved' && (
                        <span
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            padding: '4px 10px',
                            borderRadius: '12px',
                            backgroundColor: 'var(--success-bg)',
                            color: 'var(--success)',
                            fontSize: '12px',
                            fontWeight: 600
                          }}
                        >
                          <CheckCircle2 size={12} />
                          Elfogadva
                        </span>
                      )}
                      {req.status === 'rejected' && (
                        <span
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            padding: '4px 10px',
                            borderRadius: '12px',
                            backgroundColor: 'var(--danger-bg)',
                            color: 'var(--danger)',
                            fontSize: '12px',
                            fontWeight: 600
                          }}
                        >
                          <XCircle size={12} />
                          Elutasítva
                        </span>
                      )}
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                        {req.status !== 'approved' && (
                          <button
                            type="button"
                            onClick={() => handleApprove(req)}
                            title="Engedélykérés elfogadása"
                            style={{
                              padding: '6px 10px',
                              borderRadius: 'var(--radius-sm)',
                              border: '1px solid var(--success)',
                              backgroundColor: 'var(--success-bg)',
                              color: 'var(--success)',
                              fontSize: '12px',
                              fontWeight: 600,
                              cursor: 'pointer',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px'
                            }}
                          >
                            <CheckCircle2 size={14} />
                            <span>Elfogadás</span>
                          </button>
                        )}

                        {req.status !== 'rejected' && (
                          <button
                            type="button"
                            onClick={() => handleReject(req)}
                            title="Engedélykérés elutasítása"
                            style={{
                              padding: '6px 10px',
                              borderRadius: 'var(--radius-sm)',
                              border: '1px solid var(--border)',
                              backgroundColor: 'transparent',
                              color: 'var(--danger)',
                              fontSize: '12px',
                              fontWeight: 500,
                              cursor: 'pointer',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px'
                            }}
                          >
                            <XCircle size={14} />
                            <span>Elutasítás</span>
                          </button>
                        )}

                        <button
                          type="button"
                          onClick={() => handleDelete(req)}
                          title="Törlés"
                          style={{
                            padding: '6px',
                            borderRadius: 'var(--radius-sm)',
                            border: 'none',
                            backgroundColor: 'transparent',
                            color: 'var(--text-secondary)',
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center'
                          }}
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}

                {filteredRequests.length === 0 && (
                  <tr>
                    <td colSpan={5} style={{ textAlign: 'center', padding: '40px 16px', color: 'var(--text-secondary)' }}>
                      Nincs megjeleníthető engedélykérés a megadott szűrési feltételek alapján.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Manual Approval Modal */}
      {showAddModal && (
        <div className="modal-overlay" onClick={() => setShowAddModal(false)}>
          <div className="modal-container" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '440px' }}>
            <div className="modal-header">
              <h3 className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <ShieldCheck size={20} color="var(--primary)" />
                <span>Új e-mail engedélyezése</span>
              </h3>
              <button className="modal-close" onClick={() => setShowAddModal(false)} type="button">
                &times;
              </button>
            </div>

            <form onSubmit={handleAddSubmit}>
              <div style={{ padding: '20px' }}>
                <p style={{ marginTop: 0, marginBottom: '16px', fontSize: '13px', color: 'var(--text-secondary)' }}>
                  Itt előre engedélyezhetsz egy e-mail címet, amellyel a felhasználó azonnal be tud majd regisztrálni és belépni a SmartFarm alkalmazásba.
                </p>

                {addError && (
                  <div
                    style={{
                      padding: '10px 12px',
                      backgroundColor: 'var(--danger-bg)',
                      color: 'var(--danger)',
                      borderRadius: 'var(--radius-sm)',
                      fontSize: '13px',
                      marginBottom: '16px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px'
                    }}
                  >
                    <AlertCircle size={16} style={{ flexShrink: 0 }} />
                    <span>{addError}</span>
                  </div>
                )}

                <div className="form-group" style={{ marginBottom: '14px' }}>
                  <label className="form-label">E-mail cím *</label>
                  <div className="input-icon-wrapper">
                    <Mail className="input-icon" size={18} />
                    <input
                      type="email"
                      required
                      className="input-with-icon"
                      placeholder="dolgozo@ceg.hu"
                      value={addEmail}
                      onChange={(e) => setAddEmail(e.target.value)}
                    />
                  </div>
                </div>

                <div className="form-group" style={{ marginBottom: '0' }}>
                  <label className="form-label">Név (Opcionális)</label>
                  <div className="input-icon-wrapper">
                    <User className="input-icon" size={18} />
                    <input
                      type="text"
                      className="input-with-icon"
                      placeholder="pl. Nagy Péter"
                      value={addName}
                      onChange={(e) => setAddName(e.target.value)}
                    />
                  </div>
                </div>
              </div>

              <div className="modal-footer" style={{ padding: '12px 20px', backgroundColor: 'var(--bg-secondary)', display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => setShowAddModal(false)}
                  style={{ width: 'auto', padding: '8px 16px', fontSize: '13px' }}
                >
                  Mégse
                </button>
                <button
                  type="submit"
                  className="btn-primary"
                  disabled={addLoading}
                  style={{ width: 'auto', padding: '8px 20px', fontSize: '13px' }}
                >
                  {addLoading ? 'Hozzáadás...' : 'Engedélyezés'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
