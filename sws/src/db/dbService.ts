import { supabase, isSupabaseConfigured } from './supabaseClient';
import QRCode from 'qrcode';

export interface Material {
  id: string;
  name: string;
  quantity: number;
  max_quantity: number;
  unit: string;
  category: string;
  location: string;
  image_url: string;
  qr_code_url: string;
  expiration_date?: string;
  created_at?: string;
}

export interface Transaction {
  id: string;
  material_id: string;
  material_name: string;
  type: 'intake' | 'checkout'; // "Bevétel" | "Kivétel"
  quantity: number;            // pl. 50 vagy -2
  timestamp: string;           // ISO dátum
  user_name: string;           // bejelentkezett felhasználó
  notes?: string;
}

export interface UserProfile {
  id: string;
  email: string;
  name: string;
  role: 'admin' | 'operator';
}

export interface AllowedEmail {
  id: string;
  email: string;
  name?: string;
  created_at: string;
}

export type AccessRequest = AllowedEmail & {
  status: 'approved' | 'pending' | 'rejected';
  requested_at: string;
};

// Check status helper based on user criteria:
// Green: > 70%, Yellow: 40-70%, Red: < 40%
export const getStockStatus = (quantity: number, maxQuantity: number): 'green' | 'yellow' | 'red' => {
  const percentage = (quantity / maxQuantity) * 100;
  if (percentage > 70) return 'green';
  if (percentage >= 40) return 'yellow';
  return 'red';
};

// ----------------------------------------------------
// LOCAL STORAGE MOCK DB IMPLEMENTATION
// ----------------------------------------------------

const STORAGE_KEYS = {
  MATERIALS: 'smartfarm_materials',
  TRANSACTIONS: 'smartfarm_transactions',
  USERS: 'smartfarm_users',
  CURRENT_USER: 'smartfarm_current_user',
  ALLOWED_EMAILS: 'smartfarm_allowed_emails',
};

