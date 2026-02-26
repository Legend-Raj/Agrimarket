/**
 * Mock Data for Development
 * 
 * Centralized mock data used when environment.useMockApi is true.
 * Structured to match real API response shapes for seamless swap later.
 */

import { LoginResponse, UserInfo, UserRole, CurrentUserResponse } from '../models/auth.models';

// ============================================
// Demo Credentials
// ============================================

export interface DemoCredential {
  role: UserRole;
  label: string;
  email: string;
  password: string;
  description: string;
}

export const DEMO_CREDENTIALS: DemoCredential[] = [
  {
    role: 'Grower',
    label: 'Farmer / Grower',
    email: 'grower@agrimarket.com',
    password: 'Grower@123',
    description: 'Browse products, view offers, manage orders',
  },
  {
    role: 'Retailer',
    label: 'Retailer',
    email: 'retailer@agrimarket.com',
    password: 'Retailer@123',
    description: 'Manage storefront, inventory, and sales',
  },
  {
    role: 'Manufacturer',
    label: 'Manufacturer',
    email: 'manufacturer@agrimarket.com',
    password: 'Manufacturer@123',
    description: 'Manage products, distribution, and analytics',
  },
];

// ============================================
// Mock Users
// ============================================

const MOCK_USERS: Record<string, UserInfo> = {
  'grower@agrimarket.com': {
    id: 'usr-grower-001',
    email: 'grower@agrimarket.com',
    name: 'Rajesh Kumar',
    role: 'Grower',
    isActive: true,
  },
  'retailer@agrimarket.com': {
    id: 'usr-retailer-001',
    email: 'retailer@agrimarket.com',
    name: 'Priya Sharma',
    role: 'Retailer',
    isActive: true,
  },
  'manufacturer@agrimarket.com': {
    id: 'usr-mfg-001',
    email: 'manufacturer@agrimarket.com',
    name: 'Anil Patel',
    role: 'Manufacturer',
    isActive: true,
  },
};

// ============================================
// Mock Auth Responses
// ============================================

export function getMockLoginResponse(email: string, password: string): LoginResponse | null {
  const credential = DEMO_CREDENTIALS.find(
    (c) => c.email === email && c.password === password
  );

  if (!credential) return null;

  const user = MOCK_USERS[email];
  if (!user) return null;

  return {
    accessToken: `mock-access-token-${user.role.toLowerCase()}-${Date.now()}`,
    refreshToken: `mock-refresh-token-${user.role.toLowerCase()}-${Date.now()}`,
    expiresIn: 3600,
    user,
  };
}

export function getMockCurrentUser(email: string): CurrentUserResponse | null {
  const user = MOCK_USERS[email];
  if (!user) return null;

  return {
    authenticated: true,
    userId: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    isActive: true,
  };
}

// ============================================
// Mock Product Categories (for Grower navbar)
// ============================================

export interface CategoryItem {
  name: string;
  route: string;
}

export interface SubCategory {
  heading: string;
  items: CategoryItem[];
}

export interface NavCategory {
  label: string;
  route: string;
  subCategories: SubCategory[];
}

export const GROWER_NAV_CATEGORIES: NavCategory[] = [
  {
    label: 'Crop Protection',
    route: '/grower/crop-protection',
    subCategories: [
      {
        heading: 'Shop by Crop',
        items: [
          { name: 'Cotton', route: '/grower/crop-protection/cotton' },
          { name: 'Rice / Paddy', route: '/grower/crop-protection/rice' },
          { name: 'Wheat', route: '/grower/crop-protection/wheat' },
        ],
      },
      {
        heading: 'Herbicides',
        items: [
          { name: 'Pre-Emergent', route: '/grower/crop-protection/herbicides/pre-emergent' },
          { name: 'Post-Emergent', route: '/grower/crop-protection/herbicides/post-emergent' },
          { name: 'Selective', route: '/grower/crop-protection/herbicides/selective' },
        ],
      },
      {
        heading: 'Pesticides',
        items: [
          { name: 'Organic Pesticides', route: '/grower/crop-protection/pesticides/organic' },
          { name: 'Chemical Pesticides', route: '/grower/crop-protection/pesticides/chemical' },
          { name: 'Bio-Pesticides', route: '/grower/crop-protection/pesticides/bio' },
        ],
      },
      {
        heading: 'Fungicides',
        items: [
          { name: 'Systemic', route: '/grower/crop-protection/fungicides/systemic' },
          { name: 'Contact', route: '/grower/crop-protection/fungicides/contact' },
          { name: 'Broad Spectrum', route: '/grower/crop-protection/fungicides/broad-spectrum' },
        ],
      },
      {
        heading: 'Insecticides',
        items: [
          { name: 'Neonicotinoids', route: '/grower/crop-protection/insecticides/neonicotinoids' },
          { name: 'Pyrethroids', route: '/grower/crop-protection/insecticides/pyrethroids' },
          { name: 'Organophosphates', route: '/grower/crop-protection/insecticides/organophosphates' },
        ],
      },
    ],
  },
  {
    label: 'Fertilizers & Nutrients',
    route: '/grower/fertilizers',
    subCategories: [
      {
        heading: 'By Type',
        items: [
          { name: 'Nitrogen-Based', route: '/grower/fertilizers/nitrogen' },
          { name: 'Phosphorus-Based', route: '/grower/fertilizers/phosphorus' },
          { name: 'Potassium-Based', route: '/grower/fertilizers/potassium' },
        ],
      },
      {
        heading: 'Organic',
        items: [
          { name: 'Compost', route: '/grower/fertilizers/organic/compost' },
          { name: 'Vermicompost', route: '/grower/fertilizers/organic/vermicompost' },
          { name: 'Bio-Fertilizers', route: '/grower/fertilizers/organic/bio' },
        ],
      },
      {
        heading: 'Micronutrients',
        items: [
          { name: 'Zinc', route: '/grower/fertilizers/micro/zinc' },
          { name: 'Boron', route: '/grower/fertilizers/micro/boron' },
          { name: 'Iron', route: '/grower/fertilizers/micro/iron' },
        ],
      },
    ],
  },
  {
    label: 'Seeds',
    route: '/grower/seeds',
    subCategories: [
      {
        heading: 'Cereal Seeds',
        items: [
          { name: 'Rice Seeds', route: '/grower/seeds/rice' },
          { name: 'Wheat Seeds', route: '/grower/seeds/wheat' },
          { name: 'Maize Seeds', route: '/grower/seeds/maize' },
        ],
      },
      {
        heading: 'Vegetable Seeds',
        items: [
          { name: 'Tomato', route: '/grower/seeds/tomato' },
          { name: 'Onion', route: '/grower/seeds/onion' },
          { name: 'Chilli', route: '/grower/seeds/chilli' },
        ],
      },
      {
        heading: 'Hybrid Seeds',
        items: [
          { name: 'BT Cotton', route: '/grower/seeds/bt-cotton' },
          { name: 'Hybrid Bajra', route: '/grower/seeds/hybrid-bajra' },
          { name: 'Hybrid Jowar', route: '/grower/seeds/hybrid-jowar' },
        ],
      },
    ],
  },
  {
    label: 'Livestock',
    route: '/grower/livestock',
    subCategories: [
      {
        heading: 'Animal Feed',
        items: [
          { name: 'Cattle Feed', route: '/grower/livestock/cattle-feed' },
          { name: 'Poultry Feed', route: '/grower/livestock/poultry-feed' },
          { name: 'Fish Feed', route: '/grower/livestock/fish-feed' },
        ],
      },
      {
        heading: 'Animal Health',
        items: [
          { name: 'Vaccines', route: '/grower/livestock/vaccines' },
          { name: 'Supplements', route: '/grower/livestock/supplements' },
          { name: 'Dewormers', route: '/grower/livestock/dewormers' },
        ],
      },
    ],
  },
];

