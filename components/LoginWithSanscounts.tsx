import React, { useEffect } from 'react';

interface LoginWithSanscountsProps {
  onLoginSuccess?: (userData: any) => void;
}

export function LoginWithSanscounts({ onLoginSuccess }: LoginWithSanscountsProps) {
  const handleLogin = () => {
    // ১. Sanscounts-এর Auth পপআপ ওপেন করা
    // (এখানে আপনার Sanscounts-এর Dev URL দেওয়া আছে)
    const clientId = 'sansneat-client-id';
    
    // Using window.location.origin so it works both locally and in the deployed app
    const redirectUri = encodeURIComponent(`${window.location.origin}/auth/callback`);
    const authUrl = `${window.location.origin}/auth/callback?client_id=${clientId}&redirect_uri=${redirectUri}&response_type=code`;
    
    // পপআপ স্ক্রিনের মাঝখানে দেখানোর জন্য
    const width = 500;
    const height = 700;
    const left = window.screenX + (window.outerWidth - width) / 2;
    const top = window.screenY + (window.outerHeight - height) / 2;
    
    window.open(
      authUrl,
      'SanscountsAuth',
      `width=${width},height=${height},left=${left},top=${top},popup=1`
    );
  };

  useEffect(() => {
    // ২. পপআপ থেকে সাকসেস মেসেজ রিসিভ করা
    const handleMessage = (event: MessageEvent) => {
      // Security check: allow current origin or localhost
      const isAllowedOrigin = event.origin === window.location.origin || 
                             event.origin.includes('localhost') ||
                             event.origin.includes('.run.app');
      
      if (!isAllowedOrigin) return;

      if (event.data?.type === 'SANSCOUNTS_AUTH_SUCCESS') {
        const userData = event.data.payload;
        console.log("Successfully logged in with Sanscounts!", userData);
        
        // লগইন সফল হলে Sansneat-এর মেইন স্টেটে ডাটা পাঠিয়ে দিন
        if (onLoginSuccess) {
          onLoginSuccess(userData);
        } else {
          alert(`Welcome to Sansneat, ${userData.name}!`);
        }
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [onLoginSuccess]);

  return (
    <button 
      onClick={handleLogin}
      className="w-full py-3 px-4 bg-white hover:bg-zinc-100 text-black font-bold rounded-full transition-all flex items-center justify-center gap-3 shadow-sm border border-zinc-200"
    >
      <img 
        src="https://i.postimg.cc/wvXS9k1D/IMG-9128.jpg" 
        alt="Sanscounts" 
        className="w-6 h-6 rounded-md object-cover shadow-sm" 
        referrerPolicy="no-referrer"
      />
      Sign in with Sanscounts
    </button>
  );
}
