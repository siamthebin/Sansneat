import React, { useState } from 'react';
import { CardElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { Smartphone, AlertCircle } from 'lucide-react';

interface StripePaymentFormProps {
  amount: number;
  onSuccess: () => void;
  onProcessing: () => void;
}

export function StripePaymentForm({ amount, onSuccess, onProcessing }: StripePaymentFormProps) {
  const stripe = useStripe();
  const elements = useElements();
  const [error, setError] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!stripe || !elements) {
      return;
    }

    setProcessing(true);
    onProcessing();

    try {
      // 1. Create PaymentIntent on the server
      const response = await fetch('/api/create-payment-intent', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ amount }),
      });

      const data = await response.json();

      if (data.error) {
        throw new Error(data.error);
      }

      // 2. Confirm the payment on the client
      const result = await stripe.confirmCardPayment(data.clientSecret, {
        payment_method: {
          card: elements.getElement(CardElement) as any,
        },
      });

      if (result.error) {
        setError(result.error.message || 'Payment failed');
        setProcessing(false);
      } else {
        if (result.paymentIntent.status === 'succeeded') {
          onSuccess();
        }
      }
    } catch (err: any) {
      setError(err.message);
      setProcessing(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
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
