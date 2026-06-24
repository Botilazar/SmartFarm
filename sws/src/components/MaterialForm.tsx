import React, { useState, useRef } from 'react';
import { Camera, Upload, AlertCircle, X, Sprout } from 'lucide-react';
import type { Material } from '../db/dbService';

interface MaterialFormProps {
  onSave: (material: Omit<Material, 'qr_code_url'>) => Promise<void>;
  onCancel: () => void;
  existingIds: string[];
  initialData?: Material | null;
}

export const MaterialForm: React.FC<MaterialFormProps> = ({ onSave, onCancel, existingIds, initialData = null }) => {
  const [id, setId] = useState(initialData ? initialData.id : '');
  const [name, setName] = useState(initialData ? initialData.name : '');
  const [quantity, setQuantity] = useState<number>(initialData ? initialData.quantity : 0);
  const [maxQuantity, setMaxQuantity] = useState<number>(initialData ? initialData.max_quantity : 10);
  const [unit, setUnit] = useState(initialData ? initialData.unit : 'db');
  const [category, setCategory] = useState(initialData ? initialData.category : 'Permetszerek');
  const [location, setLocation] = useState(initialData ? initialData.location : 'A1-01-01');
  const [imageUrl, setImageUrl] = useState(initialData ? initialData.image_url : '');
  
  // Camera capture states
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Validate form
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Suggest next ID based on category selection
  const handleCategoryChange = (cat: string) => {
    setCategory(cat);
    
    // Auto-suggest next ID based on category prefix
    if (!initialData) {
      const prefix = cat === 'Permetszerek' ? 'PRM'
                   : cat === 'Műtrágyák' ? 'MUT'
                   : cat === 'Vetőmagok' ? 'VET'
                   : cat === 'Tápok' ? 'TAP'
                   : cat === 'Adalékanyagok' ? 'ADL'
                   : 'EGY';
      
      // Find highest index in existing IDs for this prefix
      const pattern = new RegExp(`^${prefix}-(\\d+)$`);
      let maxNum = 0;
      
      for (const curId of existingIds) {
        const match = curId.match(pattern);
        if (match) {
          const num = parseInt(match[1], 10);
          if (num > maxNum) maxNum = num;
        }
      }
      
      const nextNum = String(maxNum + 1).padStart(3, '0');
      setId(`${prefix}-${nextNum}`);

      // Auto-adjust unit defaults
      if (cat === 'Permetszerek' || cat === 'Adalékanyagok') {
        setUnit('l');
      } else if (cat === 'Műtrágyák' || cat === 'Tápok' || cat === 'Vetőmagok') {
        setUnit('kg');
      } else {
        setUnit('db');
      }
    }
  };

  // Run on category select on mount to assign initial suggested ID
  React.useEffect(() => {
    if (!initialData) {
      handleCategoryChange(category);
    }
  }, []);

  // CAMERA SNAPSHOT MANAGEMENT
  const startCamera = async () => {
    setCameraError(null);
    setIsCameraActive(true);
    
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
        audio: false
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (err) {
      console.error('Error starting photo camera:', err);
      setCameraError('Nem sikerült hozzáférni a kamerához. Ellenőrizd a böngésző engedélyeket.');
      setIsCameraActive(false);
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    setIsCameraActive(false);
  };

  const capturePhoto = () => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      
      if (ctx) {
        // Set canvas dimensions to match video stream
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        
        // Draw video frame to canvas
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        
        // Save base64 image URL
        const dataUrl = canvas.toDataURL('image/jpeg');
        setImageUrl(dataUrl);
        stopCamera();
      }
    }
  };

  // FILE UPLOAD MANAGEMENT
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setImageUrl(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    // Validate ID format (e.g. PRM-001)
    const idRegex = /^[A-Z]{3}-\d{3}$/;
    if (!idRegex.test(id)) {
      setErrorMessage('Az azonosítónak HHH-SZSZSZ formátumúnak kell lennie (pl. PRM-001)!');
      return;
    }

    if (!initialData && existingIds.includes(id)) {
      setErrorMessage(`Már létezik anyag ezzel az azonosítóval: ${id}`);
      return;
    }

    if (quantity < 0 || maxQuantity <= 0) {
      setErrorMessage('A mennyiségeknek nagyobbnak kell lenniük 0-nál.');
      return;
    }

    if (quantity > maxQuantity) {
      setErrorMessage('Az aktuális mennyiség nem lehet nagyobb, mint a maximális készlet.');
      return;
    }

    setIsSubmitting(true);
    try {
      await onSave({
        id,
        name: name.trim(),
        quantity: Number(quantity),
        max_quantity: Number(maxQuantity),
        unit,
        category,
        location: location.toUpperCase(),
        image_url: imageUrl,
      });
    } catch (err: any) {
      setErrorMessage(err.message || 'Hiba történt az anyag mentése során.');
      setIsSubmitting(false);
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal-card">
        <div className="modal-header">
          <div className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Sprout size={20} className="mobile-action-btn-icon" />
            <span>{initialData ? 'Anyag szerkesztése' : 'Új anyag felvétele'}</span>
          </div>
          <button onClick={onCancel} aria-label="Bezárás">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal-body" style={{ maxHeight: '70vh' }}>
            
            {errorMessage && (
              <div
                style={{
                  display: 'flex',
                  gap: '8px',
                  padding: '12px',
                  borderRadius: '8px',
                  backgroundColor: 'var(--danger-bg)',
                  color: 'var(--danger)',
                  fontSize: '13px',
                  marginBottom: '20px',
                }}
              >
                <AlertCircle size={18} style={{ flexShrink: 0 }} />
                <div>{errorMessage}</div>
              </div>
            )}

            <div className="form-row">
              <div className="form-group">
                <label className="form-label" htmlFor="catSelect">Kategória</label>
                <select
                  id="catSelect"
                  className="form-select"
                  value={category}
                  onChange={(e) => handleCategoryChange(e.target.value)}
                >
                  <option value="Permetszerek">Permetszerek</option>
                  <option value="Műtrágyák">Műtrágyák</option>
                  <option value="Vetőmagok">Vetőmagok</option>
                  <option value="Tápok">Tápok</option>
                  <option value="Adalékanyagok">Adalékanyagok</option>
                  <option value="Egyéb">Egyéb</option>
                </select>
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="mId">Azonosító</label>
                <input
                  id="mId"
                  type="text"
                  required
                  disabled={!!initialData}
                  style={{ opacity: initialData ? 0.7 : 1, cursor: initialData ? 'not-allowed' : 'text' }}
                  className="form-input-text"
                  placeholder="pl. PRM-001"
                  value={id}
                  onChange={(e) => setId(e.target.value.toUpperCase())}
                />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="mName">Anyag Megnevezése</label>
              <input
                id="mName"
                type="text"
                required
                className="form-input-text"
                placeholder="pl. Permetszer A"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>

            <div className="form-row">
              <div className="form-group">
                <label className="form-label" htmlFor="mQty">Kezdő Mennyiség</label>
                <input
                  id="mQty"
                  type="number"
                  required
                  min="0"
                  step="any"
                  className="form-input-text"
                  value={quantity === 0 ? '' : quantity}
                  onChange={(e) => setQuantity(Number(e.target.value))}
                />
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="mMaxQty">Maximális Kapacitás</label>
                <input
                  id="mMaxQty"
                  type="number"
                  required
                  min="1"
                  step="any"
                  className="form-input-text"
                  value={maxQuantity}
                  onChange={(e) => setMaxQuantity(Number(e.target.value))}
                />
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label className="form-label" htmlFor="mUnit">Mértékegység</label>
                <select
                  id="mUnit"
                  className="form-select"
                  value={unit}
                  onChange={(e) => setUnit(e.target.value)}
                >
                  <option value="db">Darab (db)</option>
                  <option value="kg">Kilogramm (kg)</option>
                  <option value="l">Liter (l)</option>
                </select>
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="mLoc">Raktárhely (Szekció-Részleg-Polc)</label>
                <input
                  id="mLoc"
                  type="text"
                  required
                  className="form-input-text"
                  placeholder="pl. A1-01-03"
                  value={location}
                  onChange={(e) => setLocation(e.target.value.toUpperCase())}
                />
              </div>
            </div>

            {/* Photo Section */}
            <div className="form-group">
              <label className="form-label">Termékkép készítése vagy feltöltése</label>
              
              {isCameraActive ? (
                <div>
                  <div className="camera-preview-container">
                    <video ref={videoRef} autoPlay playsInline muted className="camera-video" />
                    <div className="camera-capture-overlay">
                      <button
                        type="button"
                        className="btn-primary"
                        style={{ borderRadius: '50%', width: '56px', height: '56px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                        onClick={capturePhoto}
                        aria-label="Fénykép készítése"
                      >
                        <Camera size={24} />
                      </button>
                    </div>
                  </div>
                  <button type="button" className="btn-secondary" onClick={stopCamera} style={{ width: '100%' }}>
                    Mégsem készít képet
                  </button>
                </div>
              ) : imageUrl ? (
                <div>
                  <img src={imageUrl} alt="Termék előnézet" className="captured-image-preview" />
                  <div className="captured-preview-actions">
                    <button type="button" className="btn-secondary" style={{ flex: 1 }} onClick={startCamera}>
                      <Camera size={16} />
                      <span>Kép cseréje</span>
                    </button>
                    <button type="button" className="btn-secondary" style={{ flex: 1, borderColor: '#ef4444', color: '#ef4444' }} onClick={() => setImageUrl('')}>
                      <span>Kép törlése</span>
                    </button>
                  </div>
                </div>
              ) : (
                <div style={{ display: 'flex', gap: '12px' }}>
                  <button type="button" className="btn-secondary" style={{ flex: 1, padding: '16px' }} onClick={startCamera}>
                    <Camera size={20} />
                    <span style={{ display: 'block', fontSize: '12px', marginTop: '4px' }}>Fotózás kamerával</span>
                  </button>
                  
                  <label className="btn-secondary" style={{ flex: 1, padding: '16px', cursor: 'pointer', textAlign: 'center' }}>
                    <Upload size={20} style={{ margin: '0 auto' }} />
                    <span style={{ display: 'block', fontSize: '12px', marginTop: '4px' }}>Kép feltöltése</span>
                    <input
                      type="file"
                      accept="image/*"
                      style={{ display: 'none' }}
                      onChange={handleFileUpload}
                    />
                  </label>
                </div>
              )}

              {cameraError && (
                <div style={{ color: 'var(--danger)', fontSize: '12px', marginTop: '6px' }}>
                  {cameraError}
                </div>
              )}
            </div>

            <canvas ref={canvasRef} style={{ display: 'none' }} />
          </div>

          <div className="modal-footer">
            <button type="button" className="btn-secondary" onClick={onCancel} disabled={isSubmitting}>
              Mégsem
            </button>
            <button type="submit" className="btn-primary" style={{ width: 'auto', paddingInline: '24px' }} disabled={isSubmitting}>
              {isSubmitting ? 'Mentés...' : (initialData ? 'Módosítások mentése' : 'Termék mentése')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
