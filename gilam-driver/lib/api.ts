import * as SecureStore from 'expo-secure-store';

const API_BASE = 'https://gilam-api.ecos.uz/api';

// ─── Token Management ────────────────────────────────────────────────────────

export async function getToken(): Promise<string | null> {
  return SecureStore.getItemAsync('token');
}

export async function setToken(token: string) {
  await SecureStore.setItemAsync('token', token);
}

export async function removeToken() {
  await SecureStore.deleteItemAsync('token');
  await SecureStore.deleteItemAsync('user');
}

export async function getUser(): Promise<User | null> {
  const raw = await SecureStore.getItemAsync('user');
  return raw ? JSON.parse(raw) : null;
}

export async function setUser(user: User) {
  await SecureStore.setItemAsync('user', JSON.stringify(user));
}

// ─── Types ───────────────────────────────────────────────────────────────────

export interface User {
  id: string;
  fullName: string;
  phone: string;
  role: string;
  appRole?: string;
  companyId: string;
  company?: { id: string; name: string };
}

export type OrderStatus =
  | 'NEW'
  | 'DRIVER_ASSIGNED'
  | 'PICKED_UP'
  | 'AT_FACILITY'
  | 'WASHING'
  | 'DRYING'
  | 'READY_FOR_DELIVERY'
  | 'OUT_FOR_DELIVERY'
  | 'DELIVERED'
  | 'CANCELLED';

export interface Customer {
  id: string;
  fullName: string;
  phone1: string;
  phone2?: string;
  address?: string;
  location?: { lat: number; lng: number };
}

export interface OrderItem {
  id: string;
  service?: { name: string; measurementUnit: string };
  quantity: number;
  width?: number;
  length?: number;
  totalPrice: number;
  barcode?: string;
}

export interface Order {
  id: string;
  status: OrderStatus;
  customer?: Customer;
  items?: OrderItem[];
  totalAmount: number;
  paidAmount?: number;
  paymentStatus?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

// ─── API Request ─────────────────────────────────────────────────────────────

export async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = await getToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...((options.headers as Record<string, string>) || {}),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(`${API_BASE}${path}`, { ...options, headers });

  if (res.status === 401) {
    if (path === '/auth/login') {
      throw new Error("Telefon raqam yoki parol noto'g'ri!");
    }
    await removeToken();
    throw new Error('SESSION_EXPIRED');
  }

  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: 'Server xatoligi' }));
    throw new Error(Array.isArray(err.message) ? err.message.join(', ') : err.message);
  }

  if (res.status === 204) return null as T;
  const ct = res.headers.get('content-type');
  if (!ct || !ct.includes('application/json')) return null as T;
  return res.json();
}

export async function getCompanies(): Promise<{id: string, name: string}[]> {
  try {
    const res = await fetch(`${API_BASE}/public/companies`, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      }
    });
    if (!res.ok) throw new Error('Status not ok');
    return await res.json();
  } catch (err) {
    throw err;
  }
}

// ─── Auth API ────────────────────────────────────────────────────────────────

export async function login(phone: string, password: string, companyName: string): Promise<User> {
  const data = await request<{ access_token: string; user: User }>('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ phone, password }),
  });

  if (data.user.role !== 'DRIVER' && data.user.role !== 'WASHER' && data.user.role !== 'FINISHER') {
    throw new Error('Bu ilova faqat Haydovchi va Sex xodimlari uchun!');
  }

  // Kampaniya nomini tekshirish
  if (!data.user.company || !data.user.company.name.toLowerCase().includes(companyName.toLowerCase().trim())) {
    throw new Error(`Kiritilgan kampaniya nomi xato yoki bunday kampaniyada ishlamaysiz!`);
  }

  await setToken(data.access_token);
  await setUser(data.user);
  return data.user;
}

export async function logout() {
  await removeToken();
}

// ─── Orders API ──────────────────────────────────────────────────────────────

export async function getMyOrders(userId: string): Promise<Order[]> {
  return request<Order[]>(`/orders/driver/${userId}`);
}

export async function getFacilityOrders(companyId: string): Promise<Order[]> {
  return request<Order[]>(`/orders/facility/${companyId}`);
}

export async function getOrderDetails(orderId: string): Promise<Order> {
  return request<Order>(`/orders/${orderId}`);
}

export async function updateOrderStatus(orderId: string, status: string, notes?: string, deadlineDate?: string): Promise<Order> {
  const body: any = { status };
  if (notes) body.notes = notes;
  if (deadlineDate) body.deadlineDate = deadlineDate;
  
  return request<Order>(`/orders/${orderId}/status`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  });
}

export async function getDriverCompletedOrders(driverId: string): Promise<Order[]> {
  return request<Order[]>(`/orders/driver/${driverId}/history`);
}

export async function getFacilityCompletedOrders(companyId: string): Promise<Order[]> {
  return request<Order[]>(`/orders/facility/${companyId}/history`);
}

// ─── Status Helpers ──────────────────────────────────────────────────────────

export const STATUS_CONFIG: Record<string, {
  label: string;
  emoji: string;
  color: string;
  bg: string;
  next?: string;
  nextLabel?: string;
}> = {
  DRIVER_ASSIGNED: {
    label: 'Tayinlangan',
    emoji: '📌',
    color: '#d97706',
    bg: '#fef3c7',
    next: 'PICKED_UP',
    nextLabel: '🏠 Olib ketdim',
  },
  PICKED_UP: {
    label: 'Olib ketilgan',
    emoji: '📦',
    color: '#2563eb',
    bg: '#dbeafe',
    next: 'AT_FACILITY',
    nextLabel: '🏭 Sexga olib keldim',
  },
  AT_FACILITY: {
    label: 'Sexda',
    emoji: '🏭',
    color: '#7c3aed',
    bg: '#ede9fe',
    next: 'WASHING',
    nextLabel: '🧼 Yuvishga o\'tkazish',
  },
  WASHING: {
    label: 'Yuvilmoqda',
    emoji: '🧼',
    color: '#0891b2',
    bg: '#cffafe',
    next: 'DRYING',
    nextLabel: '☀️ Quritishga o\'tkazish',
  },
  DRYING: {
    label: 'Quritilmoqda',
    emoji: '☀️',
    color: '#0284c7',
    bg: '#e0f2fe',
    next: 'READY_FOR_DELIVERY',
    nextLabel: '📦 Qadoqlab topshirish',
  },
  READY_FOR_DELIVERY: {
    label: 'Yetkazishga tayyor',
    emoji: '✅',
    color: '#059669',
    bg: '#d1fae5',
    next: 'OUT_FOR_DELIVERY',
    nextLabel: '🚐 Yetkazishga chiqdim',
  },
  OUT_FOR_DELIVERY: {
    label: 'Yetkazilmoqda',
    emoji: '🚐',
    color: '#16a34a',
    bg: '#dcfce7',
    next: 'DELIVERED',
    nextLabel: '✅ Topshirdim',
  },
  DELIVERED: {
    label: 'Yetkazildi',
    emoji: '✅',
    color: '#15803d',
    bg: '#bbf7d0',
  },
  CANCELLED: {
    label: 'Bekor',
    emoji: '❌',
    color: '#dc2626',
    bg: '#fee2e2',
  },
};