// ============================================
// Mock Products
// ============================================

export interface MockProduct {
  id: string;
  name: string;
  description: string;
  price: number;
  unit: string;
  imageUrl: string | null;
  category: string;
  manufacturer: string;
  inStock: boolean;
}

export const MOCK_PRODUCTS: MockProduct[] = [
  {
    id: 'prod-001',
    name: 'SuperGrow NPK 20-20-20',
    description: 'Balanced NPK fertilizer for all crops. Promotes healthy growth and high yield.',
    price: 850,
    unit: 'per 50kg bag',
    imageUrl: null,
    category: 'Fertilizers & Nutrients',
    manufacturer: 'GreenChem Industries',
    inStock: true,
  },
  {
    id: 'prod-002',
    name: 'CropShield Fungicide',
    description: 'Broad-spectrum systemic fungicide for prevention and control of fungal diseases.',
    price: 1200,
    unit: 'per litre',
    imageUrl: null,
    category: 'Crop Protection',
    manufacturer: 'AgriCare Ltd.',
    inStock: true,
  },
  {
    id: 'prod-003',
    name: 'HybridMax Wheat Seeds',
    description: 'High-yielding wheat variety resistant to rust and lodging.',
    price: 2400,
    unit: 'per 10kg pack',
    imageUrl: null,
    category: 'Seeds',
    manufacturer: 'SeedTech Corp.',
    inStock: true,
  },
  {
    id: 'prod-004',
    name: 'BioGuard Neem Oil',
    description: 'Organic neem-based pest control solution. Safe for beneficial insects.',
    price: 450,
    unit: 'per litre',
    imageUrl: null,
    category: 'Crop Protection',
    manufacturer: 'NatureFarm',
    inStock: true,
  },
  {
    id: 'prod-005',
    name: 'PremiumFeed Cattle Pellets',
    description: 'High-protein pelleted feed for dairy cattle. Enhances milk production.',
    price: 1100,
    unit: 'per 50kg bag',
    imageUrl: null,
    category: 'Livestock',
    manufacturer: 'LivestockNutra',
    inStock: false,
  },
  {
    id: 'prod-006',
    name: 'DrippTech Irrigation Kit',
    description: 'Complete drip irrigation kit for 1-acre farm. Water-saving technology.',
    price: 8500,
    unit: 'per kit',
    imageUrl: null,
    category: 'Farm Equipment',
    manufacturer: 'AquaFarm Solutions',
    inStock: true,
  },
];

// ============================================
// Mock Offers / Combos
// ============================================

export interface MockOffer {
  id: string;
  title: string;
  description: string;
  discountPercent: number;
  validUntil: string;
  applicableProducts: string[];
}

export const MOCK_OFFERS: MockOffer[] = [
  {
    id: 'offer-001',
    title: 'Kharif Season Bundle',
    description: 'Get 15% off on all crop protection products for the Kharif season.',
    discountPercent: 15,
    validUntil: '2026-06-30',
    applicableProducts: ['prod-002', 'prod-004'],
  },
  {
    id: 'offer-002',
    title: 'Seed + Fertilizer Combo',
    description: 'Buy seeds and fertilizer together and save 10%.',
    discountPercent: 10,
    validUntil: '2026-04-30',
    applicableProducts: ['prod-001', 'prod-003'],
  },
  {
    id: 'offer-003',
    title: 'New Farmer Welcome Discount',
    description: 'First-time buyers get 20% off on their first order.',
    discountPercent: 20,
    validUntil: '2026-12-31',
    applicableProducts: [],
  },
];
