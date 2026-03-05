import React, { useEffect, useState } from 'react';
import { supabase } from './lib/supabaseClient';
import { LayoutDashboard, User, Settings, Plus, Search, Clock, AlertCircle, CheckCircle2, Trash2, LogOut, ShieldCheck } from 'lucide-react';
import Auth from './Auth';

function App() {
  const [statusFilter, setStatusFilter] = useState('open'); // Default to 'open' to focus on work
  const [session, setSession] = useState(null);
  const [userRole, setUserRole] = useState('user'); 
  const [tickets, setTickets] = useState([]);
  const [authLoading, setAuthLoading] = useState(true);
  const [dataLoading, setDataLoading] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [filter, setFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');

  // 1. AUTH LOGIC
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setAuthLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (!session) setUserRole('user'); // Reset role on sign out
      setAuthLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  // 2. ROLE FETCHING LOGIC
  useEffect(() => {
    if (!session) return;

    async function getProfile() {
      const { data, error } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', session.user.id)
        .single();
      
      if (data) setUserRole(data.role);
      if (error) console.error("Error fetching profile:", error.message);
    }
    
    getProfile();
  }, [session]);

  // 3. DATA FETCHING
  useEffect(() => {
    if (!session) return;

    async function fetchTickets() {
      setDataLoading(true);
      try {
        const { data, error } = await supabase
          .from('tickets')
          .select('*')
          .order('created_at', { ascending: false });

        if (error) throw error;
        setTickets(data || []);
      } catch (err) {
        console.error('Error fetching tickets:', err);
      } finally {
        setDataLoading(false);
      }
    }
    fetchTickets();
  }, [session]);

  // STATS CALCULATION
  const stats = {
    total: tickets.length,
    high: tickets.filter(t => t.priority === 'high' && t.status !== 'resolved').length,
    open: tickets.filter(t => t.status !== 'resolved').length,
    resolved: tickets.filter(t => t.status === 'resolved').length
  };

  // 4. HANDLERS
  const handleCreateTicket = async (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const newTicket = {
      title: formData.get('title'),
      description: formData.get('description'),
      priority: formData.get('priority'),
      status: 'open',
      user_id: session?.user?.id
    };

    const { data, error } = await supabase.from('tickets').insert([newTicket]).select();

    if (error) {
      alert('Error creating ticket: ' + error.message);
    } else {
      setTickets([data[0], ...tickets]);
      setIsModalOpen(false);
    }
  };

  const handleResolve = async (id) => {
    const { error } = await supabase.from('tickets').update({ status: 'resolved' }).eq('id', id);
    if (error) alert("Permission Denied: Only Agents/Admins can resolve.");
    else setTickets(tickets.map(t => t.id === id ? { ...t, status: 'resolved' } : t));
  };

  const handleDelete = async (id) => {
    if (window.confirm("Delete this ticket from SLS records?")) {
      const { error } = await supabase.from('tickets').delete().eq('id', id);
      if (error) alert("Permission Denied: Only Admins can delete.");
      else setTickets(tickets.filter(t => t.id !== id));
    }
  };

  const filteredTickets = (tickets || []).filter(t => {
  const matchesPriority = filter === 'all' || t.priority === filter;
  const matchesSearch = (t.title || "").toLowerCase().includes(searchTerm.toLowerCase());
  // NEW: Status Filter check
  const matchesStatus = statusFilter === 'all' || t.status === statusFilter;
  
  return matchesPriority && matchesSearch && matchesStatus;
  });

  if (authLoading) {
    return (
      <div className="min-h-screen bg-[#F4F4F4] flex items-center justify-center font-serif italic text-[#8C1515]">
        Verifying Stanford Credentials...
      </div>
    );
  }

  if (!session) {
    return <Auth />;
  }

  return (
    <div className="min-h-screen bg-[#F4F4F4] flex flex-col font-sans text-[#2E2D29]">
      <div className="bg-[#8C1515] h-[30px] flex items-center px-8 text-white text-[13px] font-semibold uppercase tracking-wide">
        Stanford University
      </div>

      <div className="flex flex-1">
        <aside className="w-64 bg-[#2E2D29] text-white flex flex-col shadow-xl">
          <div className="p-6">
            <h2 className="text-[#D2BA92] text-xl font-serif font-bold italic">SLS IT Portal</h2>
            <div className="mt-2 flex items-center gap-2 px-2 py-1 bg-white/10 rounded border border-white/20 w-fit">
              <ShieldCheck size={12} className="text-[#D2BA92]" />
              <span className="text-[10px] uppercase font-black tracking-tighter text-[#D2BA92]">{userRole} Access</span>
            </div>
          </div>
          <nav className="flex-1 px-4 space-y-2">
            <div className="flex items-center gap-3 p-3 bg-[#8C1515] rounded-lg text-white font-bold cursor-default">
              <LayoutDashboard size={20} /> Dashboard
            </div>
          </nav>
          <div className="p-4 border-t border-white/10">
            <button onClick={() => supabase.auth.signOut()} className="flex items-center gap-3 w-full p-3 text-gray-400 hover:text-red-400 transition">
              <LogOut size={20} /> Sign Out
            </button>
          </div>
        </aside>

        <main className="flex-1 flex flex-col">
          <header className="bg-white border-b border-[#D2BA92] p-6 flex justify-between items-center shadow-sm">
            <div className="flex items-center gap-4 flex-1">
              <div className="flex items-center gap-3 bg-[#F4F4F4] px-4 py-2 rounded-full border border-[#D2BA92] w-72 transition-all">
                <Search size={16} className="text-[#4D4F53]" />
                <input type="text" placeholder="Search tickets..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="bg-transparent border-none outline-none text-xs w-full" />
              </div>
            </div>
            
            <div className="flex items-center gap-2 px-3 py-2 border-l border-gray-200">
              <span className="text-[10px] font-bold text-[#4D4F53] uppercase">Status:</span>
            <div className="flex bg-[#F4F4F4] p-1 rounded-md border border-[#D2BA92]">
              <button 
                onClick={() => setStatusFilter('open')}
                className={`px-3 py-1 text-[10px] font-bold uppercase rounded ${statusFilter === 'open' ? 'bg-white shadow-sm text-[#8C1515]' : 'text-gray-400'}`}
              >
              Open
              </button>
              <button 
                onClick={() => setStatusFilter('resolved')}
                className={`px-3 py-1 text-[10px] font-bold uppercase rounded ${statusFilter === 'resolved' ? 'bg-white shadow-sm text-green-600' : 'text-gray-400'}`}
              >
              Resolved
              </button>
              <button 
                onClick={() => setStatusFilter('all')}
                className={`px-3 py-1 text-[10px] font-bold uppercase rounded ${statusFilter === 'all' ? 'bg-white shadow-sm text-[#2E2D29]' : 'text-gray-400'}`}
              >
              All
              </button>
            </div>
            </div>

            <div className="flex items-center gap-6 text-right">
              <div>
                <h1 className="text-[#8C1515] text-xl font-serif font-bold leading-tight">Support Tickets</h1>
                <p className="text-[#4D4F53] text-[10px] font-black uppercase tracking-widest">IT Services</p>
              </div>
              <button onClick={() => setIsModalOpen(true)} className="bg-[#8C1515] text-white px-6 py-2.5 rounded font-bold hover:bg-[#6b1010] flex items-center gap-2 shadow-lg">
                <Plus size={18} /> New Request
              </button>
            </div>
          </header>

          <div className="px-8 py-6 grid grid-cols-4 gap-4 max-w-5xl mx-auto w-full">
            <div className="bg-white border border-[#D2BA92] p-4 rounded-xl shadow-sm">
              <p className="text-[10px] font-black uppercase text-[#4D4F53] tracking-widest">Total</p>
              <p className="text-2xl font-serif font-bold">{stats.total}</p>
            </div>
            
            {/* 1. UPDATE: Clickable Active Card */}
            <div onClick={() => setStatusFilter('open')}
                className={`p-4 rounded-xl shadow-sm border cursor-pointer hover:shadow-md transition-all ${statusFilter === 'open' ? 'border-[#007C92] bg-[#007C92]/5' : 'bg-white border-[#D2BA92]'}`}
            >
            <p className="text-[10px] font-black uppercase text-[#4D4F53] tracking-widest">Active</p>
              <p className="text-2xl font-serif font-bold text-[#007C92]">{stats.open}</p>
            </div>
            <div className={`p-4 rounded-xl shadow-sm border ${stats.high > 0 ? 'bg-red-50 border-[#8C1515]' : 'bg-white border-[#D2BA92]'}`}>
              <p className="text-[10px] font-black uppercase text-[#8C1515] tracking-widest">High Priority</p>
              <p className="text-2xl font-serif font-bold text-[#8C1515]">{stats.high}</p>
            </div>
            
            {/* 2. UPDATE: Clickable Resolved Card */}
            <div conClick={() => setStatusFilter('resolved')}
                  className={`p-4 rounded-xl shadow-sm border cursor-pointer hover:shadow-md transition-all ${statusFilter === 'resolved' ? 'border-green-600 bg-green-50' : 'bg-white border-[#D2BA92]'}`}
              >         
              <p className="text-[10px] font-black uppercase text-[#4D4F53] tracking-widest">Resolved</p>
              <p className="text-2xl font-serif font-bold text-green-600">{stats.resolved}</p>
            </div>
          </div>
          
          <section className="p-8 max-w-5xl mx-auto w-full">
            {dataLoading ? (
              <div className="flex justify-center p-12"><p className="text-gray-500 animate-pulse font-serif italic">Accessing Stanford Database...</p></div>
            ) : filteredTickets.length === 0 ? (
              <div className="text-center p-16 bg-white rounded-2xl border-2 border-dashed border-[#D2BA92]/50 shadow-sm"><p className="text-[#4D4F53] font-serif italic text-lg">No tickets found.</p></div>
            ) : (
              <div className="space-y-4">
                {filteredTickets.map((ticket) => (
                  <div key={ticket.id} className="bg-white border border-[#D2BA92] border-l-4 rounded-xl p-5 shadow-sm hover:shadow-md transition-all">
                    <div className="flex justify-between items-center">
                      <div className="flex items-center gap-4">
                        <div className={`p-2 rounded-lg ${ticket.status === 'resolved' ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-600'}`}>
                          {ticket.status === 'resolved' ? <CheckCircle2 size={24} /> : <AlertCircle size={24} />}
                        </div>
                        <div>
                          <h3 className={`font-bold font-serif text-lg ${ticket.status === 'resolved' ? 'text-gray-400 line-through' : ''}`}>{ticket.title}</h3>
                          <span className="text-[10px] text-gray-400 font-bold uppercase">SLS-{ticket.id}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        {(userRole === 'agent' || userRole === 'admin') && ticket.status !== 'resolved' && (
                          <button onClick={() => handleResolve(ticket.id)} className="text-[10px] font-bold text-[#007C92] border border-[#007C92] px-4 py-1.5 rounded hover:bg-[#007C92] hover:text-white transition uppercase">Mark Resolved</button>
                        )}
                        {userRole === 'admin' && (
                          <button onClick={() => handleDelete(ticket.id)} className="text-gray-300 hover:text-red-600 p-1"><Trash2 size={18} /></button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </main>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-[#2E2D29]/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden border border-[#D2BA92]">
            <div className="bg-[#8C1515] p-8 text-white">
              <h2 className="text-2xl font-serif font-bold">New Support Request</h2>
              <p className="text-xs opacity-80 uppercase tracking-widest mt-1 font-semibold">Stanford Law School IT</p>
            </div>
            <form onSubmit={handleCreateTicket} className="p-8 space-y-6">
              <div>
                <label className="block text-xs font-bold text-[#4D4F53] uppercase mb-2">Issue Summary</label>
                <input name="title" required placeholder="e.g., Classroom Audio issues" className="w-full border-b-2 border-[#D2BA92] py-2 focus:border-[#8C1515] outline-none transition-colors text-lg" />
              </div>
              <div>
                <label className="block text-xs font-bold text-[#4D4F53] uppercase mb-2">Detailed Description</label>
                <textarea name="description" rows="3" placeholder="Please provide details..." className="w-full border border-[#D2BA92] rounded-xl p-4 focus:ring-1 focus:ring-[#8C1515] outline-none bg-gray-50 transition-all" />
              </div>
              <div>
                <label className="block text-xs font-bold text-[#4D4F53] uppercase mb-2">Priority Level</label>
                <select name="priority" defaultValue="medium" className="w-full bg-gray-50 border border-[#D2BA92] p-3 rounded-xl outline-none focus:ring-2 focus:ring-[#8C1515]/10">
                  <option value="low">Low - Routine inquiry</option>
                  <option value="medium">Medium - Standard support</option>
                  <option value="high">High - Urgent / Disruption</option>
                </select>
              </div>
              <div className="flex justify-end gap-4 pt-4">
                <button type="button" onClick={() => setIsModalOpen(false)} className="px-6 py-2 text-[#4D4F53] font-bold hover:text-black transition uppercase text-xs">Cancel</button>
                <button type="submit" className="bg-[#8C1515] text-white px-10 py-3 rounded-xl font-bold hover:bg-[#6b1010] shadow-xl transition-all active:scale-95 text-sm uppercase">Submit Ticket</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;