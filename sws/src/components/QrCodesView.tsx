import React, { useState, useMemo } from 'react';
import { Printer, Search, CheckSquare, Square, QrCode } from 'lucide-react';
import type { Material } from '../db/dbService';
import { useTranslation } from '../context/LanguageContext';

interface QrCodesViewProps {
  materials: Material[];
  onPrintQrClick: (m: Material) => void;
}

export const QrCodesView: React.FC<QrCodesViewProps> = ({
  materials,
  onPrintQrClick
}) => {
  const { t } = useTranslation();
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set(materials.map(m => m.id)));
  const [searchQuery, setSearchQuery] = useState('');

  // Filter materials based on search query
  const filteredMaterials = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return materials;
    return materials.filter(m => 
      m.name.toLowerCase().includes(query) ||
      m.id.toLowerCase().includes(query) ||
      m.category.toLowerCase().includes(query) ||
      m.location.toLowerCase().includes(query)
    );
  }, [materials, searchQuery]);

  const allFilteredSelected = filteredMaterials.length > 0 && filteredMaterials.every(m => selectedIds.has(m.id));

  const handleToggleSelectAll = () => {
    if (allFilteredSelected) {
      const next = new Set(selectedIds);
      filteredMaterials.forEach(m => next.delete(m.id));
      setSelectedIds(next);
    } else {
      const next = new Set(selectedIds);
      filteredMaterials.forEach(m => next.add(m.id));
      setSelectedIds(next);
    }
  };

  const handleToggleSelect = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const next = new Set(selectedIds);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    setSelectedIds(next);
  };

  const handlePrintSelectedA4 = () => {
    const selectedMaterials = materials.filter(m => selectedIds.has(m.id));
    if (selectedMaterials.length === 0) return;

    const printWin = window.open('', '_blank');
    if (!printWin) return;

    // Group selected materials into chunks of 4 (one 4-divided sticker quadrant = 4 QR codes)
    const quadrantChunks: Material[][] = [];
    for (let i = 0; i < selectedMaterials.length; i += 4) {
      quadrantChunks.push(selectedMaterials.slice(i, i + 4));
    }

    // Group quadrant chunks into A4 pages (max 4 quadrants per A4 sheet)
    const pages: Material[][][] = [];
    for (let i = 0; i < quadrantChunks.length; i += 4) {
      pages.push(quadrantChunks.slice(i, i + 4));
    }

    const pagesHtml = pages.map((pageQuadrants, pageIdx) => {
      const quadrantsHtml = pageQuadrants.map((quadrantItems) => {
        const miniCardsHtml = quadrantItems.map(m => `
          <div class="qr-mini-card">
            ${m.qr_code_url ? `<img src="${m.qr_code_url}" alt="${m.name}" />` : `<div class="qr-placeholder">QR</div>`}
            <div class="qr-id">${m.id}</div>
            <div class="qr-name">${m.name}</div>
            <div class="qr-location">${m.location || 'Nincs megadva'}</div>
          </div>
        `).join('');

        return `
          <div class="quadrant-sticker">
            <div class="quadrant-grid">
              ${miniCardsHtml}
            </div>
          </div>
        `;
      }).join('');

      return `
        <div class="a4-page ${pageIdx < pages.length - 1 ? 'page-break' : ''}">
          <div class="quadrants-wrapper">
            ${quadrantsHtml}
          </div>
        </div>
      `;
    }).join('');

    printWin.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>SmartFarm - QR Kódok A4 Nyomtatása (${selectedMaterials.length} db)</title>
          <style>
            @page {
              size: A4 portrait;
              margin: 6mm;
            }
            * {
              box-sizing: border-box;
              margin: 0;
              padding: 0;
              font-family: 'Inter', system-ui, -apple-system, sans-serif;
            }
            body {
              background: #fff;
              color: #000;
              padding: 0;
            }
            .a4-page {
              width: 198mm;
              height: 284mm;
              box-sizing: border-box;
              display: flex;
              flex-direction: column;
            }
            .page-break {
              page-break-after: always;
              break-after: page;
            }
            .quadrants-wrapper {
              display: grid;
              grid-template-columns: 1fr 1fr;
              grid-template-rows: 1fr 1fr;
              gap: 4mm;
              width: 100%;
              height: 100%;
            }
            /* Each of the 4 main A4 sticker fields (105mm x 148.5mm label area) */
            .quadrant-sticker {
              border: 1.5px dashed #888;
              border-radius: 4mm;
              padding: 4mm;
              background: #fff;
              box-sizing: border-box;
              display: flex;
              flex-direction: column;
            }
            .quadrant-grid {
              display: grid;
              grid-template-columns: 1fr 1fr;
              grid-template-rows: 1fr 1fr;
              gap: 3mm;
              width: 100%;
              height: 100%;
            }
            /* Mini QR card: 4 per quadrant sticker label */
            .qr-mini-card {
              border: 1px solid #ddd;
              border-radius: 2mm;
              padding: 2.5mm 1.5mm;
              display: flex;
              flex-direction: column;
              align-items: center;
              justify-content: center;
              text-align: center;
              background: #fff;
              box-sizing: border-box;
              overflow: hidden;
            }
            .qr-mini-card img {
              width: 25mm;
              height: 25mm;
              object-fit: contain;
              display: block;
            }
            .qr-placeholder {
              width: 25mm;
              height: 25mm;
              background: #eee;
              display: flex;
              align-items: center;
              justify-content: center;
              font-size: 8pt;
              color: #777;
            }
            .qr-id {
              font-family: monospace;
              font-size: 8.5pt;
              font-weight: 800;
              color: #000;
              margin-top: 1mm;
              letter-spacing: 0.3px;
            }
            .qr-name {
              font-size: 7pt;
              font-weight: 600;
              color: #222;
              margin-top: 0.5mm;
              line-height: 1.1;
              max-height: 2.2em;
              overflow: hidden;
              text-overflow: ellipsis;
              display: -webkit-box;
              -webkit-line-clamp: 2;
              -webkit-box-orient: vertical;
              width: 100%;
            }
            .qr-location {
              font-size: 6pt;
              color: #666;
              margin-top: 0.5mm;
            }
          </style>
        </head>
        <body>
          ${pagesHtml}
          <script>
            window.onload = function() {
              window.print();
              window.close();
            };
          </script>
        </body>
      </html>
    `);
    printWin.document.close();
  };

  return (
    <div className="details-card" style={{ width: '100%' }}>
      <div className="details-card-header" style={{ flexWrap: 'wrap', gap: '16px', marginBottom: '20px' }}>
        <div>
          <h2 className="details-card-title">{t('qrTitle')}</h2>
          <p className="page-subtitle">{t('qrSubtitle')}</p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
          <button
            type="button"
            className="btn-secondary"
            onClick={handleToggleSelectAll}
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '10px 14px' }}
          >
            {allFilteredSelected ? <CheckSquare size={18} style={{ color: 'var(--primary)' }} /> : <Square size={18} />}
            <span>{allFilteredSelected ? 'Kijelölés törlése' : 'Összes kijelölése'}</span>
          </button>

          <button
            type="button"
            className="btn-primary"
            onClick={handlePrintSelectedA4}
            disabled={selectedIds.size === 0}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              padding: '10px 18px',
              opacity: selectedIds.size === 0 ? 0.5 : 1,
              cursor: selectedIds.size === 0 ? 'not-allowed' : 'pointer'
            }}
          >
            <Printer size={18} />
            <span>Kijelöltek nyomtatása ({selectedIds.size} db)</span>
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', gap: '16px', flexWrap: 'wrap' }}>
        <div className="input-icon-wrapper" style={{ minWidth: '280px', flex: 1 }}>
          <Search className="input-icon" size={18} />
          <input
            type="text"
            className="input-with-icon"
            placeholder="Keresés név, ID vagy helyszín alapján..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        <div style={{ fontSize: '13px', color: 'var(--text-secondary)', fontWeight: 500 }}>
          Kijelölve: <strong style={{ color: 'var(--primary)' }}>{selectedIds.size}</strong> / {materials.length} anyag
        </div>
      </div>

      {/* Grid of QR Code Cards */}
      {filteredMaterials.length === 0 ? (
        <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-secondary)' }}>
          Nincs a keresési feltételnek megfelelő anyag.
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '16px' }}>
          {filteredMaterials.map((m) => {
            const isSelected = selectedIds.has(m.id);
            return (
              <div
                key={m.id}
                className="qr-card-item"
                style={{
                  position: 'relative',
                  border: isSelected ? '2px solid var(--primary)' : '1px solid var(--border)',
                  backgroundColor: isSelected ? 'var(--primary-light)' : 'var(--bg-card)',
                  borderRadius: 'var(--radius-md)',
                  padding: '16px',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  boxShadow: isSelected ? 'var(--shadow-md)' : 'var(--shadow-sm)'
                }}
                onClick={(e) => handleToggleSelect(m.id, e)}
              >
                {/* Top Selection Checkbox */}
                <div style={{ position: 'absolute', top: '12px', left: '12px', zIndex: 2 }}>
                  <input
                    type="checkbox"
                    className="checkbox-input"
                    checked={isSelected}
                    onChange={() => {}}
                    style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                  />
                </div>

                {/* Single Print Button */}
                <button
                  type="button"
                  title="Egyedi nyomtatás"
                  style={{
                    position: 'absolute',
                    top: '10px',
                    right: '10px',
                    background: 'none',
                    border: 'none',
                    padding: '6px',
                    borderRadius: 'var(--radius-sm)',
                    color: 'var(--text-secondary)',
                    cursor: 'pointer',
                    zIndex: 2
                  }}
                  onClick={(e) => {
                    e.stopPropagation();
                    onPrintQrClick(m);
                  }}
                >
                  <Printer size={16} />
                </button>

                {/* QR Image */}
                <div style={{ marginTop: '12px', marginBottom: '12px', backgroundColor: 'white', padding: '8px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }}>
                  {m.qr_code_url ? (
                    <img src={m.qr_code_url} alt={m.name} style={{ width: '120px', height: '120px', objectFit: 'contain' }} />
                  ) : (
                    <div style={{ width: '120px', height: '120px', backgroundColor: 'var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '4px' }}>
                      <QrCode size={40} style={{ color: 'var(--text-secondary)' }} />
                    </div>
                  )}
                </div>

                {/* Material Info */}
                <span style={{ fontFamily: 'monospace', fontWeight: 700, fontSize: '14px', color: 'var(--text-primary)' }}>
                  {m.id}
                </span>
                <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)', textAlign: 'center', marginTop: '2px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', width: '100%' }}>
                  {m.name}
                </span>
                <span style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                  {m.location || 'Nincs megadva'}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
