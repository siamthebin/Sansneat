import React, { useState, useEffect } from 'react';
import { CardElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { Smartphone, AlertCircle, CreditCard, Loader2 } from 'lucide-react';

interface StripePaymentFormProps {
  amount: number;
  customerId?: string;
  email?: string;
  name?: string;
  onSuccess: (customerId?: string) => void;
  onProcessing: () => void;
}

interface PaymentMethod {
  id: string;
  card: {
    brand: string;
    last4: string;
    exp_month: number;
    exp_year: number;
  };
}

export function StripePaymentForm({ amount, customerId, email, name, onSuccess, onProcessing }: StripePaymentFormProps) {
  const stripe = useStripe();
  const elements = useElements();
  const [error, setError] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);
  const [saveCard, setSaveCard] = useState(false);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<string | 'new'>('new');
  const [loadingMethods, setLoadingMethods] = useState(false);

  useEffect(() => {
    if (!customerId) return;
    
    const fetchMethods = async () => {
      setLoadingMethods(true);
      try {
        const response = await fetch('/api/get-payment-methods', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ customerId }),
        });
        if (response.ok) {
          const data = await response.json();
          if (data.paymentMethods && data.paymentMethods.length > 0) {
            setPaymentMethods(data.paymentMethods);
            setSelectedPaymentMethod(data.paymentMethods[0].id);
          }
        }
      } catch (e) {
        console.error("Failed to fetch payment methods", e);
      } finally {
        setLoadingMethods(false);
      }
    };
    
    fetchMethods();
  }, [customerId]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!stripe || (!elements && selectedPaymentMethod === 'new')) {
      return;
    }

    setProcessing(true);
    onProcessing();
    setError(null);

    try {
      if (selectedPaymentMethod !== 'new') {
        // Pay with saved card
        const response = await fetch('/api/create-payment-intent', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            amount, 
            customerId, 
            paymentMethodId: selectedPaymentMethod 
          }),
        });

        const data = await response.json();
        if (data.error) throw new Error(data.error);
        
        // If it requires action (e.g. 3D secure)
        if (data.clientSecret && data.requiresAction) {
          const result = await stripe.confirmCardPayment(data.clientSecret);
          if (result.error) throw new Error(result.error.message || 'Payment failed');
        }
        
        onSuccess(customerId);
      } else {
        // Pay with new card
        const response = await fetch('/api/create-payment-intent', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ amount, customerId, saveCard, email, name }),
        });

        const data = await response.json();
        if (data.error) throw new Error(data.error);

        const result = await stripe.confirmCardPayment(data.clientSecret, {
          payment_method: {
            card: elements!.getElement(CardElement) as any,
            billing_details: {
              name: name || 'Anonymous',
              email: email || undefined,
            }
          },
        });

        if (result.error) {
          throw new Error(result.error.message || 'Payment failed');
        } else if (result.paymentIntent.status === 'succeeded') {
          onSuccess(data.customerId);
        }
      }
    } catch (err: any) {
      setError(err.message);
      setProcessing(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {loadingMethods ? (
        <div className="flex justify-center py-4">
          <Loader2 className="w-6 h-6 animate-spin text-red-500" />
        </div>
      ) : paymentMethods.length > 0 ? (
        <div className="space-y-3">
          <label className="text-xs font-bold text-zinc-500 uppercase tracking-widest">Select Payment Method</label>
          <div className="space-y-2">
            {paymentMethods.map((pm) => (
              <label 
                key={pm.id} 
                className={`flex items-center gap-3 p-4 rounded-2xl border cursor-pointer transition-all ${
                  selectedPaymentMethod === pm.id 
                    ? 'bg-red-500/10 border-red-500 text-white' 
                    : 'bg-zinc-950 border-zinc-800 text-zinc-400 hover:border-zinc-700'
                }`}
              >
                <input 
                  type="radio" 
                  name="paymentMethod" 
                  value={pm.id} 
                  checked={selectedPaymentMethod === pm.id}
                  onChange={() => setSelectedPaymentMethod(pm.id)}
                  className="hidden"
                />
                <CreditCard size={20} className={selectedPaymentMethod === pm.id ? 'text-red-500' : 'text-zinc-500'} />
                <span className="font-bold uppercase text-xs w-12">{pm.card.brand}</span>
                <span className="font-medium tracking-widest">•••• {pm.card.last4}</span>
              </label>
            ))}
            
            <label 
              className={`flex items-center gap-3 p-4 rounded-2xl border cursor-pointer transition-all ${
                selectedPaymentMethod === 'new' 
                  ? 'bg-red-500/10 border-red-500 text-white' 
                  : 'bg-zinc-950 border-zinc-800 text-zinc-400 hover:border-zinc-700'
              }`}
            >
              <input 
                type="radio" 
                name="paymentMethod" 
                value="new" 
                checked={selectedPaymentMethod === 'new'}
                onChange={() => setSelectedPaymentMethod('new')}
                className="hidden"
              />
              <div className="w-5 h-5 rounded-full border-2 flex items-center justify-center border-current">
                {selectedPaymentMethod === 'new' && <div className="w-2.5 h-2.5 rounded-full bg-current" />}
              </div>
              <span className="font-medium">Use a new card</span>
            </label>
          </div>
        </div>
      ) : null}

      {selectedPaymentMethod === 'new' && (
        <>
          <div className="space-y-2">
            <label className="text-xs font-bold text-zinc-500 uppercase tracking-widest">Card Details</label>
            <div className="bg-zinc-950 p-4 rounded-2xl border border-zinc-800">
              <CardElement 
                options={{
                  style: {
                    base: {
                      fontSize: '16px',
                      color: '#ffffff',
                      '::placeholder': {
                        color: '#52525b',
                      },
                    },
                    invalid: {
                      color: '#ef4444',
                    },
                  },
                }}
              />
            </div>
          </div>

          <div className="flex items-center gap-2">
            <input 
              type="checkbox" 
              id="saveCard" 
              checked={saveCard}
              onChange={(e) => setSaveCard(e.target.checked)}
              className="w-4 h-4 rounded border-zinc-700 bg-zinc-900 text-red-500 focus:ring-red-500 focus:ring-offset-zinc-950"
            />
            <label htmlFor="saveCard" className="text-sm text-zinc-400 cursor-pointer">
              Save this card for future purchases
            </label>
          </div>
        </>
      )}

      {error && (
        <div className="bg-red-500/10 border border-red-500/20 p-4 rounded-2xl flex items-center gap-3 text-red-500 text-sm">
          <AlertCircle size={18} />
          <span>{error}</span>
        </div>
      )}

      <button 
        type="submit"
        disabled={!stripe || processing}
        className="w-full bg-red-500 hover:bg-red-600 text-white py-4 rounded-2xl font-bold transition-all flex items-center justify-center gap-2 disabled:opacity-50"
      >
        <Smartphone size={20} />
        {processing ? 'Processing...' : `Pay $${amount.toFixed(2)}`}
      </button>
      
      <p className="text-[10px] text-zinc-600 text-center uppercase tracking-widest">Encrypted & Secure Transaction via Stripe</p>
    </form>
  );
}