// Generate seed data matching screenshot stats exactly:
// Total = 128
// Status: Green = 82, Yellow = 31, Red = 15
// Categories: Permetszerek (38), Műtrágyák (32), Vetőmagok (20), Tápok (18), Adalékanyagok (12), Egyéb (8)
const generateSeedMaterials = async (): Promise<Material[]> => {
  const list: Material[] = [];

  // 1. Defined items from screenshot
  const specificItems = [
    { id: 'PRM-001', name: 'Permetszer A', quantity: 3, max_quantity: 50, unit: 'db', category: 'Permetszerek', location: 'A1-01-03', expiration_date: '2026-06-15' },
    { id: 'MUT-004', name: 'Műtrágya B', quantity: 12, max_quantity: 25, unit: 'kg', category: 'Műtrágyák', location: 'B2-04-02', expiration_date: '2026-07-28' },
    { id: 'VET-011', name: 'Vetőmag C', quantity: 5, max_quantity: 80, unit: 'kg', category: 'Vetőmagok', location: 'C1-02-01', expiration_date: '2027-03-01' },
    { id: 'PRM-007', name: 'Gombaölő szer D', quantity: 18, max_quantity: 35, unit: 'kg', category: 'Permetszerek', location: 'A1-03-05' },
    { id: 'MUT-002', name: 'Műtrágya E', quantity: 16, max_quantity: 33, unit: 'kg', category: 'Műtrágyák', location: 'B1-01-02' },
  ];

  // Map of category target counts
  const categoryTargets: { [key: string]: number } = {
    'Permetszerek': 38,
    'Műtrágyák': 32,
    'Vetőmagok': 20,
    'Tápok': 18,
    'Adalékanyagok': 12,
    'Egyéb': 8,
  };

  // Keep track of current category counts
  const categoryCounts: { [key: string]: number } = {
    'Permetszerek': 0,
    'Műtrágyák': 0,
    'Vetőmagok': 0,
    'Tápok': 0,
    'Adalékanyagok': 0,
    'Egyéb': 0,
  };

  // Add specific items first
  for (const item of specificItems) {
    categoryCounts[item.category]++;
  }

  // Target status counts (we need 82 Green, 31 Yellow, 15 Red)
  // Specific items:
  // - PRM-001: Red (3/50 = 6%)
  // - MUT-004: Yellow (12/25 = 48%)
  // - VET-011: Red (5/80 = 6.25%)
  // - PRM-007: Yellow (18/35 = 51.4%)
  // - MUT-002: Yellow (16/33 = 48.5%)
  // Current count: 2 Red, 3 Yellow, 0 Green.
  // We need to generate:
  // - Green: 82 items
  // - Yellow: 28 items
  // - Red: 13 items
  let greensToGen = 82;
  let yellowsToGen = 28;
  let redsToGen = 13;

  const getStatusToAssign = () => {
    if (greensToGen > 0) {
      greensToGen--;
      return 'green';
    }
    if (yellowsToGen > 0) {
      yellowsToGen--;
      return 'yellow';
    }
    redsToGen--;
    return 'red';
  };

  // Let's generate the rest of the items category by category
  const categories = Object.keys(categoryTargets);

  for (const cat of categories) {
    const target = categoryTargets[cat];
    let count = categoryCounts[cat];

    while (count < target) {
      const index = count + 1;
      const idPrefix = cat === 'Permetszerek' ? 'PRM'
                     : cat === 'Műtrágyák' ? 'MUT'
                     : cat === 'Vetőmagok' ? 'VET'
                     : cat === 'Tápok' ? 'TAP'
                     : cat === 'Adalékanyagok' ? 'ADL'
                     : 'EGY';

      const paddedIndex = String(index).padStart(3, '0');
      const id = `${idPrefix}-${paddedIndex}`;

      // Avoid conflicts with predefined specific items
      if (specificItems.some(i => i.id === id)) {
        count++;
        categoryCounts[cat]++;
        continue;
      }

      const status = getStatusToAssign();
      let max_quantity = 100;
      let quantity = 0;

      if (status === 'green') {
        max_quantity = 100;
        quantity = Math.floor(Math.random() * 25) + 75; // 75% to 99%
      } else if (status === 'yellow') {
        max_quantity = 100;
        quantity = Math.floor(Math.random() * 29) + 41; // 41% to 69%
      } else {
        max_quantity = 100;
        quantity = Math.floor(Math.random() * 35) + 3; // 3% to 38%
      }

      const unit = cat === 'Permetszerek' || cat === 'Adalékanyagok' ? 'l'
                 : cat === 'Műtrágyák' || cat === 'Tápok' || cat === 'Vetőmagok' ? 'kg'
                 : 'db';

      // Pick location
      const sections = ['A', 'B', 'C', 'D'];
      const rack = Math.floor(Math.random() * 4) + 1;
      const shelf = Math.floor(Math.random() * 4) + 1;
      const level = Math.floor(Math.random() * 3) + 1;
      const location = `${sections[Math.floor(Math.random() * sections.length)]}${rack}-0${shelf}-0${level}`;

      list.push({
        id,
        name: `${cat.slice(0, -1)} tétel ${index}`,
        quantity,
        max_quantity,
        unit,
        category: cat,
        location,
        image_url: '',
        qr_code_url: '',
        created_at: new Date().toISOString(),
      });

      count++;
      categoryCounts[cat]++;
    }
  }

  // Add specific items into the list
  for (const item of specificItems) {
    list.push({
      ...item,
      image_url: '',
      qr_code_url: '',
      created_at: new Date().toISOString(),
    });
  }

  // Batch QR code generation in smaller chunks to avoid freezing main thread
  const fullList: Material[] = [];
  const chunkSize = 30;
  for (let i = 0; i < list.length; i += chunkSize) {
    const chunk = list.slice(i, i + chunkSize);
    const resolvedChunk = await Promise.all(
      chunk.map(async (m) => {
        try {
          const qr = await QRCode.toDataURL(m.id);
          return { ...m, qr_code_url: qr };
        } catch (err) {
          return m;
        }
      })
    );
    fullList.push(...resolvedChunk);
  }

  return fullList;
};

// In-Memory cache variables to eliminate repeated localStorage JSON parsing
let memoryMaterials: Material[] | null = null;
let memoryTransactions: Transaction[] | null = null;
let memoryUsers: UserProfile[] | null = null;
let memoryAllowedEmails: AllowedEmail[] | null = null;
let isDbInitialized = false;

