import React, { useEffect, useState } from 'react';
import { supabase } from './lib/supabaseClient';
import { LayoutDashboard, User, Settings, Plus, Search, Clock, AlertCircle, CheckCircle2, Trash2, LogOut } from 'lucide-react';
import Auth from './Auth';

function App() {
  const [session, setSession] = useState(null);
  const [tickets, setTickets] = useState([]);
  const [authLoading, setAuthLoading] = useState(true); // Tracking Auth specifically
  const [dataLoading, setDataLoading] = useState(false); // Tracking Database specifically
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [filter, setFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');

  // 1. AUTH LOGIC - Only runs once on mount
  useEffect(() => {
    // Initial session check
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setAuthLoading(false);
    });

    // Listen for changes (like clicking the Magic Link)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setAuthLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  // 2. DATA FETCHING LOGIC - Re-runs if session changes
  useEffect(() => {
    if (!session) return;

    async function fetchTickets() {
      setDataLoading(true);
      const { data, error } = await supabase
        .from('tickets')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching tickets:', error);
      } else {
        setTickets(data || []);
      }
      setDataLoading(false);
    }
    fetchTickets();
  }, [session]);

  // 3. HANDLERS
  const handleCreateTicket = async (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const newTicket = {
      title: formData.get('title'),
      description: formData.get('description'),
      priority: formData.get('priority'),
      status: 'open'
      user_id: session.user.id // Add this to ensure the database knows who owns the ticket
    };

    const { data, error } = await supabase.from('tickets').insert([newTicket]).select();

    if (error) {
      console.error('Error creating ticket:', error.message);
    } else {
      setTickets([data[0], ...tickets]);
      setIsModalOpen(false);
    }
  };

  const handleResolve = async (id) => {
    const { error } = await supabase
      .from('tickets')
      .update({ status: 'resolved' })
      .eq('id', id);

    if (error) {
      console.error(error);
    } else {
      setTickets(tickets.map(t => t.id === id ? { ...t, status: 'resolved' } : t));
    }
  };

  const handleDelete = async (id) => {
    if (window.confirm("Are you sure you want to remove this ticket from the SLS records?")) {
      const { error } = await supabase.from('tickets').delete().eq('id', id);
      if (error) console.error('Error deleting ticket:', error.message);
      else setTickets(tickets.filter(t => t.id !== id));
    }
  };

  const getPriorityStyles = (priority) => {
    switch (priority?.toLowerCase()) {
      case 'high': return 'bg-red-50 text-red-700 border-red-200';
      case 'medium': return 'bg-amber-50 text-amber-700 border-amber-200';
      case 'low': return 'bg-slate-50 text-slate-600 border-slate-200';
      default: return 'bg-gray-50 text-gray-600 border-gray-200';
    }
  };

  // 4. FILTERING LOGIC
  const filteredTickets = tickets.filter(t => {
    const matchesPriority = filter === 'all' || t.priority === filter;
    const matchesSearch = (t.title || "").toLowerCase().includes(searchTerm.toLowerCase());
    return matchesPriority && matchesSearch;
  });

  // 5. THE GATEKEEPER
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

  // 6. MAIN RENDER
  return (
    <div className="min-h-screen bg-[#F4F4F4] flex flex-col font-sans text-[#2E2D29]">
      <div className="bg-[#8C1515] h-[30px] flex items-center px-8 text-white text-[13px] font-semibold uppercase tracking-wide">
        Stanford University
      </div>

      <div className="flex flex-1">
        <aside className="w-64 bg-[#2E2D29] text-white flex flex-col shadow-xl">
          <div className="p-6">
            <h2 className="text-[#D2BA92] text-xl font-serif font-bold italic">SLS IT Portal</h2>
          </div>
          <nav className="flex-1 px-4 space-y-2">
            <div className="flex items-center gap-3 p-3 bg-[#8C1515] rounded-lg text-white font-bold cursor-default">
              <LayoutDashboard size={20} /> Dashboard
            </div>
            <div className="flex items-center gap-3 p-3 text-gray-400 hover:text-white cursor-pointer transition">
              <User size={20} /> My Profile
            </div>
          </nav>
          <div className="p-4 border-t border-white/10">
            <button 
              onClick={() => supabase.auth.signOut()}
              className="flex items-center gap-3 w-full p-3 text-gray-400 hover:text-red-400 transition"
            >
              <LogOut size={20} /> Sign Out
            </button>
          </div>
        </aside>

        <main className="flex-1 flex flex-col">
          <header className="bg-white border-b border-[#D2BA92] p-6 flex justify-between items-center shadow-sm">
            <div className="flex items-center gap-4 flex-1">
              <div className="flex items-center gap-3 bg-[#F4F4F4] px-4 py-2 rounded-full border border-[#D2BA92] w-72 focus-within:ring-2 focus-within:ring-[#8C1515]/20 transition-all">
                <Search size={16} className="text-[#4D4F53]" />
                <input 
                  type="text" 
                  placeholder="Search tickets..." 
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="bg-transparent border-none outline-none text-xs w-full placeholder-[#4D4F53]"
                />
              </div>
              <div className="flex items-center gap-2 px-3 py-2 border-l border-gray-200">
                <span className="text-[10px] font-bold text-[#4D4F53] uppercase">Filter:</span>
                <select 
                  value={filter}
                  onChange={(e) => setFilter(e.target.value)}
                  className="bg-transparent text-xs font-bold text-[#2E2D29] outline-none"
                >
                  <option value="all">All Priority</option>
                  <option value="high">High</option>
                  <option value="medium">Medium</option>
                  <option value="low">Low</option>
                </select>
              </div>
            </div>
            
            <div className="flex items-center gap-6">
              <div className="text-right">
                <h1 className="text-[#8C1515] text-xl font-serif font-bold leading-tight">Support Tickets</h1>
                <p className="text-[#4D4F53] text-[10px] font-black uppercase tracking-widest">IT Services</p>
              </div>
              <button 
                onClick={() => setIsModalOpen(true)}
                className="bg-[#8C1515] text-white px-6 py-2.5 rounded font-bold hover:bg-[#6b1010] flex items-center gap-2 transition shadow-lg active:scale-95">
                <Plus size={18} /> New Request
              </button>
            </div>
          </header>

          <section className="p-8 max-w-5xl mx-auto w-full">
            {dataloading ? (
              <div className="flex justify-center p-12"><p className="text-gray-500 animate-pulse font-serif italic">Accessing Stanford Secure Database...</p></div>
            ) : filteredTickets.length === 0 ? (
              <div className="text-center p-16 bg-white rounded-2xl border-2 border-dashed border-[#D2BA92]/50 shadow-sm">
                <p className="text-[#4D4F53] font-serif italic text-lg">
                  {filter === 'all' 
                    ? "No active tickets found. All systems operational." 
                    : `No ${filter} priority tickets found matching your search.`}
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {filteredTickets.map((ticket) => (
                  <div key={ticket.id} className={`bg-white border border-[#D2BA92] border-l-4 rounded-xl p-5 shadow-sm transition-all hover:shadow-md ${
                    ticket.priority === 'high' ? 'border-l-[#8C1515]' : ticket.priority === 'medium' ? 'border-l-amber-500' : 'border-l-slate-300'
                  }`}>
                    <div className="flex justify-between items-center">
                      <div className="flex items-center gap-4">
                        <div className={`p-2 rounded-lg ${ticket.status === 'resolved' ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-600'}`}>
                          {ticket.status === 'resolved' ? <CheckCircle2 size={24} /> : <AlertCircle size={24} />}
                        </div>
                        <div>
                          <div className="flex items-center gap-3 mb-1">
                            <h3 className={`font-bold font-serif text-lg ${ticket.status === 'resolved' ? 'text-gray-400 line-through' : 'text-[#2E2D29]'}`}>
                              {ticket.title}
                            </h3>
                            {ticket.status !== 'resolved' && (
                              <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded border ${getPriorityStyles(ticket.priority)}`}>
                                {ticket.priority}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-4">
                            <span className="text-[10px] text-[#4D4F53] font-bold uppercase bg-gray-100 px-2 py-0.5 rounded tracking-tighter">SLS-{ticket.id}</span>
                            <span className="text-[10px] text-gray-400 flex items-center gap-1 font-medium"><Clock size={12}/> {new Date(ticket.created_at).toLocaleDateString()}</span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-4">
                        {ticket.status !== 'resolved' ? (
                          <button onClick={() => handleResolve(ticket.id)} className="text-[10px] font-bold text-[#007C92] border border-[#007C92] px-4 py-1.5 rounded hover:bg-[#007C92] hover:text-white transition uppercase tracking-widest">Mark Resolved</button>
                        ) : (
                          <span className="bg-green-50 text-green-700 text-[10px] font-black px-4 py-1.5 rounded-full border border-green-200 uppercase tracking-widest">Resolved</span>
                        )}
                        <button onClick={() => handleDelete(ticket.id)} className="text-gray-300 hover:text-red-600 transition-colors p-1"><Trash2 size={18} /></button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </main>
      </div>

      {/* MODAL SECTION */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-[#2E2D29]/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden border border-[#D2BA92]">
            <div className="bg-[#8C1515] p-8 text-white relative">
              <h2 className="text-2xl font-serif font-bold">New Support Request</h2>
              <p className="text-xs opacity-80 uppercase tracking-widest mt-1 font-semibold">Stanford Law School IT</p>
            </div>
            <form onSubmit={handleCreateTicket} className="p-8 space-y-6">
              <div>
                <label className="block text-xs font-bold text-[#4D4F53] uppercase mb-2 tracking-tighter">Issue Summary</label>
                <input name="title" required placeholder="Brief title of the issue" className="w-full border-b-2 border-[#D2BA92] py-2 focus:border-[#8C1515] outline-none transition-colors text-lg" />
              </div>
              <div>
                <label className="block text-xs font-bold text-[#4D4F53] uppercase mb-2 tracking-tighter">Description</label>
                <textarea name="description" rows="3" placeholder="Provide details about the request..." className="w-full border border-[#D2BA92] rounded-xl p-4 focus:ring-1 focus:ring-[#8C1515] outline-none bg-gray-50 transition-all" />
              </div>
              <div>
                <label className="block text-xs font-bold text-[#4D4F53] uppercase mb-2 tracking-tighter">Priority Level</label>
                <select name="priority" className="w-full bg-gray-50 border border-[#D2BA92] p-3 rounded-xl outline-none focus:ring-2 focus:ring-[#8C1515]/10">
                  <option value="low">Low - Routine inquiry</option>
                  <option value="medium">Medium - Normal issue</option>
                  <option value="high">High - Urgent / Disruption</option>
                </select>
              </div>
              <div className="flex justify-end gap-4 pt-4">
                <button type="button" onClick={() => setIsModalOpen(false)} className="px-6 py-2 text-[#4D4F53] font-bold hover:text-black transition uppercase text-xs tracking-widest">Cancel</button>
                <button type="submit" className="bg-[#8C1515] text-white px-10 py-3 rounded-xl font-bold hover:bg-[#6b1010] shadow-xl transition-all active:scale-95 text-sm uppercase tracking-widest">Submit Ticket</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;