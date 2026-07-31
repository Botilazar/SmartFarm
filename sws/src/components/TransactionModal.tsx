import React, { useState } from 'react';
import { X, Package, AlertCircle, ArrowDownRight, ArrowUpRight, ChevronDown, ChevronUp } from 'lucide-react';
import { dbService } from '../db/dbService';
import type { Material } from '../db/dbService';
import { useTranslation } from '../context/LanguageContext';

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
  const { t } = useTranslation();
  const [transactionType, setTransactionType] = useState<'intake' | 'checkout'>('checkout');
  const [transactionQty, setTransactionQty] = useState<number>(1);
  const [transactionNotes, setTransactionNotes] = useState('');
  const [transactionError, setTransactionError] = useState<string | null>(null);
  const [showIngredients, setShowIngredients] = useState(false);

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
        const notEnoughMsg = (t('txErrorNotEnoughStock') || 'Nincs elég készlet! Jelenleg elérhető: {current} {unit}')
          .replace('{current}', String(material.quantity))
          .replace('{unit}', material.unit);
        setTransactionError(notEnoughMsg);
        return;
      }
      newQty -= qty;
    } else {
      const totalQtyAfterIntake = material.quantity + qty;
      if (totalQtyAfterIntake > material.max_quantity) {
        const maxCapacityMsg = (t('txErrorMaxCapacity') || 'A felvenni kívánt mennyiséggel ({total} {unit}) a készlet meghaladná a maximális kapacitást ({max} {unit})! Növeld a maximum kapacitást az anyag szerkesztésénél.')
          .replace('{total}', String(totalQtyAfterIntake))
          .replace('{max}', String(material.max_quantity))
          .replaceAll('{unit}', material.unit);
        setTransactionError(maxCapacityMsg);
        return;
      }
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
        unit: material.unit,
        user_name: userName,
        notes: transactionNotes.trim() || undefined
      });

      onSubmitSuccess();
    } catch (err: unknown) {
      setTransactionError((err as Error)?.message || t('txErrorFailed'));
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal-card" style={{ maxWidth: '440px' }}>
        <div className="modal-header">
          <div className="modal-title">
            {material.id} — {t('txTitleAdjustment')}
          </div>
          <button onClick={onClose} aria-label={t('qrClose')}>
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
                  {t('colCategory')}: {t(`cat_${material.category}`)} • {t('txLocationLabel')}: {material.location}
                </p>
                <p style={{ fontSize: '12px', fontWeight: 600, color: 'var(--primary)', marginTop: '2px' }}>
                  {t('txCurrentStock')}: {material.quantity} / {material.max_quantity} {material.unit}
                </p>
              </div>
            </div>

            {material.active_ingredients && material.active_ingredients.length > 0 && (
              <button
                type="button"
                onClick={() => setShowIngredients(!showIngredients)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  width: '100%',
                  padding: '8px 12px',
                  marginBottom: showIngredients ? '0' : '16px',
                  backgroundColor: 'var(--bg-app)',
                  border: '1px solid var(--border)',
                  borderRadius: showIngredients ? '8px 8px 0 0' : '8px',
                  cursor: 'pointer',
                  fontSize: '12px',
                  fontWeight: 600,
                  color: 'var(--text-secondary)',
                  transition: 'all 0.15s ease'
                }}
              >
                <span>Hatóanyagok ({material.active_ingredients.length})</span>
                {showIngredients ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              </button>
            )}
            {showIngredients && material.active_ingredients && material.active_ingredients.length > 0 && (
              <div
                style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: '5px',
                  padding: '10px 12px',
                  marginBottom: '16px',
                  backgroundColor: 'var(--bg-app)',
                  border: '1px solid var(--border)',
                  borderTop: 'none',
                  borderRadius: '0 0 8px 8px'
                }}
              >
                {material.active_ingredients.map(ing => (
                  <span
                    key={ing}
                    style={{
                      fontSize: '10px',
                      fontWeight: 600,
                      color: 'var(--primary)',
                      backgroundColor: 'var(--primary-light)',
                      padding: '2px 7px',
                      borderRadius: '4px',
                      border: '1px solid rgba(0, 104, 55, 0.1)'
                    }}
                  >
                    {ing}
                  </span>
                ))}
              </div>
            )}

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
              <label className="form-label">{t('txTypeLabel')}</label>
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
                  {t('txOptCheckout')}
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
                  {t('txOptIntake')}
                </button>
              </div>
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="txQty">{t('txQtyLabel')} ({material.unit})</label>
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
                      onClick={() => setTransactionQty((prev) => (isNaN(prev) ? 0 : prev) + num)}
                    >
                      +{num}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label" htmlFor="txNotes">{t('txNotesLabel')}</label>
              <input
                id="txNotes"
                type="text"
                className="form-input-text"
                placeholder={t('txNotesPlaceholder')}
                value={transactionNotes}
                onChange={(e) => setTransactionNotes(e.target.value)}
              />
            </div>
          </div>

          <div className="modal-footer">
            <button type="button" className="btn-secondary" onClick={onClose}>
              {t('cancel')}
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
              {t('txBtnSubmit')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
