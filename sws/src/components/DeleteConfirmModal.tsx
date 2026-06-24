import React from 'react';
import { X, Trash2, AlertCircle } from 'lucide-react';
import { dbService } from '../db/dbService';
import type { Material } from '../db/dbService';

interface DeleteConfirmModalProps {
  material: Material;
  onClose: () => void;
  onDeleteSuccess: () => void;
}

export const DeleteConfirmModal: React.FC<DeleteConfirmModalProps> = ({
  material,
  onClose,
  onDeleteSuccess
}) => {
  const handleDelete = async () => {
    try {
      await dbService.deleteMaterial(material.id);
      onDeleteSuccess();
    } catch (err: any) {
      alert(err.message || 'Törlés sikertelen.');
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal-card" style={{ maxWidth: '400px' }}>
        <div className="modal-header" style={{ borderColor: 'var(--danger-bg)' }}>
          <div className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--danger)' }}>
            <Trash2 size={20} />
            <span>Anyag törlése</span>
          </div>
          <button onClick={onClose} aria-label="Bezárás">
            <X size={20} />
          </button>
        </div>
        
        <div className="modal-body" style={{ padding: '20px 24px' }}>
          <p style={{ fontSize: '14px', lineHeight: 1.5, color: 'var(--text-primary)' }}>
            Biztosan véglegesen törölni szeretnéd a(z) <strong style={{ fontWeight: 700 }}>{material.name}</strong> (<code style={{ fontFamily: 'monospace', backgroundColor: 'var(--bg-app)', padding: '2px 4px', borderRadius: '4px' }}>{material.id}</code>) anyagot?
          </p>
          <div 
            style={{
              marginTop: '16px',
              padding: '12px',
              backgroundColor: 'var(--danger-bg)',
              border: '1px solid var(--danger)',
              color: 'var(--danger)',
              borderRadius: '6px',
              fontSize: '12px',
              display: 'flex',
              gap: '8px',
              alignItems: 'center'
            }}
          >
            <AlertCircle size={16} style={{ flexShrink: 0 }} />
            <span>Ez a művelet nem vonható vissza, és törli a kapcsolódó összes készletmozgási előzményt is!</span>
          </div>
        </div>

        <div className="modal-footer">
          <button 
            type="button" 
            className="btn-secondary" 
            onClick={onClose}
          >
            Mégsem
          </button>
          <button
            type="button"
            className="btn-primary"
            style={{
              backgroundColor: 'var(--danger)',
              borderColor: 'var(--danger)',
              color: 'white',
              width: 'auto',
              paddingInline: '20px'
            }}
            onClick={handleDelete}
          >
            Törlés megerősítése
          </button>
        </div>
      </div>
    </div>
  );
};
