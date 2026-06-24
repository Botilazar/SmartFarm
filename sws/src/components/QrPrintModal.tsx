import React from 'react';
import { X, Printer } from 'lucide-react';
import type { Material } from '../db/dbService';

interface QrPrintModalProps {
  material: Material;
  onClose: () => void;
}

export const QrPrintModal: React.FC<QrPrintModalProps> = ({
  material,
  onClose
}) => {
  const handlePrint = () => {
    const printWin = window.open('', '_blank');
    if (printWin) {
      printWin.document.write(`
        <html>
          <head>
            <title>QR kód nyomtatás - ${material.id}</title>
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
              <img src="${material.qr_code_url}" />
              <h2>${material.id}</h2>
              <p>${material.name}</p>
              <p style="font-size: 12px; color: #999; margin-top: 5px;">SmartFarm Raktárhely: ${material.location}</p>
            </div>
            <script>
              window.onload = function() { window.print(); window.close(); }
            </script>
          </body>
        </html>
      `);
      printWin.document.close();
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal-card" style={{ maxWidth: '340px' }}>
        <div className="modal-header">
          <div className="modal-title">QR-Kód letöltés</div>
          <button onClick={onClose} aria-label="Bezárás">
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
            {material.qr_code_url ? (
              <img src={material.qr_code_url} alt={material.name} style={{ width: '180px', height: '180px' }} />
            ) : (
              <div style={{ width: '180px', height: '180px', backgroundColor: 'var(--border)' }} />
            )}
            <h4 style={{ fontFamily: 'monospace', fontSize: '18px', fontWeight: 700, marginTop: '12px' }}>{material.id}</h4>
            <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '4px' }}>{material.name}</p>
            <p style={{ fontSize: '11px', color: 'var(--text-light)', marginTop: '2px' }}>Helyszín: {material.location}</p>
          </div>

          <button 
            type="button" 
            className="btn-primary" 
            style={{ marginTop: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
            onClick={handlePrint}
          >
            <Printer size={16} />
            <span>QR-Kód Nyomtatása</span>
          </button>
        </div>
      </div>
    </div>
  );
};
