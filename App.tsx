/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import * as React from 'react';
import { useState, useEffect, useRef, Component } from 'react';
import { 
  Layout, Box, ShoppingCart, User, Home, Search, Clock, Star, ChevronRight, 
  MapPin, Plus, Minus, Trash2, CheckCircle2, Package, Truck, UtensilsCrossed,
  ArrowLeft, LogOut, LogIn, Sparkles, Menu as MenuIcon, X, Smartphone, Globe, Check, History, Settings, AlertCircle
} from 'lucide-react';
import { 
  auth, db, signOut, onAuthStateChanged, signInWithCustomToken, signInWithEmailAndPassword, createUserWithEmailAndPassword,
  collection, doc, setDoc, getDoc, getDocs, query, where, onSnapshot, addDoc, serverTimestamp, updateDoc 
} from './firebase';
import { UserProfile, Restaurant, MenuItem, CartItem, Order, AppView, OperationType, FirestoreErrorInfo } from './types';
import { LoginWithSanscounts } from './components/LoginWithSanscounts';
import { loadStripe } from '@stripe/stripe-js';
import { Elements } from '@stripe/react-stripe-js';
import { StripePaymentForm } from './components/StripePaymentForm';

// Initialize Stripe
const stripePromise = loadStripe((import.meta as any).env.VITE_STRIPE_PUBLISHABLE_KEY || 'pk_test_placeholder');

// --- Error Handling ---

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData.map(provider => ({
        providerId: provider.providerId,
        displayName: provider.displayName,
        email: provider.email,
        photoUrl: provider.photoURL
      })) || []
    },
    operationType,
    path
  }
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

interface ErrorBoundaryProps {
  children: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: any;
}

