/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string | null;
  photoURL: string | null;
  role: 'customer' | 'admin' | 'restaurant';
}

export interface Restaurant {
  id: string;
  name: string;
  description: string;
  image: string;
  rating: number;
  category: string;
  ownerEmail: string;
  pinnedOrder?: number; // 0 for not pinned, 1, 2, 3... for pinned order
}

export interface MenuItem {
  id: string;
  restaurantId: string;
  name: string;
  description: string;
  price: number;
  image: string;
  category: string;
}

export interface CartItem extends MenuItem {
  quantity: number;
}

export interface Order {
  id: string;
  userId: string;
  userName: string;
  userEmail: string;
  restaurantId: string;
  restaurantName: string;
  items: CartItem[];
  totalAmount: number;
  commissionAmount: number; // Sansneat share (10%)
  restaurantEarnings: number; // Restaurant share (90%)
  status: 'pending' | 'preparing' | 'out-for-delivery' | 'delivered';
  paymentStatus: 'paid' | 'unpaid';
  createdAt: any;
}

export type AppView = 'home' | 'restaurant' | 'cart' | 'orders' | 'profile' | 'admin' | 'search';
