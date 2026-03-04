import React, { useState } from 'react';
import { supabase } from './lib/supabaseClient';

export default function Auth() {
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState('');

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: window.location.origin,
      },
    });

    if (error) {
      alert(error.error_description || error.message);
    } else {
      alert('Check your Stanford email for the login link!');
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-[#F4F4F4] flex flex-col items-center justify-center p-4">
      <div className="bg-white border-t-4 border-[#8C1515] p-10 rounded-xl shadow-xl max-w-md w-full text-center">
        <h1 className="text-[#8C1515] text-3xl font-serif font-bold mb-2">SLS IT Portal</h1>
        <p className="text-[#4D4F53] text-sm uppercase tracking-widest mb-8 font-semibold">Secure Access</p>
        
        <form onSubmit={handleLogin} className="space-y-6">
          <div>
            <input
              type="email"
              placeholder="sunetid@stanford.edu"
              value={email}
              required
              onChange={(e) => setEmail(e.target.value)}
              className="w-full border-b-2 border-[#D2BA92] py-3 outline-none focus:border-[#8C1515] transition-colors text-center text-lg"
            />
          </div>
          <button
            disabled={loading}
            className="w-full bg-[#8C1515] text-white py-3 rounded-md font-bold hover:bg-[#6b1010] transition-all shadow-md disabled:opacity-50"
          >
            {loading ? 'Sending Magic Link...' : 'Send Magic Link'}
          </button>
        </form>
        <p className="mt-8 text-[10px] text-gray-400 uppercase tracking-tighter">
          Authorized use only. Stanford Law School Information Technology.
        </p>
      </div>
    </div>
  );
}