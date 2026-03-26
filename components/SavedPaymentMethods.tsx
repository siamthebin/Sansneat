import React, { useEffect, useState } from 'react';
import { CreditCard, Trash2, Loader2 } from 'lucide-react';

interface PaymentMethod {
  id: string;
  card: {
    brand: string;
    last4: string;
    exp_month: number;
    exp_year: number;
  };
}

interface SavedPaymentMethodsProps {
  customerId?: string;
}

export function SavedPaymentMethods({ customerId }: SavedPaymentMethodsProps) {
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!customerId) return;

    const fetchPaymentMethods = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch('/api/get-payment-methods', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ customerId }),
        });

        if (!response.ok) {
          throw new Error('Failed to fetch payment methods');
        }

        const data = await response.json();
        setPaymentMethods(data.paymentMethods);
      } catch (err: any) {
        setError(err.message || 'An error occurred');
      } finally {
        setLoading(false);
      }
    };

    fetchPaymentMethods();
  }, [customerId]);

  if (!customerId) {
    return null;
  }

  return (
    <div className="bg-zinc-900/30 rounded-[2.5rem] border border-zinc-900 p-8 md:p-12 mt-8">
      <h3 className="text-2xl font-black tracking-tighter mb-6 flex items-center gap-3">
        <CreditCard className="text-red-500" />
        Saved Payment Methods
      </h3>

      {loading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="w-8 h-8 animate-spin text-red-500" />
        </div>
      ) : error ? (
        <div className="text-red-500 bg-red-500/10 p-4 rounded-2xl border border-red-500/20">
          {error}
        </div>
      ) : paymentMethods.length === 0 ? (
        <div className="text-zinc-500 text-center py-8 bg-zinc-950 rounded-2xl border border-zinc-800">
          No saved payment methods found.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {paymentMethods.map((pm) => (
            <div key={pm.id} className="bg-zinc-950 p-6 rounded-2xl border border-zinc-800 flex items-center justify-between group">
              <div className="flex items-center gap-4">
                <div className="w-12 h-8 bg-zinc-900 rounded border border-zinc-800 flex items-center justify-center font-bold uppercase text-xs text-zinc-400">
                  {pm.card.brand}
                </div>
                <div>
                  <p className="font-bold tracking-tight">•••• •••• •••• {pm.card.last4}</p>
                  <p className="text-xs text-zinc-500 font-medium">
                    Expires {pm.card.exp_month.toString().padStart(2, '0')}/{pm.card.exp_year}
                  </p>
                </div>
              </div>
              {/* Optional: Add delete functionality later if requested */}
              {/* <button className="p-2 text-zinc-500 hover:text-red-500 hover:bg-red-500/10 rounded-full transition-colors opacity-0 group-hover:opacity-100">
                <Trash2 size={18} />
              </button> */}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