const getLocalMaterials = (): Material[] => {
  if (memoryMaterials) return memoryMaterials;
  const data = localStorage.getItem(STORAGE_KEYS.MATERIALS);
  memoryMaterials = data ? JSON.parse(data) : [];
  return memoryMaterials!;
};

const saveLocalMaterials = (materials: Material[]) => {
  memoryMaterials = materials;
  localStorage.setItem(STORAGE_KEYS.MATERIALS, JSON.stringify(materials));
};

const getLocalTransactions = (): Transaction[] => {
  if (memoryTransactions) return memoryTransactions;
  const data = localStorage.getItem(STORAGE_KEYS.TRANSACTIONS);
  memoryTransactions = data ? JSON.parse(data) : [];
  return memoryTransactions!;
};

const saveLocalTransactions = (txs: Transaction[]) => {
  memoryTransactions = txs;
  localStorage.setItem(STORAGE_KEYS.TRANSACTIONS, JSON.stringify(txs));
};

const getLocalUsers = (): UserProfile[] => {
  if (memoryUsers) return memoryUsers;
  const data = localStorage.getItem(STORAGE_KEYS.USERS);
  memoryUsers = data ? JSON.parse(data) : [];
  return memoryUsers!;
};

const saveLocalUsers = (users: any[]) => {
  memoryUsers = users;
  localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(users));
};

const getLocalAllowedEmails = (): AllowedEmail[] => {
  if (memoryAllowedEmails) return memoryAllowedEmails;
  const data = localStorage.getItem(STORAGE_KEYS.ALLOWED_EMAILS);
  memoryAllowedEmails = data ? JSON.parse(data) : [];
  return memoryAllowedEmails!;
};

const saveLocalAllowedEmails = (emails: AllowedEmail[]) => {
  memoryAllowedEmails = emails;
  localStorage.setItem(STORAGE_KEYS.ALLOWED_EMAILS, JSON.stringify(emails));
};

