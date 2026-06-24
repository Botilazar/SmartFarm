import React, { useState } from 'react';
import { X, Package, AlertCircle, ArrowDownRight, ArrowUpRight } from 'lucide-react';
import { dbService } from '../db/dbService';
import type { Material } from '../db/dbService';

interface TransactionModalProps {
  material: Material;
  userName: string;
  onClose: () => void;
  onSubmitSuccess: () => void;
}

export const TransactionModal: React.FC<TransactionModalProps> = ({
  material,
  userName,
  onClose,
  onSubmitSuccess
}) => {
  const [transactionType, setTransactionType] = useState<'intake' | 'checkout'>('checkout');
  const [transactionQty, setTransactionQty] = useState<number>(1);
  const [transactionNotes, setTransactionNotes] = useState('');
  const [transactionError, setTransactionError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setTransactionError(null);

    const qty = Number(transactionQty);
    if (qty <= 0) {
      setTransactionError('Kérjük adj meg pozitív számot!');
      return;
    }

    let newQty = material.quantity;
    if (transactionType === 'checkout') {
      if (qty > material.quantity) {
        setTransactionError(`Nincs elég készlet! Jelenleg elérhető: ${material.quantity} ${material.unit}`);
        return;
      }
      newQty -= qty;
    } else {
      newQty += qty;
    }

    try {
      // Update quantity
      await dbService.updateMaterialQuantity(material.id, newQty);
      
      // Log transaction
      await dbService.addTransaction({
        material_id: material.id,
        material_name: material.name,
        type: transactionType,
        quantity: transactionType === 'checkout' ? -qty : qty,
        user_name: userName,
        notes: transactionNotes.trim() || undefined
      });

      onSubmitSuccess();
    } catch (err: any) {
      setTransactionError(err.message || 'Tranzakció rögzítése sikertelen.');
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal-card" style={{ maxWidth: '440px' }}>
        <div className="modal-header">
          <div className="modal-title">
            {material.id} — Készletmódosítás
          </div>
          <button onClick={onClose} aria-label="Bezárás">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal-body">
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
              {material.image_url ? (
                <img 
                  src={material.image_url} 
                  alt={material.name} 
                  style={{ width: '56px', height: '56px', borderRadius: '4px', objectFit: 'cover' }} 
                />
              ) : (
                <div style={{ width: '56px', height: '56px', borderRadius: '4px', backgroundColor: 'var(--primary-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--primary)' }}>
                  <Package size={24} style={{ margin: '0 auto' }} />
                </div>
              )}
              <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                <h4 style={{ fontSize: '14px', fontWeight: 700 }}>{material.name}</h4>
                <p style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                  Kategória: {material.category} • Hely: {material.location}
                </p>
                <p style={{ fontSize: '12px', fontWeight: 600, color: 'var(--primary)', marginTop: '2px' }}>
                  Jelenlegi készlet: {material.quantity} / {material.max_quantity} {material.unit}
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
              <label className="form-label" htmlFor="txQty">Mennyiség ({material.unit})</label>
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
            <button type="button" className="btn-secondary" onClick={onClose}>
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
  );
};
