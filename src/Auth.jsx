import React, { useState, useEffect } from 'react';
import { supabase } from './lib/supabaseClient';

export default function Auth() {
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);

  // DETECT RECOVERY SESSION (Password Reset Link)
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === "PASSWORD_RECOVERY") {
        const newPassword = prompt("Please enter your new secure password:");
        if (newPassword && newPassword.length >= 6) {
          const { error } = await supabase.auth.updateUser({ password: newPassword });
          if (error) alert("Error updating password: " + error.message);
          else alert("Password updated successfully! You may now sign in.");
        } else if (newPassword) {
          alert("Password must be at least 6 characters.");
        }
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleForgotPassword = async () => {
    if (!email) {
      alert("Please enter your email address first.");
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: window.location.origin, // Sends them back to your Vercel URL
    });
    if (error) alert(error.message);
    else alert("Check your email for the update link!");
    setLoading(false);
  };

  const handleAuth = async (e) => {
    e.preventDefault();
    const cleanEmail = email.toLowerCase().trim();

    if (isSignUp) {
      const isAllowedDomain = cleanEmail.endsWith('@stanford.edu') || cleanEmail.endsWith('@law.stanford.edu');
      if (!isAllowedDomain) {
        alert("Access Denied: Registration is restricted to @stanford.edu or @law.stanford.edu email addresses.");
        return;
      }
    }

    setLoading(true);
    
    if (isSignUp) {
      const { error } = await supabase.auth.signUp({
        email: cleanEmail,
        password,
      });
      if (error) alert(error.message);
      else alert('Check your email for the confirmation link!');
    } else {
      const { error } = await supabase.auth.signInWithPassword({
        email: cleanEmail,
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
            className="w-full border-b-2 border-[#D2BA92] py-2 outline-none focus:border-[#8C1515] transition-colors text-center font-sans"
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            required={!loading}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full border-b-2 border-[#D2BA92] py-2 outline-none focus:border-[#8C1515] transition-colors text-center font-sans"
          />
          
          <button
            disabled={loading}
            className="w-full bg-[#8C1515] text-white py-3 rounded-md font-bold hover:bg-[#6b1010] transition-all shadow-md disabled:opacity-50 uppercase tracking-widest text-sm"
          >
            {loading ? 'Processing...' : isSignUp ? 'Create Account' : 'Sign In'}
          </button>
        </form>

        <div className="flex flex-col gap-4 mt-6">
          {!isSignUp && (
            <button 
              onClick={handleForgotPassword}
              className="text-[10px] text-[#8C1515] hover:underline uppercase font-bold tracking-widest"
            >
              Forgot Password?
            </button>
          )}

          <button 
            onClick={() => setIsSignUp(!isSignUp)}
            className="text-xs text-[#4D4F53] hover:text-[#8C1515] transition-colors uppercase font-bold tracking-widest"
          >
            {isSignUp ? 'Already have an account? Sign In' : 'Need an account? Sign Up'}
          </button>
        </div>
        
        <p className="mt-8 text-[10px] text-gray-400 uppercase tracking-tighter">
          Authorized use only. Stanford Law School Information Technology.
        </p>
      </div>
    </div>
  );
}