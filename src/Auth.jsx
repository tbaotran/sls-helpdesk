import React, { useState } from 'react';
import { supabase } from './lib/supabaseClient';

export default function Auth() {
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [token, setToken] = useState('');
  const [view, setView] = useState('request'); // 'request' or 'verify'

  // Step 1: Send the 6-digit code to the email
  const handleRequestCode = async (e) => {
    e.preventDefault();
    setLoading(true);
    
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        shouldCreateUser: true,
      },
    });

    if (error) {
      alert(error.message);
    } else {
      setView('verify');
    }
    setLoading(false);
  };

  // Step 2: Verify the 6-digit code
  
  const handleVerifyCode = async (e) => {
    e.preventDefault();
    setLoading(true);

    const { error } = await supabase.auth.verifyOtp({
      email,
      token,
      type: 'magiclink', // <--- Change 'email' to 'magiclink'
    });

    if (error) {
      alert("Invalid or expired code. Please try again Bao");
    } 
    // If successful, onAuthStateChange in App.jsx will automatically log the user in
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-[#F4F4F4] flex flex-col items-center justify-center p-4">
      <div className="bg-white border-t-4 border-[#8C1515] p-10 rounded-xl shadow-xl max-w-md w-full text-center">
        <h1 className="text-[#8C1515] text-3xl font-serif font-bold mb-2">SLS IT Portal</h1>
        <p className="text-[#4D4F53] text-sm uppercase tracking-widest mb-8 font-semibold">
          {view === 'request' ? 'Secure Access' : 'Verify Your Identity'}
        </p>
        
        {view === 'request' ? (
          /* VIEW 1: REQUEST CODE */
          <form onSubmit={handleRequestCode} className="space-y-6">
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
              {loading ? 'Sending Code...' : 'Send 6-Digit Code'}
            </button>
          </form>
        ) : (
          /* VIEW 2: VERIFY CODE */
          <form onSubmit={handleVerifyCode} className="space-y-6">
            <p className="text-xs text-gray-500 mb-4">
              Enter the 6-digit code sent to <br/><strong>{email}</strong>
            </p>
            <div>
              <input
                type="text"
                placeholder="000000"
                value={token}
                required
                maxLength="6"
                onChange={(e) => setToken(e.target.value)}
                className="w-full border-b-2 border-[#D2BA92] py-3 outline-none focus:border-[#8C1515] transition-colors text-center text-2xl tracking-[0.5em] font-mono"
              />
            </div>
            <button
              disabled={loading}
              className="w-full bg-[#8C1515] text-white py-3 rounded-md font-bold hover:bg-[#6b1010] transition-all shadow-md disabled:opacity-50"
            >
              {loading ? 'Verifying...' : 'Log In'}
            </button>
            <button 
              type="button"
              onClick={() => setView('request')}
              className="text-xs text-[#4D4F53] hover:underline"
            >
              Back to email entry
            </button>
          </form>
        )}
        
        <p className="mt-8 text-[10px] text-gray-400 uppercase tracking-tighter">
          Authorized use only. Stanford Law School Information Technology.
        </p>
      </div>
    </div>
  );
}