// Seed LocalStorage if empty
export const seedMockDataIfEmpty = async () => {
  if (getLocalMaterials().length === 0) {
    const seedMats = await generateSeedMaterials();
    saveLocalMaterials(seedMats);

    // Seed some mock transactions as seen in the UI
    const seedTxs: Transaction[] = [
      {
        id: '1',
        material_id: 'MUT-004',
        material_name: 'Műtrágya B',
        type: 'intake',
        quantity: 50,
        timestamp: new Date(new Date().setHours(9, 32, 0)).toISOString(),
        user_name: 'Kovács Gábor',
        notes: 'Havi beszállítás',
      },
      {
        id: '2',
        material_id: 'PRM-001',
        material_name: 'Permetszer A',
        type: 'checkout',
        quantity: -2,
        timestamp: new Date(new Date().setHours(8, 45, 0)).toISOString(),
        user_name: 'Kovács Gábor',
        notes: 'Gyümölcsös permetezéshez',
      },
      {
        id: '3',
        material_id: 'VET-011',
        material_name: 'Vetőmag C',
        type: 'intake',
        quantity: 20,
        timestamp: new Date(new Date().setHours(7, 58, 0)).toISOString(),
        user_name: 'Kovács Gábor',
        notes: 'Beszállítás',
      },
      {
        id: '4',
        material_id: 'MUT-002',
        material_name: 'Műtrágya E',
        type: 'checkout',
        quantity: -10,
        timestamp: new Date(new Date().setDate(new Date().getDate() - 1)).toISOString(), // Yesterday
        user_name: 'Kovács Gábor',
        notes: 'Kihordás a 4-es táblára',
      },
      {
        id: '5',
        material_id: 'PRM-007',
        material_name: 'Gombaölő szer D',
        type: 'intake',
        quantity: 6,
        timestamp: new Date(new Date().setDate(new Date().getDate() - 1)).toISOString(), // Yesterday
        user_name: 'Kovács Gábor',
        notes: 'Maradék visszahozatala',
      },
      // Historical checkouts for trend graphing:
      {
        id: 'h1',
        material_id: 'MUT-004',
        material_name: 'Műtrágya B',
        type: 'checkout',
        quantity: -15,
        timestamp: new Date('2026-03-12T10:00:00Z').toISOString(),
        user_name: 'Kovács Gábor',
        notes: 'Tavaszi indító trágyázás',
      },
      {
        id: 'h2',
        material_id: 'PRM-001',
        material_name: 'Permetszer A',
        type: 'checkout',
        quantity: -8,
        timestamp: new Date('2026-03-15T14:30:00Z').toISOString(),
        user_name: 'Kovács Gábor',
        notes: 'Lemosó permetezés',
      },
      {
        id: 'h3',
        material_id: 'VET-011',
        material_name: 'Vetőmag C',
        type: 'checkout',
        quantity: -35,
        timestamp: new Date('2026-04-18T09:15:00Z').toISOString(),
        user_name: 'Kovács Gábor',
        notes: 'Tavaszi vetés',
      },
      {
        id: 'h4',
        material_id: 'MUT-004',
        material_name: 'Műtrágya B',
        type: 'checkout',
        quantity: -25,
        timestamp: new Date('2026-04-20T11:00:00Z').toISOString(),
        user_name: 'Kovács Gábor',
        notes: 'Fejtrágyázás',
      },
      {
        id: 'h5',
        material_id: 'PRM-001',
        material_name: 'Permetszer A',
        type: 'checkout',
        quantity: -15,
        timestamp: new Date('2026-05-10T08:00:00Z').toISOString(),
        user_name: 'Kovács Gábor',
        notes: 'Gomba elleni permetezés',
      },
      {
        id: 'h6',
        material_id: 'MUT-002',
        material_name: 'Műtrágya E',
        type: 'checkout',
        quantity: -12,
        timestamp: new Date('2026-05-15T13:45:00Z').toISOString(),
        user_name: 'Kovács Gábor',
        notes: 'Adalék kijuttatás',
      },
      {
        id: 'h7',
        material_id: 'MUT-004',
        material_name: 'Műtrágya B',
        type: 'checkout',
        quantity: -20,
        timestamp: new Date('2026-06-22T10:30:00Z').toISOString(),
        user_name: 'Kovács Gábor',
        notes: 'Nyári tápanyagutánpótlás',
      },
      {
        id: 'h8',
        material_id: 'PRM-001',
        material_name: 'Permetszer A',
        type: 'checkout',
        quantity: -14,
        timestamp: new Date('2026-06-24T16:00:00Z').toISOString(),
        user_name: 'Kovács Gábor',
        notes: 'Rovarok elleni permetezés',
      },
      {
        id: 'h9',
        material_id: 'PRM-007',
        material_name: 'Gombaölő szer D',
        type: 'checkout',
        quantity: -10,
        timestamp: new Date('2026-07-05T09:00:00Z').toISOString(),
        user_name: 'Kovács Gábor',
        notes: 'Nyári permetezés',
      }
    ];
    saveLocalTransactions(seedTxs);
  }
};

// ----------------------------------------------------
// DATABASE SERVICE LAYER (MOCK/SUPABASE UNIFIED)
// ----------------------------------------------------

