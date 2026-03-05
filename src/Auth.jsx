import React, { useState } from 'react';
import { supabase } from './lib/supabaseClient';

export default function Auth() {
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);

  const handleAuth = async (e) => {
    e.preventDefault();
    setLoading(true);
    
    if (isSignUp) {
      // Create a new user
      const { error } = await supabase.auth.signUp({
        email,
        password,
      });
      if (error) alert(error.message);
      else alert('Account created! You are now logged in.');
    } else {
      // Sign in existing user
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (error) alert(error.message);
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-[#F4F4F4] flex flex-col items-center justify-center p-4">
      <div className="bg-white border-t-4 border-[#8C1515] p-10 rounded-xl shadow-xl max-w-md w-full text-center">
        <h1 className="text-[#8C1515] text-3xl font-serif font-bold mb-2">SLS IT Portal</h1>
        <p className="text-[#4D4F53] text-sm uppercase tracking-widest mb-8 font-semibold">
          {isSignUp ? 'Create Staff Account' : 'Secure Login'}
        </p>
        
        <form onSubmit={handleAuth} className="space-y-4">
          <input
            type="email"
            placeholder="sunetid@stanford.edu"
            value={email}
            required
            onChange={(e) => setEmail(e.target.value)}
            className="w-full border-b-2 border-[#D2BA92] py-2 outline-none focus:border-[#8C1515] transition-colors text-center"
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            required
            onChange={(e) => setPassword(e.target.value)}
            className="w-full border-b-2 border-[#D2BA92] py-2 outline-none focus:border-[#8C1515] transition-colors text-center"
          />
          
          <button
            disabled={loading}
            className="w-full bg-[#8C1515] text-white py-3 rounded-md font-bold hover:bg-[#6b1010] transition-all shadow-md disabled:opacity-50"
          >
            {loading ? 'Processing...' : isSignUp ? 'Create Account' : 'Sign In'}
          </button>
        </form>

        <button 
          onClick={() => setIsSignUp(!isSignUp)}
          className="mt-6 text-xs text-[#4D4F53] hover:text-[#8C1515] transition-colors uppercase font-bold tracking-widest"
        >
          {isSignUp ? 'Already have an account? Sign In' : 'Need an account? Sign Up'}
        </button>
        
        <p className="mt-8 text-[10px] text-gray-400 uppercase tracking-tighter">
          Authorized use only. Stanford Law School Information Technology.
        </p>
      </div>
    </div>
  );
}