export class ErrorBoundary extends (Component as any) {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: any) {
    return { hasError: true, error };
  }

  componentDidCatch(error: any, errorInfo: any) {
    console.error("ErrorBoundary caught an error", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      let errorMessage = "Something went wrong.";
      try {
        const parsed = JSON.parse(this.state.error.message);
        if (parsed.error && parsed.operationType) {
          errorMessage = `Firestore Error: ${parsed.operationType} on ${parsed.path || 'unknown path'} failed. ${parsed.error}`;
        }
      } catch (e) {
        errorMessage = this.state.error.message || errorMessage;
      }

      return (
        <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-6">
          <div className="max-w-md w-full bg-zinc-900 border border-zinc-800 rounded-3xl p-8 text-center space-y-6">
            <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mx-auto">
              <AlertCircle className="text-red-500" size={32} />
            </div>
            <h2 className="text-2xl font-bold tracking-tight">Application Error</h2>
            <p className="text-zinc-400 text-sm leading-relaxed">
              {errorMessage}
            </p>
            <button 
              onClick={() => window.location.reload()}
              className="w-full py-3 bg-white text-black font-bold rounded-xl hover:bg-zinc-200 transition-colors"
            >
              Reload Application
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

// --- Intro Animation Component ---

const IntroSequence = ({ onComplete }: { onComplete: () => void }) => {
  const [phase, setPhase] = useState<'enter' | 'wait' | 'cook' | 'admire' | 'exit' | 'logo' | 'explode'>('enter');

  useEffect(() => {
    const schedule = [
      { t: 100, fn: () => setPhase('enter') },
      { t: 800, fn: () => setPhase('wait') },
      { t: 1200, fn: () => setPhase('cook') },
      { t: 2000, fn: () => setPhase('admire') },
      { t: 2500, fn: () => setPhase('exit') },
      { t: 3000, fn: () => setPhase('logo') },
      { t: 4000, fn: () => setPhase('explode') },
      { t: 4500, fn: () => onComplete() }
    ];

    const timers = schedule.map(s => setTimeout(s.fn, s.t));
    return () => timers.forEach(clearTimeout);
  }, [onComplete]);

  return (
    <div className={`fixed inset-0 z-[100] bg-black flex items-center justify-center overflow-hidden font-sans select-none
      ${phase === 'explode' ? 'animate-[fadeOut_1s_ease-out_forwards] pointer-events-none' : ''}
    `}>
      <div className={`absolute inset-0 bg-white pointer-events-none z-50 transition-opacity duration-300 ease-out ${phase === 'explode' ? 'opacity-100' : 'opacity-0'}`}></div>
      <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[size:60px_60px] [mask-image:radial-gradient(ellipse_at_center,black_30%,transparent_80%)]"></div>

      <div className="relative w-full max-w-4xl h-96 flex items-center justify-center scale-[0.6] md:scale-100">
        {(phase !== 'logo' && phase !== 'explode') && (
          <div className={`relative z-10 flex flex-col items-center transition-transform will-change-transform
             ${phase === 'enter' ? 'animate-[hopIn_1.6s_cubic-bezier(0.34,1.56,0.64,1)_forwards]' : ''}
             ${phase === 'exit' ? 'animate-[anticipateSprint_0.8s_ease-in_forwards]' : ''}
          `}>
             <div className={`w-32 h-36 bg-zinc-100 rounded-xl relative overflow-hidden shadow-2xl transition-all duration-300 border-4
                ${phase === 'cook' || phase === 'admire' || phase === 'exit' 
                  ? 'border-red-500 shadow-[0_0_40px_rgba(249,115,22,0.5)]' 
                  : 'border-zinc-300'}
             `}>
                <div className="absolute top-6 left-1/2 -translate-x-1/2 w-20 h-10 bg-zinc-800 rounded-md flex items-center justify-center gap-4 overflow-hidden border border-zinc-700 shadow-inner z-20">
                   <div className={`w-2 h-2 bg-red-400 rounded-full transition-all duration-300 ${phase === 'cook' ? 'scale-y-10 bg-yellow-400' : 'animate-pulse'}`}></div>
                   <div className={`w-2 h-2 bg-red-400 rounded-full transition-all duration-300 ${phase === 'cook' ? 'scale-y-10 bg-yellow-400' : 'animate-pulse'}`}></div>
                </div>
                <div className={`absolute inset-0 bg-gradient-to-br from-red-600 via-red-600 to-yellow-500 transition-opacity duration-500 ${phase === 'cook' || phase === 'admire' || phase === 'exit' ? 'opacity-100' : 'opacity-0'}`}></div>
                <div className={`absolute bottom-6 left-1/2 -translate-x-1/2 transition-all duration-500 transform z-20
                   ${phase === 'cook' || phase === 'admire' || phase === 'exit' ? 'opacity-100 scale-100 translate-y-0' : 'opacity-0 scale-50 translate-y-4'}
                `}>
                   <div className="w-10 h-10 bg-white text-red-600 rounded flex items-center justify-center shadow-lg">
                      <UtensilsCrossed size={24} strokeWidth={3} />
                   </div>
                </div>
             </div>
             <div className="flex gap-10 -mt-1 z-0">
                <div className={`w-3 h-8 bg-zinc-800 rounded-b-full origin-top ${phase === 'enter' ? 'animate-[legMove_0.2s_infinite_alternate]' : ''} ${phase === 'exit' ? 'animate-[legMove_0.1s_infinite_alternate]' : ''}`}></div>
                <div className={`w-3 h-8 bg-zinc-800 rounded-b-full origin-top ${phase === 'enter' ? 'animate-[legMove_0.2s_infinite_alternate-reverse]' : ''} ${phase === 'exit' ? 'animate-[legMove_0.1s_infinite_alternate-reverse]' : ''}`}></div>
             </div>
          </div>
        )}

        {(phase === 'logo' || phase === 'explode') && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-8">
             <div className={`relative w-32 h-32 animate-[spinAppear_1.5s_cubic-bezier(0.34,1.56,0.64,1)_forwards]`}>
                <UtensilsCrossed size={128} className="text-red-500 drop-shadow-[0_0_50px_rgba(249,115,22,0.5)]" />
             </div>
             <div className="text-center animate-[popIn_0.8s_cubic-bezier(0.17,0.67,0.83,0.67)_0.5s_forwards] opacity-0">
                <h1 className="text-6xl font-black text-white tracking-tighter mb-2">SANSNEAT</h1>
                <p className="text-sm text-red-400 font-mono tracking-[0.3em] uppercase">Premium Food Delivery</p>
             </div>
          </div>
        )}

        <button 
          onClick={onComplete}
          className="absolute bottom-12 right-12 text-zinc-500 hover:text-white font-bold tracking-widest text-xs flex items-center gap-2 transition-colors z-[110]"
        >
          SKIP INTRO <ChevronRight size={14} />
        </button>
      </div>
    </div>
  );
};

// --- Main App Component ---

export default function App() {
  const [showIntro, setShowIntro] = useState(true);
  const [user, setUser] = useState<UserProfile | null>(() => {
    const saved = localStorage.getItem('sansneat_user');
    return saved ? JSON.parse(saved) : null;
  });

  useEffect(() => {
    if (user) {
      localStorage.setItem('sansneat_user', JSON.stringify(user));
    } else {
      localStorage.removeItem('sansneat_user');
    }
  }, [user]);
  const [view, setView] = useState<AppView>('home');
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [selectedRestaurant, setSelectedRestaurant] = useState<Restaurant | null>(null);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(false);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentStep, setPaymentStep] = useState<'details' | 'processing' | 'success'>('details');
  const [orderStatusFilter, setOrderStatusFilter] = useState<string>('all');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [editName, setEditName] = useState('');
  const [editPhoto, setEditPhoto] = useState('');
  const [showAddRestaurantModal, setShowAddRestaurantModal] = useState(false);
  const [editingRestaurant, setEditingRestaurant] = useState<Restaurant | null>(null);
  const [newRestaurant, setNewRestaurant] = useState({ name: '', description: '', category: '', image: '', ownerEmail: '' });
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [minRating, setMinRating] = useState<number>(0);
  const [showAddMenuModal, setShowAddMenuModal] = useState(false);
  const [newMenuItem, setNewMenuItem] = useState({ name: '', description: '', price: 0, image: '', category: 'Main' });
  const [menuRestaurantId, setMenuRestaurantId] = useState<string | null>(null);

  // Derived unique categories
  const categories = ['All', ...Array.from(new Set(restaurants.map(r => r.category)))];

  // Admin Emails
  const ADMIN_EMAILS = ['sloudsan@gmail.com', 'sansneat@sanscounts.com'];

  // Sync Firebase Auth state
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      console.log("Firebase Auth state changed:", firebaseUser?.email);
      if (firebaseUser) {
        // If firebase user exists, ensure our user state is consistent
        const email = firebaseUser.email || '';
        const isAdmin = ADMIN_EMAILS.includes(email);
        setUser(prev => {
          if (prev && prev.uid === firebaseUser.uid) return prev;
          return {
            uid: firebaseUser.uid,
            email: email,
            displayName: firebaseUser.displayName || 'Sanscounts User',
            photoURL: firebaseUser.photoURL || '',
            role: isAdmin ? 'admin' : 'customer'
          };
        });
      } else {
        // If no firebase user, we might still have a local user from localStorage
        // but they won't be able to perform authenticated actions.
        // For now, we'll keep the local user if it exists, but ideally we'd sign out.
      }
    });
    return () => unsubscribe();
  }, []);

  // Real-time Restaurants Listener
  useEffect(() => {
    const path = 'restaurants';
    const unsubscribe = onSnapshot(collection(db, path), (snapshot) => {
      console.log("Restaurants snapshot received, count:", snapshot.docs.length);
      const restaurantList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Restaurant));
      console.log("Restaurant list:", restaurantList);
      // Sort by pinnedOrder (pinned first, then by name)
      const sorted = restaurantList.sort((a, b) => {
        const pinA = a.pinnedOrder || 0;
        const pinB = b.pinnedOrder || 0;
        if (pinA > 0 && pinB > 0) return pinA - pinB;
        if (pinA > 0) return -1;
        if (pinB > 0) return 1;
        return a.name.localeCompare(b.name);
      });
      setRestaurants(sorted);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, path);
    });
    
    return () => unsubscribe();
  }, []);

  // Fetch Menu Items when restaurant selected
  useEffect(() => {
    if (selectedRestaurant) {
      const fetchMenu = async () => {
        const menuPath = `restaurants/${selectedRestaurant.id}/menu`;
        try {
          const querySnapshot = await getDocs(collection(db, menuPath));
          const menuList = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as MenuItem));
          
          if (menuList.length === 0) {
            const seedMenu: MenuItem[] = [
              { id: 'm1', restaurantId: selectedRestaurant.id, name: 'Classic Burger', description: 'Beef patty, lettuce, tomato, cheese', price: 12.99, image: 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=400', category: 'Main' },
              { id: 'm2', restaurantId: selectedRestaurant.id, name: 'Truffle Fries', description: 'Crispy fries with truffle oil', price: 6.99, image: 'https://images.unsplash.com/photo-1573080496219-bb080dd4f877?w=400', category: 'Sides' },
              { id: 'm3', restaurantId: selectedRestaurant.id, name: 'Milkshake', description: 'Vanilla, Chocolate or Strawberry', price: 5.99, image: 'https://images.unsplash.com/photo-1572490122747-3968b75cc699?w=400', category: 'Drinks' },
            ];
            for (const m of seedMenu) {
              await setDoc(doc(db, menuPath, m.id), m);
            }
            setMenuItems(seedMenu);
          } else {
            setMenuItems(menuList);
          }
        } catch (error) {
          handleFirestoreError(error, OperationType.LIST, menuPath);
        }
      };
      fetchMenu();
    }
  }, [selectedRestaurant]);

  // Real-time Orders Listener
  useEffect(() => {
    if (user) {
      const path = 'orders';
      const q = user.role === 'admin' 
        ? query(collection(db, path))
        : query(collection(db, path), where('userId', '==', user.uid));
      
      const unsubscribe = onSnapshot(q, (snapshot) => {
        const orderList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Order));
        setOrders(orderList.sort((a, b) => {
          const timeA = a.createdAt?.toMillis?.() || (a.createdAt?.seconds ? a.createdAt.seconds * 1000 : 0);
          const timeB = b.createdAt?.toMillis?.() || (b.createdAt?.seconds ? b.createdAt.seconds * 1000 : 0);
          return timeB - timeA;
        }));
      }, (error) => {
        handleFirestoreError(error, OperationType.LIST, path);
      });
      return () => unsubscribe();
    }
  }, [user]);

  const handleLogout = async () => {
    await signOut(auth);
    setView('home');
  };

  const addToCart = (item: MenuItem) => {
    setCart(prev => {
      const existing = prev.find(i => i.id === item.id);
      if (existing) {
        return prev.map(i => i.id === item.id ? { ...i, quantity: i.quantity + 1 } : i);
      }
      return [...prev, { ...item, quantity: 1 }];
    });
  };

  const removeFromCart = (itemId: string) => {
    setCart(prev => prev.filter(i => i.id !== itemId));
  };

  const updateQuantity = (itemId: string, delta: number) => {
    setCart(prev => prev.map(i => {
      if (i.id === itemId) {
        const newQty = Math.max(1, i.quantity + delta);
        return { ...i, quantity: newQty };
      }
      return i;
    }));
  };

  const placeOrder = async () => {
    if (!user || cart.length === 0) return;
    setLoading(true);
    try {
      const total = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
      const commission = total * 0.10; // 10% commission
      const earnings = total - commission; // 90% to restaurant

      const newOrder = {
        userId: user.uid,
        userName: user.displayName || 'Anonymous',
        userEmail: user.email,
        restaurantId: cart[0].restaurantId,
        restaurantName: selectedRestaurant?.name || 'Restaurant',
        items: cart,
        totalAmount: total,
        commissionAmount: commission,
        restaurantEarnings: earnings,
        status: 'pending',
        paymentStatus: 'paid',
        createdAt: serverTimestamp()
      };
        const orderPath = 'orders';
        try {
          await addDoc(collection(db, orderPath), newOrder);
        } catch (error) {
          handleFirestoreError(error, OperationType.CREATE, orderPath);
        }
        setCart([]);
      setShowPaymentModal(false);
      setView('orders');
    } catch (error) {
      console.error("Order failed", error);
    } finally {
      setLoading(false);
    }
  };

  const startPayment = () => {
    if (!user) {
      setShowLoginModal(true);
      return;
    }
    setPaymentStep('details');
    setShowPaymentModal(true);
  };

  const handleUpdateProfile = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const updatedUser = {
        ...user,
        displayName: editName,
        photoURL: editPhoto
      };
      const userPath = `users/${user.uid}`;
      try {
        await setDoc(doc(db, userPath), updatedUser);
      } catch (error) {
        handleFirestoreError(error, OperationType.WRITE, userPath);
      }
      setUser(updatedUser);
      setIsEditingProfile(false);
    } catch (error) {
      console.error("Error updating profile:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddRestaurant = async () => {
    if (!user || user.role !== 'admin') return;
    if (!newRestaurant.ownerEmail) {
      alert("Please provide an owner email");
      return;
    }
    setLoading(true);
    try {
      const id = 'r' + Date.now();
      const restaurantData = {
        ...newRestaurant,
        id,
        rating: 5.0
      };
      const restaurantPath = `restaurants/${id}`;
      console.log("Adding restaurant to path:", restaurantPath, restaurantData);
      try {
        await setDoc(doc(db, restaurantPath), restaurantData);
        console.log("Restaurant added successfully to Firestore");
        
        // Update user role if they exist
        const usersPath = 'users';
        const q = query(collection(db, usersPath), where('email', '==', newRestaurant.ownerEmail));
        const querySnapshot = await getDocs(q);
        if (!querySnapshot.empty) {
          const userDoc = querySnapshot.docs[0];
          const userDocPath = `users/${userDoc.id}`;
          await updateDoc(doc(db, userDocPath), {
            role: 'restaurant'
          });
        }
      } catch (error) {
        handleFirestoreError(error, OperationType.WRITE, restaurantPath);
      }

      setShowAddRestaurantModal(false);
      setNewRestaurant({ name: '', description: '', category: '', image: '', ownerEmail: '' });
    } catch (error) {
      console.error("Error adding restaurant:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateRestaurant = async () => {
    if (!editingRestaurant || !user) return;
    // Allow if admin OR if restaurant owner
    const isOwner = user.role === 'restaurant' && editingRestaurant.ownerEmail === user.email;
    if (!ADMIN_EMAILS.includes(user.email) && !isOwner) return;
    
    setLoading(true);
    const restaurantPath = `restaurants/${editingRestaurant.id}`;
    try {
      await updateDoc(doc(db, restaurantPath), {
        name: editingRestaurant.name,
        description: editingRestaurant.description,
        category: editingRestaurant.category,
        image: editingRestaurant.image,
        ownerEmail: editingRestaurant.ownerEmail
      });
      setEditingRestaurant(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, restaurantPath);
    } finally {
      setLoading(false);
    }
  };

  const handlePinRestaurant = async (restaurantId: string) => {
    const path = `restaurants/${restaurantId}`;
    try {
      // Find max pinnedOrder
      const maxPinned = Math.max(0, ...restaurants.map(r => r.pinnedOrder || 0));
      await updateDoc(doc(db, path), {
        pinnedOrder: maxPinned + 1
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, path);
    }
  };

  const handleUnpinRestaurant = async (restaurantId: string) => {
    const path = `restaurants/${restaurantId}`;
    try {
      await updateDoc(doc(db, path), {
        pinnedOrder: 0
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, path);
    }
  };

  const handleAddMenuItem = async () => {
    if (!menuRestaurantId || !newMenuItem.name) return;
    setLoading(true);
    const menuPath = `restaurants/${menuRestaurantId}/menu`;
    try {
      const id = Math.random().toString(36).substr(2, 9);
      const itemPath = `${menuPath}/${id}`;
      await setDoc(doc(db, menuPath, id), {
        ...newMenuItem,
        id,
        restaurantId: menuRestaurantId
      });
      setShowAddMenuModal(false);
      setNewMenuItem({ name: '', description: '', price: 0, image: '', category: 'Main' });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, menuPath);
    } finally {
      setLoading(false);
    }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>, type: 'restaurant' | 'menu' | 'edit-restaurant') => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64String = reader.result as string;
        if (type === 'restaurant') {
          setNewRestaurant(prev => ({ ...prev, image: base64String }));
        } else if (type === 'edit-restaurant') {
          if (editingRestaurant) {
            setEditingRestaurant({ ...editingRestaurant, image: base64String });
          }
        } else {
          setNewMenuItem(prev => ({ ...prev, image: base64String }));
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleIntroComplete = React.useCallback(() => {
    console.log("App: Intro complete");
    setShowIntro(false);
  }, []);

  // Fallback for intro sequence
  useEffect(() => {
    if (showIntro) {
      const timer = setTimeout(() => {
        console.warn("App: Intro fallback triggered after 6s");
        setShowIntro(false);
      }, 6000);
      return () => clearTimeout(timer);
    }
  }, [showIntro]);

  if (showIntro) return <IntroSequence onComplete={handleIntroComplete} />;

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 font-sans">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-zinc-950/80 backdrop-blur-xl border-b border-zinc-900 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2 cursor-pointer" onClick={() => setView('home')}>
          <UtensilsCrossed className="text-red-500" size={28} />
          <span className="text-xl font-black tracking-tighter">SANSNEAT</span>
        </div>

        {/* Search Bar */}
        <div className="hidden md:flex flex-1 max-w-md mx-8">
          <div className="relative w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" size={18} />
            <input 
              type="text" 
              placeholder="Search for restaurants or cuisines..." 
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                if (view !== 'home' && view !== 'search') setView('search');
              }}
              onFocus={() => {
                if (view !== 'home' && view !== 'search') setView('search');
              }}
              className="w-full bg-zinc-900 border border-zinc-900 rounded-full py-2 pl-10 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-red-500 transition-all"
            />
          </div>
        </div>
        
        <div className="flex items-center gap-6">
          {user?.role === 'admin' && (
            <button 
              onClick={() => setView('admin')}
              className="hidden md:flex items-center gap-2 text-red-500 bg-red-500/10 px-4 py-2 rounded-full font-bold text-sm hover:bg-red-500/20 transition-all"
            >
              <Sparkles size={16} /> Admin Panel
            </button>
          )}
          <div className="hidden md:flex items-center gap-2 text-zinc-400 text-sm">
            <MapPin size={16} />
            <span>Dhaka, Bangladesh</span>
          </div>
          
          {user ? (
            <div className="flex items-center gap-4">
              <button 
                onClick={() => setView('cart')}
                className="relative p-2 hover:bg-zinc-900 rounded-full transition-colors"
              >
                <ShoppingCart size={24} />
                {cart.length > 0 && (
                  <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] font-bold w-5 h-5 flex items-center justify-center rounded-full border-2 border-zinc-950">
                    {cart.reduce((a, b) => a + b.quantity, 0)}
                  </span>
                )}
              </button>
              <button 
                onClick={() => setView('profile')}
                className="w-10 h-10 rounded-full overflow-hidden border-2 border-zinc-800 hover:border-red-500 transition-colors"
              >
                <img 
                  src={user.photoURL || `https://ui-avatars.com/api/?name=${user.displayName}`} 
                  alt="Profile" 
                  referrerPolicy="no-referrer"
                />
              </button>
            </div>
          ) : (
            <button 
              onClick={() => setShowLoginModal(true)}
              className="flex items-center gap-2 bg-[#BC002D] hover:bg-[#990024] text-white px-5 py-2 rounded-full font-bold transition-all"
            >
              <LogIn size={18} />
              <span>Login</span>
            </button>
          )}
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto p-6 pb-24">
        {view === 'home' && (
          <div className="space-y-8 animate-fade-in">
            <div className="relative h-64 md:h-96 rounded-3xl overflow-hidden group">
              <img 
                src={restaurants.length > 0 ? restaurants[0].image : "https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=1600"} 
                className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" 
                alt="Hero" 
                referrerPolicy="no-referrer"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent flex flex-col justify-end p-8 md:p-12">
                <h2 className="text-4xl md:text-6xl font-black tracking-tighter mb-4">
                  {restaurants.length > 0 ? `Try ${restaurants[0].name}` : "Hungry? We've got you."}
                </h2>
                <p className="text-zinc-300 text-lg max-w-xl mb-6">
                  {restaurants.length > 0 ? restaurants[0].description : "Experience the finest dining from the comfort of your home. Real-time tracking, premium service."}
                </p>
                <div className="flex gap-4">
                  <button 
                    onClick={() => {
                      if (restaurants.length > 0) {
                        setSelectedRestaurant(restaurants[0]);
                        setView('restaurant');
                      } else {
                        const el = document.getElementById('restaurants-list');
                        el?.scrollIntoView({ behavior: 'smooth' });
                      }
                    }}
                    className="bg-[#BC002D] hover:bg-[#990024] text-white px-8 py-3 rounded-full font-bold transition-all flex items-center gap-2"
                  >
                    {restaurants.length > 0 ? 'View Featured' : 'Order Now'} <ChevronRight size={20} />
                  </button>
                </div>
              </div>
            </div>

            <section id="restaurants-list">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
                <h3 className="text-2xl font-bold flex items-center gap-2">
                  <Sparkles className="text-red-500" /> Popular Restaurants
                </h3>
                <div className="flex flex-wrap items-center gap-3">
                  <select 
                    value={selectedCategory}
                    onChange={(e) => setSelectedCategory(e.target.value)}
                    className="bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
                  >
                    {categories.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                  <select 
                    value={minRating}
                    onChange={(e) => setMinRating(Number(e.target.value))}
                    className="bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
                  >
                    <option value={0}>Any Rating</option>
                    <option value={4}>4.0+ Stars</option>
                    <option value={4.5}>4.5+ Stars</option>
                    <option value={4.8}>4.8+ Stars</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                {restaurants
                  .filter(res => 
                    (res.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                    res.category.toLowerCase().includes(searchQuery.toLowerCase())) &&
                    (selectedCategory === 'All' || res.category === selectedCategory) &&
                    (res.rating >= minRating)
                  )
                  .map(res => (
                  <div 
                    key={res.id}
                    onClick={() => { setSelectedRestaurant(res); setView('restaurant'); }}
                    className="bg-zinc-900/50 rounded-2xl overflow-hidden border border-zinc-900 hover:border-red-500/50 transition-all cursor-pointer group"
                  >
                    <div className="h-48 overflow-hidden">
                      <img 
                        src={res.image} 
                        className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" 
                        alt={res.name} 
                        referrerPolicy="no-referrer"
                      />
                    </div>
                    <div className="p-5">
                      <div className="flex justify-between items-start mb-2">
                        <h4 className="text-xl font-bold">{res.name}</h4>
                        <div className="flex items-center gap-1 bg-red-500/10 text-red-500 px-2 py-1 rounded text-sm font-bold">
                          <Star size={14} fill="currentColor" /> {res.rating}
                        </div>
                      </div>
                      <p className="text-zinc-500 text-sm mb-4">{res.description}</p>
                      <div className="flex items-center gap-4 text-xs text-zinc-400">
                        <span className="bg-zinc-800 px-2 py-1 rounded">{res.category}</span>
                        <span className="flex items-center gap-1"><Clock size={12} /> 20-30 min</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          </div>
        )}

        {view === 'search' && (
          <div className="space-y-8 animate-fade-in">
            <h2 className="text-4xl font-black tracking-tighter">Search</h2>
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500" size={20} />
              <input 
                type="text" 
                placeholder="Search restaurants or cuisines..." 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-zinc-900 border border-zinc-800 rounded-2xl py-4 pl-12 pr-4 text-lg focus:outline-none focus:ring-2 focus:ring-red-500 transition-all"
                autoFocus
              />
            </div>

            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
              <div className="flex flex-wrap items-center gap-3">
                <select 
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  className="bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
                >
                  {categories.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
                <select 
                  value={minRating}
                  onChange={(e) => setMinRating(Number(e.target.value))}
                  className="bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
                >
                  <option value={0}>Any Rating</option>
                  <option value={4}>4.0+ Stars</option>
                  <option value={4.5}>4.5+ Stars</option>
                  <option value={4.8}>4.8+ Stars</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {restaurants
                .filter(res => 
                  (res.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                  res.category.toLowerCase().includes(searchQuery.toLowerCase())) &&
                  (selectedCategory === 'All' || res.category === selectedCategory) &&
                  (res.rating >= minRating)
                )
                .map(res => (
                  <div 
                    key={res.id}
                    onClick={() => { setSelectedRestaurant(res); setView('restaurant'); }}
                    className="bg-zinc-900/50 rounded-2xl overflow-hidden border border-zinc-900 hover:border-red-500/50 transition-all cursor-pointer group"
                  >
                    <div className="h-48 overflow-hidden">
                      <img 
                        src={res.image} 
                        className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" 
                        alt={res.name} 
                        referrerPolicy="no-referrer"
                      />
                    </div>
                    <div className="p-5">
                      <div className="flex justify-between items-start mb-2">
                        <h4 className="text-xl font-bold">{res.name}</h4>
                        <div className="flex items-center gap-1 bg-red-500/10 text-red-500 px-2 py-1 rounded text-sm font-bold">
                          <Star size={14} fill="currentColor" /> {res.rating}
                        </div>
                      </div>
                      <p className="text-zinc-500 text-sm mb-4">{res.description}</p>
                      <div className="flex items-center gap-4 text-xs text-zinc-400">
                        <span className="bg-zinc-800 px-2 py-1 rounded">{res.category}</span>
                        <span className="flex items-center gap-1"><Clock size={12} /> 20-30 min</span>
                      </div>
                    </div>
                  </div>
                ))}
            </div>
          </div>
        )}

        {view === 'restaurant' && selectedRestaurant && (
          <div className="animate-fade-in">
            <button 
              onClick={() => setView('home')}
              className="flex items-center gap-2 text-zinc-400 hover:text-white mb-8 transition-colors"
            >
              <ArrowLeft size={20} /> Back to Restaurants
            </button>

            <div className="flex flex-col md:flex-row gap-12">
              <div className="flex-1 space-y-8">
                <div className="flex items-end gap-6">
                  <img 
                    src={selectedRestaurant.image} 
                    className="w-32 h-32 rounded-2xl object-cover shadow-2xl" 
                    alt={selectedRestaurant.name} 
                    referrerPolicy="no-referrer"
                  />
                  <div>
                    <h2 className="text-4xl font-black tracking-tighter">{selectedRestaurant.name}</h2>
                    <p className="text-zinc-400">{selectedRestaurant.description}</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-4">
                  {menuItems.map(item => (
                    <div key={item.id} className="bg-zinc-900/30 p-4 rounded-2xl border border-zinc-900 flex items-center justify-between group hover:bg-zinc-900/50 transition-all">
                      <div className="flex items-center gap-4">
                        <img 
                          src={item.image} 
                          className="w-20 h-20 rounded-xl object-cover" 
                          alt={item.name} 
                          referrerPolicy="no-referrer"
                        />
                        <div>
                          <h5 className="font-bold text-lg">{item.name}</h5>
                          <p className="text-zinc-500 text-sm">{item.description}</p>
                          <span className="text-red-500 font-bold mt-1 block">${item.price}</span>
                        </div>
                      </div>
                      <button 
                        onClick={() => addToCart(item)}
                        className="bg-zinc-800 hover:bg-red-500 text-white p-3 rounded-xl transition-all"
                      >
                        <Plus size={20} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Mini Cart Sidebar */}
              <div className="w-full md:w-80 space-y-6">
                <div className="bg-zinc-900/80 p-6 rounded-3xl border border-zinc-800 sticky top-24">
                  <h4 className="text-xl font-bold mb-6 flex items-center gap-2">
                    <ShoppingCart size={20} /> Your Cart
                  </h4>
                  {cart.length === 0 ? (
                    <div className="text-center py-12 text-zinc-600">
                      <Box size={40} className="mx-auto mb-4 opacity-20" />
                      <p>Your cart is empty</p>
                    </div>
                  ) : (
                    <>
                      <div className="space-y-4 mb-6 max-h-64 overflow-y-auto pr-2 scrollbar-hide">
                        {cart.map(item => (
                          <div key={item.id} className="flex items-center justify-between text-sm">
                            <div className="flex-1">
                              <p className="font-medium">{item.name}</p>
                              <p className="text-zinc-500">${(item.price * item.quantity).toFixed(2)}</p>
                            </div>
                            <div className="flex items-center gap-2 bg-zinc-800 rounded-lg p-1">
                              <button onClick={() => updateQuantity(item.id, -1)} className="p-1 hover:text-red-500"><Minus size={14} /></button>
                              <span className="w-4 text-center font-bold">{item.quantity}</span>
                              <button onClick={() => updateQuantity(item.id, 1)} className="p-1 hover:text-red-500"><Plus size={14} /></button>
                            </div>
                            <button onClick={() => removeFromCart(item.id)} className="p-1 text-zinc-600 hover:text-red-500 transition-colors ml-1">
                              <Trash2 size={14} />
                            </button>
                          </div>
                        ))}
                      </div>
                      <div className="border-t border-zinc-800 pt-4 space-y-2">
                        <div className="flex justify-between text-sm text-zinc-400">
                          <span>Subtotal</span>
                          <span>${cart.reduce((a, b) => a + (b.price || 0) * (b.quantity || 0), 0).toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between font-bold text-lg">
                          <span>Total</span>
                          <span className="text-red-500">${cart.reduce((a, b) => a + (b.price || 0) * (b.quantity || 0), 0).toFixed(2)}</span>
                        </div>
                        <button 
                          onClick={startPayment}
                          disabled={loading}
                          className="w-full bg-red-500 hover:bg-red-600 text-white py-4 rounded-2xl font-bold mt-4 transition-all disabled:opacity-50"
                        >
                          {loading ? 'Processing...' : 'Checkout'}
                        </button>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {view === 'cart' && (
          <div className="max-w-2xl mx-auto space-y-8 animate-fade-in">
            <h2 className="text-4xl font-black tracking-tighter">Your Cart</h2>
            <div className="bg-zinc-900/50 rounded-3xl border border-zinc-900 overflow-hidden">
              {cart.length === 0 ? (
                <div className="p-20 text-center space-y-4">
                  <ShoppingCart size={64} className="mx-auto text-zinc-800" />
                  <p className="text-zinc-500">Your cart is empty</p>
                  <button onClick={() => setView('home')} className="text-red-500 font-bold">Start Shopping</button>
                </div>
              ) : (
                <div className="p-8 space-y-6">
                  <div className="space-y-4">
                    {cart.map(item => (
                      <div key={item.id} className="flex items-center gap-4 bg-zinc-950/50 p-4 rounded-2xl border border-zinc-800">
                        <img 
                          src={item.image} 
                          className="w-20 h-20 rounded-xl object-cover" 
                          alt={item.name} 
                          referrerPolicy="no-referrer"
                        />
                        <div className="flex-1">
                          <h4 className="font-bold">{item.name}</h4>
                          <p className="text-zinc-500 text-sm">${(item.price || 0).toFixed(2)}</p>
                        </div>
                        <div className="flex items-center gap-3 bg-zinc-900 rounded-xl p-2">
                          <button onClick={() => updateQuantity(item.id, -1)} className="p-1 hover:text-red-500"><Minus size={18} /></button>
                          <span className="w-6 text-center font-bold">{item.quantity}</span>
                          <button onClick={() => updateQuantity(item.id, 1)} className="p-1 hover:text-red-500"><Plus size={18} /></button>
                        </div>
                        <button onClick={() => removeFromCart(item.id)} className="p-2 text-zinc-600 hover:text-red-500 transition-colors">
                          <Trash2 size={20} />
                        </button>
                      </div>
                    ))}
                  </div>
                  <div className="border-t border-zinc-800 pt-6 space-y-4">
                    <div className="flex justify-between text-xl font-black">
                      <span>Total Amount</span>
                      <span className="text-red-500">${cart.reduce((a, b) => a + (b.price || 0) * (b.quantity || 0), 0).toFixed(2)}</span>
                    </div>
                    <button 
                      onClick={startPayment}
                      className="w-full bg-red-500 hover:bg-red-600 text-white py-4 rounded-2xl font-bold transition-all"
                    >
                      Proceed to Checkout
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {view === 'orders' && (
          <div className="max-w-3xl mx-auto space-y-8 animate-fade-in">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <h2 className="text-4xl font-black tracking-tighter">Your Orders</h2>
              
              <div className="flex flex-wrap items-center gap-3">
                <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl px-3 py-2 flex items-center gap-2">
                  <Clock size={16} className="text-zinc-500" />
                  <select 
                    value={orderStatusFilter}
                    onChange={(e) => setOrderStatusFilter(e.target.value)}
                    className="bg-transparent text-xs font-bold border-none focus:ring-0 text-zinc-300"
                  >
                    <option value="all">All Status</option>
                    <option value="pending">Pending</option>
                    <option value="preparing">Preparing</option>
                    <option value="out-for-delivery">Out for Delivery</option>
                    <option value="delivered">Delivered</option>
                  </select>
                </div>

                <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl px-3 py-2 flex items-center gap-2">
                  <input 
                    type="date" 
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="bg-transparent text-xs font-bold border-none focus:ring-0 text-zinc-300"
                  />
                  <span className="text-zinc-600 text-xs">to</span>
                  <input 
                    type="date" 
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="bg-transparent text-xs font-bold border-none focus:ring-0 text-zinc-300"
                  />
                </div>

                {(orderStatusFilter !== 'all' || startDate || endDate) && (
                  <button 
                    onClick={() => {
                      setOrderStatusFilter('all');
                      setStartDate('');
                      setEndDate('');
                    }}
                    className="text-xs font-bold text-red-500 hover:text-red-400 transition-colors"
                  >
                    Clear
                  </button>
                )}
              </div>
            </div>

            {orders.length === 0 ? (
              <div className="text-center py-24 bg-zinc-900/20 rounded-3xl border border-dashed border-zinc-800">
                <History size={48} className="mx-auto mb-4 text-zinc-700" />
                <p className="text-zinc-500">No orders yet. Time to eat!</p>
                <button onClick={() => setView('home')} className="mt-6 text-red-500 font-bold">Browse Restaurants</button>
              </div>
            ) : (
              <div className="space-y-6">
                {orders
                  .filter(order => {
                    const matchesStatus = orderStatusFilter === 'all' || order.status === orderStatusFilter;
                    
                    let matchesDate = true;
                    if (startDate || endDate) {
                      const orderDate = order.createdAt?.toDate ? order.createdAt.toDate() : new Date();
                      const start = startDate ? new Date(startDate) : null;
                      const end = endDate ? new Date(endDate) : null;
                      
                      if (start) {
                        start.setHours(0, 0, 0, 0);
                        if (orderDate < start) matchesDate = false;
                      }
                      if (end) {
                        end.setHours(23, 59, 59, 999);
                        if (orderDate > end) matchesDate = false;
                      }
                    }
                    
                    return matchesStatus && matchesDate;
                  })
                  .map(order => (
                  <div key={order.id} className="bg-zinc-900/50 rounded-3xl border border-zinc-900 overflow-hidden">
                    <div className="p-6 flex items-center justify-between border-b border-zinc-800">
                      <div>
                        <h4 className="text-xl font-bold">{order.restaurantName || 'Restaurant'}</h4>
                        <p className="text-zinc-500 text-sm">Order #{order.id?.slice(-6).toUpperCase() || 'N/A'}</p>
                      </div>
                      <div className={`px-4 py-1 rounded-full text-xs font-bold uppercase tracking-widest
                        ${order.status === 'delivered' ? 'bg-green-500/10 text-green-500' : 'bg-red-500/10 text-red-500 animate-pulse'}
                      `}>
                        {(order.status || 'pending').replace('-', ' ')}
                      </div>
                    </div>
                    <div className="p-6 space-y-6">
                      {/* Tracking Steps */}
                      <div className="flex items-center justify-between relative">
                        <div className="absolute top-1/2 left-0 right-0 h-0.5 bg-zinc-800 -translate-y-1/2 z-0"></div>
                        {[
                          { id: 'pending', icon: <Package size={18} />, label: 'Placed' },
                          { id: 'preparing', icon: <UtensilsCrossed size={18} />, label: 'Cooking' },
                          { id: 'out-for-delivery', icon: <Truck size={18} />, label: 'On Way' },
                          { id: 'delivered', icon: <CheckCircle2 size={18} />, label: 'Arrived' }
                        ].map((step, idx) => {
                          const statusOrder = ['pending', 'preparing', 'out-for-delivery', 'delivered'];
                          const currentIdx = statusOrder.indexOf(order.status);
                          const isActive = idx <= currentIdx;
                          return (
                            <div key={step.id} className="relative z-10 flex flex-col items-center gap-2">
                              <div className={`w-10 h-10 rounded-full flex items-center justify-center transition-all duration-500
                                ${isActive ? 'bg-red-500 text-white shadow-[0_0_20px_rgba(249,115,22,0.4)]' : 'bg-zinc-800 text-zinc-600'}
                              `}>
                                {step.icon}
                              </div>
                              <span className={`text-[10px] font-bold uppercase tracking-tighter ${isActive ? 'text-red-500' : 'text-zinc-600'}`}>{step.label}</span>
                            </div>
                          );
                        })}
                      </div>

                      {/* Simulated Map View for Out for Delivery */}
                      {order.status === 'out-for-delivery' && (
                        <div className="bg-zinc-950 border border-zinc-800 rounded-2xl p-4 mt-6">
                          <div className="flex items-center justify-between mb-4">
                            <div>
                              <h5 className="font-bold text-sm">Driver is on the way</h5>
                              <p className="text-zinc-500 text-xs">Estimated arrival: 15-20 mins</p>
                            </div>
                            <div className="bg-red-500/10 text-red-500 px-3 py-1 rounded-full text-xs font-bold animate-pulse">
                              Live Tracking
                            </div>
                          </div>
                          <div className="relative w-full h-48 bg-zinc-900 rounded-xl overflow-hidden border border-zinc-800">
                            {/* Simulated Map Grid */}
                            <div className="absolute inset-0 opacity-20" style={{ backgroundImage: 'radial-gradient(circle at 2px 2px, rgba(255,255,255,0.15) 1px, transparent 0)', backgroundSize: '20px 20px' }}></div>
                            
                            {/* Route Line */}
                            <svg className="absolute inset-0 w-full h-full" preserveAspectRatio="none">
                              <path d="M 40,40 Q 100,100 200,80 T 350,150" fill="none" stroke="rgba(249,115,22,0.3)" strokeWidth="4" strokeDasharray="8 8" className="animate-[dash_20s_linear_infinite]" />
                            </svg>

                            {/* Restaurant Marker */}
                            <div className="absolute top-[30px] left-[30px] w-6 h-6 bg-zinc-800 rounded-full border-2 border-zinc-600 flex items-center justify-center z-10">
                              <UtensilsCrossed size={12} className="text-zinc-400" />
                            </div>

                            {/* Home Marker */}
                            <div className="absolute bottom-[30px] right-[30px] w-6 h-6 bg-red-500 rounded-full border-2 border-red-300 flex items-center justify-center z-10 shadow-[0_0_15px_rgba(249,115,22,0.5)]">
                              <Home size={12} className="text-white" />
                            </div>

                            {/* Driver Marker (Animated) */}
                            <div className="absolute top-[80px] left-[180px] w-8 h-8 bg-white rounded-full border-2 border-zinc-950 flex items-center justify-center z-20 shadow-xl animate-bounce">
                              <Truck size={16} className="text-zinc-950" />
                            </div>
                          </div>
                          <div className="flex items-center gap-4 mt-4 bg-zinc-900/50 p-3 rounded-xl border border-zinc-800">
                            <img 
                              src="https://ui-avatars.com/api/?name=Driver&background=random" 
                              alt="Driver" 
                              className="w-10 h-10 rounded-full" 
                              referrerPolicy="no-referrer"
                            />
                            <div className="flex-1">
                              <p className="font-bold text-sm">Alex M.</p>
                              <p className="text-zinc-500 text-xs">Your Delivery Partner</p>
                            </div>
                            <button className="bg-zinc-800 hover:bg-zinc-700 text-white p-2 rounded-full transition-colors">
                              <Smartphone size={16} />
                            </button>
                          </div>
                        </div>
                      )}

                      <div className="bg-zinc-950/50 p-4 rounded-2xl space-y-2 mt-4">
                        {order.items?.map(item => (
                          <div key={item.id} className="flex justify-between text-sm">
                            <span className="text-zinc-400">{item.quantity}x {item.name}</span>
                            <span>${((item.price || 0) * (item.quantity || 0)).toFixed(2)}</span>
                          </div>
                        ))}
                        <div className="border-t border-zinc-800 mt-2 pt-2 flex justify-between font-bold">
                          <span>Total Paid</span>
                          <span className="text-red-500">${(order.totalAmount || 0).toFixed(2)}</span>
                        </div>
                        {user.role === 'restaurant' && (
                          <div className="flex justify-between text-xs font-bold text-green-500 mt-1 pt-1 border-t border-zinc-900">
                            <span>Your Earnings (90%)</span>
                            <span>${(order.restaurantEarnings || 0).toFixed(2)}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {view === 'profile' && user && (
          <div className="max-w-4xl mx-auto space-y-12 animate-fade-in">
            {/* User Profile Info */}
            <div className="bg-zinc-900/30 rounded-[2.5rem] border border-zinc-900 p-8 md:p-12">
              {!isEditingProfile ? (
                <div className="flex flex-col md:flex-row items-center gap-8">
                  <div className="relative group">
                    <div className="absolute -inset-1 bg-gradient-to-r from-red-500 to-yellow-500 rounded-full blur opacity-25 group-hover:opacity-50 transition duration-1000 group-hover:duration-200"></div>
                    <img 
                      src={user.photoURL || `https://ui-avatars.com/api/?name=${user.displayName}&background=random`} 
                      className="relative w-32 h-32 rounded-full object-cover border-4 border-zinc-950"
                      alt={user.displayName || 'User'}
                      referrerPolicy="no-referrer"
                    />
                  </div>
                  <div className="flex-1 text-center md:text-left space-y-2">
                    <h2 className="text-4xl font-black tracking-tighter">{user.displayName}</h2>
                    <p className="text-zinc-500 font-medium">{user.email}</p>
                    <div className="flex flex-wrap justify-center md:justify-start gap-3 mt-4">
                      <span className="bg-zinc-800 px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-widest text-zinc-400 border border-zinc-700">
                        {user.role}
                      </span>
                      {ADMIN_EMAILS.includes(user.email) && (
                        <span className="bg-red-500/10 text-red-500 px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-widest border border-red-500/20">
                          Developer Access
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-col gap-3 w-full md:w-auto">
                    <button 
                      onClick={() => {
                        setEditName(user.displayName || '');
                        setEditPhoto(user.photoURL || '');
                        setIsEditingProfile(true);
                      }}
                      className="bg-white text-black px-8 py-3 rounded-2xl font-bold hover:bg-zinc-200 transition-all flex items-center justify-center gap-2"
                    >
                      <Settings size={18} /> Edit Profile
                    </button>
                    {user.role === 'admin' && (
                      <button 
                        onClick={() => setView('admin')}
                        className="bg-red-500 text-white px-8 py-3 rounded-2xl font-bold hover:bg-red-600 transition-all flex items-center justify-center gap-2 shadow-lg shadow-red-500/20"
                      >
                        <Sparkles size={18} /> Admin Panel
                      </button>
                    )}
                    <button 
                      onClick={handleLogout}
                      className="bg-zinc-800 text-white px-8 py-3 rounded-2xl font-bold hover:bg-zinc-700 transition-all flex items-center justify-center gap-2"
                    >
                      <LogOut size={18} /> Logout
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-6">
                  <h2 className="text-3xl font-black tracking-tighter text-center">Edit Profile</h2>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-bold text-zinc-500 uppercase tracking-widest mb-2">Display Name</label>
                      <input 
                        type="text" 
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        className="w-full bg-zinc-950 border border-zinc-800 rounded-2xl py-4 px-6 focus:outline-none focus:ring-2 focus:ring-red-500 transition-all"
                        placeholder="Your Name"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-bold text-zinc-500 uppercase tracking-widest mb-2">Photo URL</label>
                      <input 
                        type="text" 
                        value={editPhoto}
                        onChange={(e) => setEditPhoto(e.target.value)}
                        className="w-full bg-zinc-950 border border-zinc-800 rounded-2xl py-4 px-6 focus:outline-none focus:ring-2 focus:ring-red-500 transition-all"
                        placeholder="https://example.com/photo.jpg"
                      />
                    </div>
                  </div>
                  <div className="flex gap-4">
                    <button 
                      onClick={() => setIsEditingProfile(false)}
                      className="flex-1 bg-zinc-800 hover:bg-zinc-700 text-white py-4 rounded-2xl font-bold transition-all"
                    >
                      Cancel
                    </button>
                    <button 
                      onClick={handleUpdateProfile}
                      disabled={loading}
                      className="flex-1 bg-red-500 hover:bg-red-600 text-white py-4 rounded-2xl font-bold transition-all disabled:opacity-50"
                    >
                      {loading ? 'Saving...' : 'Save Changes'}
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Restaurant Owner Dashboard */}
            {user.role === 'restaurant' && (
              <div className="space-y-8">
                <div className="flex items-center justify-between">
                  <h3 className="text-3xl font-black tracking-tighter flex items-center gap-3">
                    <UtensilsCrossed className="text-red-500" /> My Restaurant
                  </h3>
                </div>
                
                {restaurants.filter(r => r.ownerEmail === user.email).map(myRes => (
                  <div key={myRes.id} className="bg-zinc-900/30 rounded-[2.5rem] border border-zinc-900 overflow-hidden">
                    <div className="relative h-64">
                      <img 
                        src={myRes.image} 
                        className="w-full h-full object-cover" 
                        alt={myRes.name} 
                        referrerPolicy="no-referrer"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-zinc-950 via-zinc-950/20 to-transparent"></div>
                      <div className="absolute bottom-8 left-10">
                        <h4 className="text-4xl font-black tracking-tighter mb-2">{myRes.name}</h4>
                        <div className="flex items-center gap-4">
                          <span className="bg-red-500 text-white px-4 py-1 rounded-full text-sm font-bold">{myRes.category}</span>
                          <span className="flex items-center gap-1 text-yellow-500 font-bold"><Star size={16} fill="currentColor" /> {myRes.rating}</span>
                        </div>
                      </div>
                    </div>
                    
                    <div className="p-10 space-y-10">
                      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 border-b border-zinc-900 pb-8">
                        <div>
                          <h5 className="text-2xl font-bold mb-2">Product Management</h5>
                          <p className="text-zinc-500">Add new food items to your menu for customers to buy.</p>
                        </div>
                        <div className="flex flex-wrap items-center gap-4">
                          <button 
                            onClick={() => {
                              setEditingRestaurant(myRes);
                            }}
                            className="bg-zinc-800 hover:bg-zinc-700 text-white px-8 py-4 rounded-2xl font-bold transition-all flex items-center gap-2"
                          >
                            <Settings size={20} /> Edit Restaurant Profile
                          </button>
                          <button 
                            onClick={() => {
                              setMenuRestaurantId(myRes.id);
                              setShowAddMenuModal(true);
                            }}
                            className="bg-red-500 hover:bg-red-600 text-white px-8 py-4 rounded-2xl font-bold transition-all flex items-center gap-2 shadow-lg shadow-red-500/20"
                          >
                            <Plus size={20} /> Post New Food
                          </button>
                        </div>
                      </div>

                      <div className="space-y-6">
                        <h5 className="text-xl font-bold">Quick Actions</h5>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                          <button 
                            onClick={() => {
                              setSelectedRestaurant(myRes);
                              setView('restaurant');
                            }}
                            className="bg-zinc-950 p-6 rounded-3xl border border-zinc-800 hover:border-red-500/50 transition-all text-left group"
                          >
                            <UtensilsCrossed className="text-zinc-500 group-hover:text-red-500 mb-4 transition-colors" size={32} />
                            <h6 className="font-bold text-lg">View Menu</h6>
                            <p className="text-zinc-500 text-sm">See how your menu looks to customers.</p>
                          </button>
                          
                          <button 
                            onClick={() => setView('orders')}
                            className="bg-zinc-950 p-6 rounded-3xl border border-zinc-800 hover:border-red-500/50 transition-all text-left group"
                          >
                            <Clock className="text-zinc-500 group-hover:text-red-500 mb-4 transition-colors" size={32} />
                            <h6 className="font-bold text-lg">Recent Orders</h6>
                            <p className="text-zinc-500 text-sm">Track and manage incoming orders.</p>
                          </button>

                          <div className="bg-zinc-950 p-6 rounded-3xl border border-zinc-800 flex flex-col justify-center items-center text-center group hover:border-green-500/50 transition-all">
                            <div className="w-12 h-12 bg-green-500/10 rounded-full flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                              <Smartphone className="text-green-500" size={24} />
                            </div>
                            <p className="text-zinc-500 text-[10px] uppercase tracking-widest font-bold">Total Earnings (90%)</p>
                            <p className="text-3xl font-black text-green-500 mt-1">
                              ${orders
                                .filter(o => o.restaurantId === myRes.id)
                                .reduce((sum, o) => sum + (o.restaurantEarnings || 0), 0)
                                .toFixed(2)}
                            </p>
                            <div className="mt-2 flex items-center gap-1 text-[10px] font-bold text-zinc-600 uppercase">
                              <Check size={12} /> Split Payment Active
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {view === 'admin' && user?.role === 'admin' && (
          <div className="space-y-8 animate-fade-in">
            <div className="flex items-center justify-between">
              <h2 className="text-4xl font-black tracking-tighter">Admin Dashboard</h2>
              <div className="flex gap-4">
                <div className="bg-zinc-900 px-6 py-3 rounded-2xl border border-zinc-800 flex items-center gap-6">
                  <div>
                    <p className="text-zinc-500 text-[10px] uppercase font-bold tracking-widest">Total Revenue</p>
                    <p className="text-xl font-black text-white">${orders.reduce((sum, o) => sum + (o.totalAmount || 0), 0).toFixed(2)}</p>
                  </div>
                  <div className="w-px h-8 bg-zinc-800"></div>
                  <div>
                    <p className="text-red-500 text-[10px] uppercase font-bold tracking-widest">Sansneat Share (10%)</p>
                    <p className="text-xl font-black text-red-500">${orders.reduce((sum, o) => sum + (o.commissionAmount || 0), 0).toFixed(2)}</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              <div className="lg:col-span-2 space-y-6">
                <h3 className="text-xl font-bold flex items-center gap-2"><Clock size={20} /> Recent System Orders</h3>
                <div className="bg-zinc-900/30 rounded-3xl border border-zinc-900 overflow-hidden">
                  <table className="w-full text-left">
                    <thead className="bg-zinc-900/50 text-zinc-500 text-xs uppercase font-bold">
                      <tr>
                        <th className="px-6 py-4">Order ID</th>
                        <th className="px-6 py-4">Customer</th>
                        <th className="px-6 py-4">Restaurant</th>
                        <th className="px-6 py-4">Amount</th>
                        <th className="px-6 py-4">Commission (10%)</th>
                        <th className="px-6 py-4">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-900">
                      {/* In a real app, we'd fetch ALL orders for admin */}
                      {orders.map(order => (
                        <tr key={order.id} className="hover:bg-zinc-900/50 transition-colors">
                          <td className="px-6 py-4 font-mono text-xs">#{order.id.slice(-6).toUpperCase()}</td>
                          <td className="px-6 py-4">
                            <div className="text-sm font-bold">{order.userName || 'Anonymous'}</div>
                            <div className="text-xs text-zinc-500">{order.userEmail}</div>
                          </td>
                          <td className="px-6 py-4 text-sm">{order.restaurantName}</td>
                          <td className="px-6 py-4 text-sm font-bold">${(order.totalAmount || 0).toFixed(2)}</td>
                          <td className="px-6 py-4 text-sm font-bold text-red-500">${(order.commissionAmount || 0).toFixed(2)}</td>
                          <td className="px-6 py-4">
                            <select 
                              value={order.status}
                              onChange={async (e) => {
                                const newStatus = e.target.value as Order['status'];
                                const orderPath = `orders/${order.id}`;
                                try {
                                  await updateDoc(doc(db, orderPath), { status: newStatus });
                                } catch (error) {
                                  handleFirestoreError(error, OperationType.UPDATE, orderPath);
                                }
                              }}
                              className="bg-zinc-800 text-xs font-bold rounded-lg px-3 py-2 border border-zinc-700 focus:ring-2 focus:ring-red-500 outline-none cursor-pointer hover:bg-zinc-700 transition-colors"
                            >
                              <option value="pending">Pending</option>
                              <option value="preparing">Preparing</option>
                              <option value="out-for-delivery">Out for Delivery</option>
                              <option value="delivered">Delivered</option>
                            </select>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <h3 className="text-xl font-bold flex items-center gap-2"><UtensilsCrossed size={20} /> Manage Restaurants</h3>
                  <button 
                    onClick={() => setShowAddRestaurantModal(true)}
                    className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-xl font-bold text-sm flex items-center gap-2 transition-all"
                  >
                    <Plus size={16} /> Add Restaurant
                  </button>
                </div>
                <div className="space-y-4">
                  {restaurants.map(res => (
                    <div key={res.id} className="bg-zinc-900/50 p-4 rounded-2xl border border-zinc-900 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <img 
                          src={res.image} 
                          className="w-12 h-12 rounded-lg object-cover" 
                          alt={res.name} 
                          referrerPolicy="no-referrer"
                        />
                        <div>
                          <p className="font-bold text-sm">{res.name}</p>
                          <p className="text-zinc-500 text-xs">{res.category}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button 
                          onClick={() => {
                            if (res.pinnedOrder) handleUnpinRestaurant(res.id);
                            else handlePinRestaurant(res.id);
                          }}
                          className={`p-2 transition-colors ${res.pinnedOrder ? 'text-red-500' : 'text-zinc-500 hover:text-white'}`}
                          title={res.pinnedOrder ? "Unpin" : "Pin to top"}
                        >
                          <Star size={18} fill={res.pinnedOrder ? "currentColor" : "none"} />
                        </button>
                        <button 
                          onClick={() => {
                            setMenuRestaurantId(res.id);
                            setShowAddMenuModal(true);
                          }}
                          className="p-2 text-zinc-500 hover:text-white transition-colors"
                          title="Add Menu Item"
                        >
                          <Plus size={18} />
                        </button>
                        <button 
                          onClick={() => setEditingRestaurant(res)}
                          className="p-2 hover:text-red-500 transition-colors"
                        >
                          <Settings size={18} />
                        </button>
                        <button className="p-2 hover:text-red-500 transition-colors"><ChevronRight size={18} /></button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Bottom Navigation (Mobile) */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-zinc-950/90 backdrop-blur-xl border-t border-zinc-900 px-6 py-4 flex justify-between items-center z-50">
        <button onClick={() => setView('home')} className={`p-2 ${view === 'home' ? 'text-red-500' : 'text-zinc-500'}`}><Home size={24} /></button>
        <button onClick={() => setView('search')} className={`p-2 ${view === 'search' ? 'text-red-500' : 'text-zinc-500'}`}><Search size={24} /></button>
        <button 
          onClick={() => {
            if (!user) setShowLoginModal(true);
            else setView('orders');
          }} 
          className={`p-2 ${view === 'orders' ? 'text-red-500' : 'text-zinc-500'}`}
        >
          <Clock size={24} />
        </button>
        <button onClick={() => setView('profile')} className={`p-2 ${view === 'profile' ? 'text-red-500' : 'text-zinc-500'}`}><User size={24} /></button>
      </nav>

      {/* Edit Restaurant Modal */}
      {editingRestaurant && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="bg-zinc-950 w-full max-w-md rounded-3xl border border-zinc-800 p-8 space-y-6">
            <div className="flex justify-between items-center">
              <h3 className="text-2xl font-black tracking-tighter">Edit Restaurant</h3>
              <button onClick={() => setEditingRestaurant(null)} className="p-2 hover:bg-zinc-900 rounded-full transition-colors"><X size={20} /></button>
            </div>
            
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-xs font-bold text-zinc-500 uppercase tracking-widest">Restaurant Name</label>
                <input 
                  type="text" 
                  value={editingRestaurant.name}
                  onChange={(e) => setEditingRestaurant({...editingRestaurant, name: e.target.value})}
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 focus:ring-2 focus:ring-red-500 outline-none transition-all"
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold text-zinc-500 uppercase tracking-widest">Description</label>
                <textarea 
                  value={editingRestaurant.description}
                  onChange={(e) => setEditingRestaurant({...editingRestaurant, description: e.target.value})}
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 focus:ring-2 focus:ring-red-500 outline-none transition-all h-24"
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold text-zinc-500 uppercase tracking-widest">Category</label>
                <input 
                  type="text" 
                  value={editingRestaurant.category}
                  onChange={(e) => setEditingRestaurant({...editingRestaurant, category: e.target.value})}
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 focus:ring-2 focus:ring-red-500 outline-none transition-all"
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold text-zinc-500 uppercase tracking-widest">Restaurant Image</label>
                <div className="flex gap-4 items-center">
                  {editingRestaurant.image && (
                    <img 
                      src={editingRestaurant.image} 
                      className="w-12 h-12 rounded-lg object-cover" 
                      alt="Preview" 
                      referrerPolicy="no-referrer"
                    />
                  )}
                  <input 
                    type="file" 
                    accept="image/*"
                    onChange={(e) => handleImageUpload(e, 'edit-restaurant')}
                    className="text-xs text-zinc-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-xs file:font-bold file:bg-zinc-800 file:text-zinc-300 hover:file:bg-zinc-700"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold text-zinc-500 uppercase tracking-widest">Owner Email</label>
                <input 
                  type="email" 
                  value={editingRestaurant.ownerEmail}
                  onChange={(e) => setEditingRestaurant({...editingRestaurant, ownerEmail: e.target.value})}
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 focus:ring-2 focus:ring-red-500 outline-none transition-all"
                />
              </div>
            </div>

            <button 
              onClick={handleUpdateRestaurant}
              disabled={loading}
              className="w-full bg-red-500 hover:bg-red-600 disabled:opacity-50 text-white py-4 rounded-2xl font-black text-lg shadow-lg shadow-red-500/20 transition-all"
            >
              {loading ? 'Updating...' : 'Update Restaurant'}
            </button>
          </div>
        </div>
      )}
      {showAddRestaurantModal && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-6">
          <div className="absolute inset-0 bg-black/90 backdrop-blur-sm" onClick={() => setShowAddRestaurantModal(false)}></div>
          <div className="relative bg-zinc-900 w-full max-w-md rounded-3xl border border-zinc-800 p-8 space-y-6 animate-pop-in">
            <div className="flex justify-between items-center">
              <h3 className="text-2xl font-black tracking-tighter">Add Restaurant</h3>
              <button onClick={() => setShowAddRestaurantModal(false)} className="text-zinc-500 hover:text-white"><X size={24} /></button>
            </div>
            <div className="space-y-4">
              <input 
                type="text" 
                placeholder="Restaurant Name" 
                value={newRestaurant.name}
                onChange={(e) => setNewRestaurant({ ...newRestaurant, name: e.target.value })}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-2xl py-4 px-6 focus:outline-none focus:ring-2 focus:ring-red-500 transition-all"
              />
              <input 
                type="text" 
                placeholder="Category (e.g. Burgers, Pizza)" 
                value={newRestaurant.category}
                onChange={(e) => setNewRestaurant({ ...newRestaurant, category: e.target.value })}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-2xl py-4 px-6 focus:outline-none focus:ring-2 focus:ring-red-500 transition-all"
              />
              <textarea 
                placeholder="Description" 
                value={newRestaurant.description}
                onChange={(e) => setNewRestaurant({ ...newRestaurant, description: e.target.value })}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-2xl py-4 px-6 focus:outline-none focus:ring-2 focus:ring-red-500 transition-all h-24 resize-none"
              />
              <div className="space-y-2">
                <label className="text-xs font-bold text-zinc-500 uppercase tracking-widest">Restaurant Image</label>
                <div className="flex gap-4 items-center">
                  {newRestaurant.image && (
                    <img 
                      src={newRestaurant.image} 
                      className="w-12 h-12 rounded-lg object-cover" 
                      alt="Preview" 
                      referrerPolicy="no-referrer"
                    />
                  )}
                  <input 
                    type="file" 
                    accept="image/*"
                    onChange={(e) => handleImageUpload(e, 'restaurant')}
                    className="text-xs text-zinc-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-xs file:font-bold file:bg-zinc-800 file:text-zinc-300 hover:file:bg-zinc-700"
                  />
                </div>
              </div>
              <input 
                type="email" 
                placeholder="Owner Email (Role will be set to Restaurant)" 
                value={newRestaurant.ownerEmail}
                onChange={(e) => setNewRestaurant({ ...newRestaurant, ownerEmail: e.target.value })}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-2xl py-4 px-6 focus:outline-none focus:ring-2 focus:ring-red-500 transition-all"
              />
            </div>
            <button 
              onClick={handleAddRestaurant}
              disabled={loading || !newRestaurant.name}
              className="w-full bg-red-500 hover:bg-red-600 text-white py-4 rounded-2xl font-bold transition-all disabled:opacity-50"
            >
              {loading ? 'Adding...' : 'Add Restaurant'}
            </button>
          </div>
        </div>
      )}

      {/* Add Menu Item Modal */}
      {showAddMenuModal && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-6">
          <div className="absolute inset-0 bg-black/90 backdrop-blur-sm" onClick={() => setShowAddMenuModal(false)}></div>
          <div className="relative bg-zinc-900 w-full max-w-md rounded-3xl border border-zinc-800 p-8 space-y-6 animate-pop-in">
            <div className="flex justify-between items-center">
              <h3 className="text-2xl font-black tracking-tighter">Add Food Item</h3>
              <button onClick={() => setShowAddMenuModal(false)} className="text-zinc-500 hover:text-white"><X size={24} /></button>
            </div>
            <div className="space-y-4">
              <input 
                type="text" 
                placeholder="Food Name (e.g. Beef Smash Burger)" 
                value={newMenuItem.name}
                onChange={(e) => setNewMenuItem({ ...newMenuItem, name: e.target.value })}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-2xl py-4 px-6 focus:outline-none focus:ring-2 focus:ring-red-500 transition-all"
              />
              <input 
                type="number" 
                placeholder="Price (e.g. 16)" 
                value={newMenuItem.price || ''}
                onChange={(e) => setNewMenuItem({ ...newMenuItem, price: parseFloat(e.target.value) })}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-2xl py-4 px-6 focus:outline-none focus:ring-2 focus:ring-red-500 transition-all"
              />
              <textarea 
                placeholder="Description" 
                value={newMenuItem.description}
                onChange={(e) => setNewMenuItem({ ...newMenuItem, description: e.target.value })}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-2xl py-4 px-6 focus:outline-none focus:ring-2 focus:ring-red-500 transition-all h-24 resize-none"
              />
              <div className="space-y-2">
                <label className="text-xs font-bold text-zinc-500 uppercase tracking-widest">Food Image</label>
                <div className="flex gap-4 items-center">
                  {newMenuItem.image && (
                    <img 
                      src={newMenuItem.image} 
                      className="w-12 h-12 rounded-lg object-cover" 
                      alt="Preview" 
                      referrerPolicy="no-referrer"
                    />
                  )}
                  <input 
                    type="file" 
                    accept="image/*"
                    onChange={(e) => handleImageUpload(e, 'menu')}
                    className="text-xs text-zinc-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-xs file:font-bold file:bg-zinc-800 file:text-zinc-300 hover:file:bg-zinc-700"
                  />
                </div>
              </div>
            </div>
            <button 
              onClick={handleAddMenuItem}
              disabled={loading || !newMenuItem.name}
              className="w-full bg-red-500 hover:bg-red-600 text-white py-4 rounded-2xl font-bold transition-all disabled:opacity-50"
            >
              {loading ? 'Adding Item...' : 'Add Food Item'}
            </button>
          </div>
        </div>
      )}

      {/* Login Modal */}
      {showLoginModal && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-6">
          <div className="absolute inset-0 bg-black/90 backdrop-blur-sm" onClick={() => setShowLoginModal(false)}></div>
          <div className="relative bg-zinc-900 w-full max-w-sm rounded-3xl border border-zinc-800 overflow-hidden animate-pop-in">
            <div className="p-8 space-y-6">
              <div className="flex justify-between items-center">
                <h3 className="text-2xl font-black tracking-tighter">Login</h3>
                <button onClick={() => setShowLoginModal(false)} className="text-zinc-500 hover:text-white"><X size={24} /></button>
              </div>
              <div className="space-y-4">
                <LoginWithSanscounts 
                    onLoginSuccess={async (userData) => {
                      console.log("User logged in with Sanscounts:", userData);
                      
                      const email = userData.email || 'sansneat@sanscounts.com';
                      const dummyPassword = 'Sanscounts123!@#';
                      let finalUid = userData.uid || 'sanscounts-user';
                      
                      try {
                        const userCredential = await signInWithEmailAndPassword(auth, email, dummyPassword);
                        console.log("Firebase Auth successful via Email/Password");
                        finalUid = userCredential.user.uid;
                      } catch (error: any) {
                        console.log("Sign in failed, trying to create user...", error.code);
                        if (error.code === 'auth/user-not-found' || error.code === 'auth/invalid-credential' || error.code === 'auth/invalid-login-credentials') {
                          try {
                            const userCredential = await createUserWithEmailAndPassword(auth, email, dummyPassword);
                            console.log("Firebase User created and signed in");
                            finalUid = userCredential.user.uid;
                            
                            // Create user doc
                            await setDoc(doc(db, 'users', finalUid), {
                              email: email,
                              name: userData.name || 'Sanscounts Admin',
                              role: 'admin',
                              createdAt: serverTimestamp()
                            });
                          } catch (createError: any) {
                            console.error("Failed to create user:", createError);
                            if (createError.code === 'auth/operation-not-allowed') {
                              alert("Please enable 'Email/Password' authentication in your Firebase Console to use this mock login.");
                            }
                          }
                        } else if (error.code === 'auth/operation-not-allowed') {
                          alert("Please enable 'Email/Password' authentication in your Firebase Console to use this mock login.");
                        }
                      }

                      const isAdmin = ADMIN_EMAILS.includes(email);
                      setUser({
                        uid: auth.currentUser?.uid || finalUid,
                        email: email,
                        displayName: userData.name || 'Sanscounts User',
                        photoURL: userData.photoURL || userData.avatar || '',
                        role: isAdmin ? 'admin' : 'customer'
                      });
                      setShowLoginModal(false);
                    }} 
                  />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Payment Modal */}
      {showPaymentModal && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-6">
          <div className="absolute inset-0 bg-black/90 backdrop-blur-sm" onClick={() => !loading && setShowPaymentModal(false)}></div>
          <div className="relative bg-zinc-900 w-full max-w-md rounded-3xl border border-zinc-800 overflow-hidden animate-pop-in">
            {paymentStep === 'details' && (
              <div className="p-8 space-y-6">
                <div className="flex justify-between items-center">
                  <h3 className="text-2xl font-black tracking-tighter">Secure Payment</h3>
                  <button onClick={() => setShowPaymentModal(false)} className="text-zinc-500 hover:text-white"><X size={24} /></button>
                </div>
                
                <div className="space-y-4">
                  <div className="bg-zinc-950 p-4 rounded-2xl border border-zinc-800 flex justify-between items-center">
                    <span className="text-zinc-400">Total Amount</span>
                    <span className="text-xl font-black text-red-500">${cart.reduce((a, b) => a + b.price * b.quantity, 0).toFixed(2)}</span>
                  </div>

                  <Elements stripe={stripePromise}>
                    <StripePaymentForm 
                      amount={cart.reduce((a, b) => a + b.price * b.quantity, 0)}
                      onProcessing={() => setPaymentStep('processing')}
                      onSuccess={() => {
                        setPaymentStep('success');
                        setTimeout(placeOrder, 2000);
                      }}
                    />
                  </Elements>
                </div>
              </div>
            )}

            {paymentStep === 'processing' && (
              <div className="p-12 text-center space-y-6">
                <div className="w-20 h-20 border-4 border-red-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
                <h3 className="text-2xl font-bold">Processing Payment...</h3>
                <p className="text-zinc-500">Please do not close this window</p>
              </div>
            )}

            {paymentStep === 'success' && (
              <div className="p-12 text-center space-y-6 animate-fade-in">
                <div className="w-20 h-20 bg-green-500 text-white rounded-full flex items-center justify-center mx-auto shadow-[0_0_40px_rgba(34,197,94,0.4)]">
                  <Check size={40} strokeWidth={4} />
                </div>
                <h3 className="text-3xl font-black tracking-tighter">Payment Successful!</h3>
                <p className="text-zinc-500">Your order is being prepared...</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