export const dbService = {
  // Check if we are running in mock mode
  isMockMode: () => {
    return !isSupabaseConfigured;
  },

  // Initialize DB (seeds mock data if in mock mode)
  init: async () => {
    if (isDbInitialized) return;
    if (dbService.isMockMode()) {
      await seedMockDataIfEmpty();
    } else {
      // If Supabase is connected, we can check if the materials table is empty
      // and seed it if needed.
      try {
        const { data, error } = await supabase!
          .from('materials')
          .select('id')
          .limit(1);
        
        if (!error && (!data || data.length === 0)) {
          console.log('Supabase materials table is empty. Seeding database...');
          const seedMats = await generateSeedMaterials();
          
          // Chunk insertions to avoid payload limits
          const chunkSize = 20;
          for (let i = 0; i < seedMats.length; i += chunkSize) {
            const chunk = seedMats.slice(i, i + chunkSize);
            await supabase!.from('materials').insert(chunk);
          }
        }
      } catch (err) {
        console.error('Failed to initialize Supabase DB, falling back to LocalStorage', err);
      }
    }
    isDbInitialized = true;
  },

  // FETCH MATERIALS
  getMaterials: async (): Promise<Material[]> => {
    if (dbService.isMockMode()) {
      return getLocalMaterials();
    }

    const { data, error } = await supabase!
      .from('materials')
      .select('*')
      .order('id', { ascending: true });

    if (error) throw error;
    return data || [];
  },

  // FETCH MATERIAL BY ID
  getMaterialById: async (id: string): Promise<Material | null> => {
    if (dbService.isMockMode()) {
      const mats = getLocalMaterials();
      return mats.find(m => m.id === id) || null;
    }

    const { data, error } = await supabase!
      .from('materials')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (error) throw error;
    return data;
  },

  // ADD NEW MATERIAL
  addMaterial: async (material: Omit<Material, 'qr_code_url'>): Promise<Material> => {
    // Generate QR Code URL
    const qrCode = await QRCode.toDataURL(material.id);
    const newMaterial: Material = {
      ...material,
      qr_code_url: qrCode,
      created_at: new Date().toISOString(),
    };

    if (dbService.isMockMode()) {
      const mats = getLocalMaterials();
      if (mats.some(m => m.id === material.id)) {
        throw new Error(`Már létezik anyag ezzel az azonosítóval: ${material.id}`);
      }
      mats.push(newMaterial);
      saveLocalMaterials(mats);
      return newMaterial;
    }

    const { data, error } = await supabase!
      .from('materials')
      .insert(newMaterial)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  // UPDATE MATERIAL (Admin function)
  updateMaterial: async (id: string, updates: Omit<Material, 'id' | 'qr_code_url' | 'created_at'>): Promise<Material> => {
    if (dbService.isMockMode()) {
      const mats = getLocalMaterials();
      const idx = mats.findIndex(m => m.id === id);
      if (idx === -1) throw new Error(`Nem található anyag: ${id}`);
      
      const updatedMaterial: Material = {
        ...mats[idx],
        ...updates,
      };
      mats[idx] = updatedMaterial;
      saveLocalMaterials(mats);
      return updatedMaterial;
    }

    const { data, error } = await supabase!
      .from('materials')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  // UPDATE MATERIAL QUANTITY (Checkout / Intake)
  updateMaterialQuantity: async (id: string, newQty: number): Promise<Material> => {
    if (dbService.isMockMode()) {
      const mats = getLocalMaterials();
      const idx = mats.findIndex(m => m.id === id);
      if (idx === -1) throw new Error(`Nem található anyag: ${id}`);
      
      // Ensure quantity doesn't drop below 0
      const updatedQty = Math.max(0, newQty);
      mats[idx].quantity = updatedQty;
      saveLocalMaterials(mats);
      return mats[idx];
    }

    const { data, error } = await supabase!
      .from('materials')
      .update({ quantity: Math.max(0, newQty) })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  // DELETE MATERIAL (Admin function)
  deleteMaterial: async (id: string): Promise<void> => {
    if (dbService.isMockMode()) {
      const mats = getLocalMaterials();
      const updated = mats.filter(m => m.id !== id);
      saveLocalMaterials(updated);
      return;
    }

    const { error } = await supabase!
      .from('materials')
      .delete()
      .eq('id', id);

    if (error) throw error;
  },

  // FETCH TRANSACTIONS
  getTransactions: async (): Promise<Transaction[]> => {
    if (dbService.isMockMode()) {
      return getLocalTransactions().sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    }

    const { data, error } = await supabase!
      .from('transactions')
      .select('*')
      .order('timestamp', { ascending: false });

    if (error) throw error;
    return data || [];
  },

  // ADD TRANSACTION
  addTransaction: async (tx: Omit<Transaction, 'id' | 'timestamp'>): Promise<Transaction> => {
    const newTx: Transaction = {
      ...tx,
      id: Math.random().toString(36).substring(2, 9),
      timestamp: new Date().toISOString(),
    };

    if (dbService.isMockMode()) {
      const txs = getLocalTransactions();
      txs.push(newTx);
      saveLocalTransactions(txs);
      return newTx;
    }

    const { data, error } = await supabase!
      .from('transactions')
      .insert({
        material_id: tx.material_id,
        material_name: tx.material_name,
        type: tx.type,
        quantity: tx.quantity,
        user_name: tx.user_name,
        notes: tx.notes
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  // FETCH USER PROFILES
  getUserProfiles: async (): Promise<UserProfile[]> => {
    if (dbService.isMockMode()) {
      const savedUsersJson = localStorage.getItem(STORAGE_KEYS.USERS);
      const savedUsers = savedUsersJson ? JSON.parse(savedUsersJson) : [];
      // Combine with the default mock users, prioritizing local storage settings if any
      const defaultUsers: UserProfile[] = [
        { id: '1', name: 'Kovács Gábor', email: 'kovacs.gabor@ceg.hu', role: 'admin' },
        { id: '2', name: 'Kezelő János', email: 'kezelo.janos@ceg.hu', role: 'operator' },
      ];
      
      const combined = defaultUsers.map(du => {
        const saved = savedUsers.find((su: any) => su.email === du.email);
        return saved ? { ...du, role: saved.role } : du;
      });

      savedUsers.forEach((u: any) => {
        if (!combined.some(c => c.email === u.email)) {
          combined.push({
            id: u.id || Math.random().toString(36).substring(2, 9),
            name: u.name,
            email: u.email,
            role: u.role,
          });
        }
      });
      return combined;
    }

    const { data, error } = await supabase!
      .from('profiles')
      .select('*')
      .order('name', { ascending: true });

    if (error) throw error;
    return (data || []).map((u: any) => ({
      id: u.id,
      email: u.email,
      name: u.name || 'Névtelen Felhasználó',
      role: u.role === 'admin' ? 'admin' : 'operator',
    }));
  },

  // UPDATE USER PROFILE ROLE
  updateUserProfileRole: async (userId: string, newRole: 'admin' | 'operator'): Promise<void> => {
    if (dbService.isMockMode()) {
      let savedUsers = getLocalUsers();
      
      const idx = savedUsers.findIndex((u: any) => u.id === userId || u.email === userId);
      if (idx !== -1) {
        savedUsers[idx].role = newRole;
        saveLocalUsers(savedUsers);
      } else {
        const defaultUsers = [
          { id: '1', name: 'Kovács Gábor', email: 'kovacs.gabor@ceg.hu', role: 'admin' },
          { id: '2', name: 'Kezelő János', email: 'kezelo.janos@ceg.hu', role: 'operator' },
        ];
        const defaultUser = defaultUsers.find(u => u.id === userId || u.email === userId);
        if (defaultUser) {
          const newUser = {
            id: defaultUser.id,
            name: defaultUser.name,
            email: defaultUser.email,
            password: 'password123',
            role: newRole
          };
          savedUsers.push(newUser);
          saveLocalUsers(savedUsers);
        }
      }
      return;
    }

    const { error } = await supabase!
      .from('profiles')
      .update({ role: newRole })
      .eq('id', userId);

    if (error) throw error;
  },

  // ALLOWED EMAILS WHITELIST METHODS

  // GET ALL ALLOWED EMAILS
  getAllowedEmails: async (): Promise<AllowedEmail[]> => {
    if (dbService.isMockMode()) {
      let emails = getLocalAllowedEmails();
      if (emails.length === 0) {
        emails = [
          {
            id: 'mock-allowed-1',
            email: 'kovacs.gabor@ceg.hu',
            name: 'Kovács Gábor (Raktárvezető)',
            created_at: new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString()
          },
          {
            id: 'mock-allowed-2',
            email: 'kezelo.janos@ceg.hu',
            name: 'Kezelő János (Raktári dolgozó)',
            created_at: new Date(Date.now() - 15 * 24 * 3600 * 1000).toISOString()
          }
        ];
        saveLocalAllowedEmails(emails);
      }

      return [...emails].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    }

    try {
      const { data, error } = await supabase!
        .from('allowed_emails')
        .select('*');

      if (error) {
        console.warn('Could not fetch allowed_emails table from Supabase:', error.message);
        return [];
      }

      const mapped: AllowedEmail[] = (data || []).map((item: any) => ({
        id: item.id,
        email: item.email,
        name: item.name,
        created_at: item.created_at || item.requested_at || new Date().toISOString()
      }));

      return mapped.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    } catch (err) {
      console.warn('Exception fetching allowed_emails:', err);
      return [];
    }
  },

  // CHECK IF EMAIL IS ALLOWED
  isEmailAllowed: async (email: string): Promise<boolean> => {
    const trimmedEmail = email.trim().toLowerCase();

    // Default admin / test accounts are always allowed
    if (trimmedEmail === 'kovacs.gabor@ceg.hu' || trimmedEmail === 'kezelo.janos@ceg.hu') {
      return true;
    }

    if (dbService.isMockMode()) {
      const list = await dbService.getAllowedEmails();
      const found = list.some(item => item.email.toLowerCase() === trimmedEmail);
      if (found) return true;

      // Check if user exists in mock users
      const savedUsers = getLocalUsers();
      return savedUsers.some((u: any) => u.email.toLowerCase() === trimmedEmail);
    }

    try {
      const { data, error } = await supabase!
        .from('allowed_emails')
        .select('id')
        .eq('email', trimmedEmail)
        .maybeSingle();

      if (!error && data) return true;
    } catch (err) {
      console.warn('Error checking allowed_emails table:', err);
    }

    // Fallback check: if user is already in profiles table
    try {
      const { data: profData } = await supabase!
        .from('profiles')
        .select('id')
        .eq('email', trimmedEmail)
        .maybeSingle();

      return !!profData;
    } catch (err) {
      return false;
    }
  },

  // ADD ALLOWED EMAIL
  addAllowedEmail: async (email: string, name?: string): Promise<AllowedEmail> => {
    const trimmedEmail = email.trim().toLowerCase();
    const newItem: AllowedEmail = {
      id: crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2, 11),
      email: trimmedEmail,
      name: name || 'Engedélyezett Felhasználó',
      created_at: new Date().toISOString()
    };

    if (dbService.isMockMode()) {
      const list = await dbService.getAllowedEmails();
      const existingIdx = list.findIndex(i => i.email.toLowerCase() === trimmedEmail);
      if (existingIdx !== -1) {
        list[existingIdx].name = name || list[existingIdx].name;
        saveLocalAllowedEmails(list);
        return list[existingIdx];
      } else {
        list.push(newItem);
        saveLocalAllowedEmails(list);
        return newItem;
      }
    }

    const { data, error } = await supabase!
      .from('allowed_emails')
      .upsert({
        email: trimmedEmail,
        name: name || 'Engedélyezett Felhasználó',
        created_at: new Date().toISOString()
      }, { onConflict: 'email' })
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  // DELETE ALLOWED EMAIL
  deleteAllowedEmail: async (idOrEmail: string): Promise<void> => {
    if (dbService.isMockMode()) {
      const list = await dbService.getAllowedEmails();
      const updated = list.filter(i => i.id !== idOrEmail && i.email.toLowerCase() !== idOrEmail.toLowerCase());
      saveLocalAllowedEmails(updated);
      return;
    }

    const { error } = await supabase!
      .from('allowed_emails')
      .delete()
      .or(`id.eq.${idOrEmail},email.eq.${idOrEmail}`);

    if (error) throw error;
  },

  // BACKWARD COMPATIBILITY ALIASES FOR ACCESS REQUESTS
  getAccessRequests: async (): Promise<AccessRequest[]> => {
    const list = await dbService.getAllowedEmails();
    return list.map(item => ({
      ...item,
      status: 'approved' as const,
      requested_at: item.created_at
    }));
  },

  updateAccessRequestStatus: async (_id: string, _status: string): Promise<void> => {
    return;
  },

  deleteAccessRequest: async (idOrEmail: string): Promise<void> => {
    return dbService.deleteAllowedEmail(idOrEmail);
  },

  addApprovedEmailDirectly: async (email: string, name?: string): Promise<AllowedEmail> => {
    return dbService.addAllowedEmail(email, name);
  }
};
