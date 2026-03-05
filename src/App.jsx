import React, { useEffect, useState } from 'react';
import { supabase } from './lib/supabaseClient';
import { LayoutDashboard, User, Settings, Plus, Search, Clock, AlertCircle, CheckCircle2, Trash2, LogOut, ShieldCheck } from 'lucide-react';
import Auth from './Auth';

// Helper placed outside for performance
const getPriorityStyles = (priority) => {
  switch (priority?.toLowerCase()) {
    case 'high': return 'bg-red-50 text-red-700 border-red-200';
    case 'medium': return 'bg-amber-50 text-amber-700 border-amber-200';
    case 'low': return 'bg-slate-50 text-slate-600 border-slate-200';
    default: return 'bg-gray-50 text-gray-600 border-gray-200';
  }
};

function App() {
  const [statusFilter, setStatusFilter] = useState('open'); 
  const [session, setSession] = useState(null);
  const [userRole, setUserRole] = useState('user'); 
  const [tickets, setTickets] = useState([]);
  const [authLoading, setAuthLoading] = useState(true);
  const [dataLoading, setDataLoading] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [filter, setFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [activities, setActivities] = useState([]);

  // 1. AUTH LOGIC
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setAuthLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (!session) setUserRole('user'); 
      setAuthLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  // 2. ROLE FETCHING
  useEffect(() => {
    if (!session) return;
    async function getProfile() {
      const { data, error } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', session.user.id)
        .single();
      if (data) setUserRole(data.role);
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
        console.error(err);
      } finally {
        setDataLoading(false);
      }
    }
    fetchTickets();
  }, [session]);

// --- ACTIVITY LOG ---
  useEffect(() => {
    if (!selectedTicket) {
      setActivities([]);
      return;
    }

    async function fetchActivities() {
      const { data, error } = await supabase
        .from('ticket_activities')
        .select('*')
        .eq('ticket_id', selectedTicket.id)
        .order('created_at', { ascending: false });
      
      if (error) console.error("Error fetching logs:", error);
      else setActivities(data || []);
    }
    fetchActivities();
  }, [selectedTicket]); // This ensures it runs whenever a user clicks a different ticket

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

  // 1. Insert the Ticket
  const { data, error } = await supabase.from('tickets').insert([newTicket]).select();
  
  if (error) {
    showToast(error.message, "error");
  } else if (data && data[0]) {
    // 2. Insert the Activity Log entry
    await supabase.from('ticket_activities').insert([
      { 
        ticket_id: data[0].id, 
        user_id: session?.user?.id, 
        action_text: "Ticket created" 
      }
    ]);

    // 3. Update UI
    setTickets([data[0], ...tickets]);
    setIsModalOpen(false);
    showToast("Support request submitted!");
  }
};

 const handleResolve = async (id) => {
  // 1. Update the ticket status in Supabase
  const { error } = await supabase
    .from('tickets')
    .update({ status: 'resolved' })
    .eq('id', id);

  if (error) {
    // Use our Toast instead of a generic alert
    showToast("Permission Denied: Only Staff/Admins can resolve.", "error");
    console.error(error);
  } else {
    // 2. LOG THE ACTIVITY: Record who resolved it and when
    // We don't need to "await" this if we want the UI to feel instant, 
    // but it's safer to include it here.
    await supabase.from('ticket_activities').insert([
      { 
        ticket_id: id, 
        user_id: session?.user?.id, 
        action_text: "Status changed to Resolved" 
      }
    ]);

    // 3. UPDATE LOCAL STATE: Keep the UI in sync
    setTickets(tickets.map(t => t.id === id ? { ...t, status: 'resolved' } : t));
    
    // 4. SYNC SIDEBAR: Update the sidebar if it's currently open
    if (selectedTicket?.id === id) {
      setSelectedTicket({ ...selectedTicket, status: 'resolved' });
    }

    showToast("Ticket marked as Resolved");
  }
};

  const handleDelete = async (id) => {
    if (window.confirm("Delete ticket permanently?")) {
      const { error } = await supabase.from('tickets').delete().eq('id', id);
      if (error) alert("Permission Denied.");
      else {
        setTickets(tickets.filter(t => t.id !== id));
        if (selectedTicket?.id === id) setSelectedTicket(null);
      }
    }
  };

  const filteredTickets = (tickets || []).filter(t => {
    const matchesPriority = filter === 'all' || t.priority === filter;
    const matchesSearch = (t.title || "").toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || t.status === statusFilter;
    return matchesPriority && matchesSearch && matchesStatus;
  });

  if (authLoading) return <div className="min-h-screen bg-[#F4F4F4] flex items-center justify-center font-serif italic text-[#8C1515]">Verifying...</div>;
  if (!session) return <Auth />;

  return (
    <div className="min-h-screen bg-[#F4F4F4] flex flex-col font-sans text-[#2E2D29]">
      <div className="bg-[#8C1515] h-[30px] flex items-center px-8 text-white text-[13px] font-semibold uppercase tracking-wide">Stanford University</div>

      <div className="flex flex-1 overflow-hidden">
        <aside className="w-64 bg-[#2E2D29] text-white flex flex-col shadow-xl">
          <div className="p-6">
            <h2 className="text-[#D2BA92] text-xl font-serif font-bold italic">SLS IT Portal</h2>
            <div className="mt-2 flex items-center gap-2 px-2 py-1 bg-white/10 rounded border border-white/20 w-fit">
              <ShieldCheck size={12} className="text-[#D2BA92]" />
              <span className="text-[10px] uppercase font-black text-[#D2BA92]">{userRole} Access</span>
            </div>
          </div>
          <nav className="flex-1 px-4"><div className="flex items-center gap-3 p-3 bg-[#8C1515] rounded-lg text-white font-bold cursor-default"><LayoutDashboard size={20} /> Dashboard</div></nav>
          <div className="p-4 border-t border-white/10">
            <button onClick={() => supabase.auth.signOut()} className="flex items-center gap-3 w-full p-3 text-gray-400 hover:text-red-400 transition"><LogOut size={20} /> Sign Out</button>
          </div>
        </aside>

        <main className="flex-1 flex flex-col overflow-y-auto">
          <header className="bg-white border-b border-[#D2BA92] p-6 flex justify-between items-center shadow-sm">
            <div className="flex items-center gap-4 flex-1">
              <div className="flex items-center gap-3 bg-[#F4F4F4] px-4 py-2 rounded-full border border-[#D2BA92] w-72">
                <Search size={16} className="text-[#4D4F53]" />
                <input type="text" placeholder="Search..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="bg-transparent border-none outline-none text-xs w-full" />
              </div>
              <div className="flex bg-[#F4F4F4] p-1 rounded-md border border-[#D2BA92]">
                {['open', 'resolved', 'all'].map(s => (
                  <button key={s} onClick={() => setStatusFilter(s)} className={`px-3 py-1 text-[10px] font-bold uppercase rounded ${statusFilter === s ? 'bg-white shadow-sm text-[#8C1515]' : 'text-gray-400'}`}>{s}</button>
                ))}
              </div>
            </div>
            <div className="flex items-center gap-6">
              <div className="text-right">
                <h1 className="text-[#8C1515] text-xl font-serif font-bold">Support Tickets</h1>
                <p className="text-[#4D4F53] text-[10px] font-black uppercase tracking-widest leading-none">IT Services</p>
              </div>
              <button onClick={() => setIsModalOpen(true)} className="bg-[#8C1515] text-white px-6 py-2.5 rounded font-bold hover:bg-[#6b1010] flex items-center gap-2 shadow-lg transition-transform active:scale-95"><Plus size={18} /> New Request</button>
            </div>
          </header>

          <div className="px-8 py-6 grid grid-cols-4 gap-4 max-w-5xl mx-auto w-full">
            <div className="bg-white border border-[#D2BA92] p-4 rounded-xl shadow-sm"><p className="text-[10px] text-gray-500 uppercase font-bold mb-1">Total</p><p className="text-2xl font-serif font-bold">{stats.total}</p></div>
            <div onClick={() => setStatusFilter('open')} className={`p-4 rounded-xl shadow-sm border cursor-pointer transition-all ${statusFilter === 'open' ? 'border-[#007C92] bg-[#007C92]/5' : 'bg-white border-[#D2BA92]'}`}><p className="text-[10px] text-gray-500 uppercase font-bold mb-1">Active</p><p className="text-2xl font-serif font-bold text-[#007C92]">{stats.open}</p></div>
            <div className={`p-4 rounded-xl shadow-sm border ${stats.high > 0 ? 'bg-red-50 border-[#8C1515]' : 'bg-white border-[#D2BA92]'}`}><p className="text-[10px] text-[#8C1515] uppercase font-bold mb-1">High Priority</p><p className="text-2xl font-serif font-bold text-[#8C1515]">{stats.high}</p></div>
            {/* TYPO FIXED HERE: onClick */}
            <div onClick={() => setStatusFilter('resolved')} className={`p-4 rounded-xl shadow-sm border cursor-pointer transition-all ${statusFilter === 'resolved' ? 'border-green-600 bg-green-50' : 'bg-white border-[#D2BA92]'}`}><p className="text-[10px] text-gray-500 uppercase font-bold mb-1">Resolved</p><p className="text-2xl font-serif font-bold text-green-600">{stats.resolved}</p></div>
          </div>

          <section className="p-8 max-w-5xl mx-auto w-full">
            {dataLoading ? <div className="text-center p-12 animate-pulse italic font-serif text-gray-400">Loading Stanford Data...</div> : 
            <div className="space-y-4">
              {filteredTickets.map(ticket => (
                <div key={ticket.id} onClick={() => setSelectedTicket(ticket)} className={`bg-white border border-[#D2BA92] border-l-4 rounded-xl p-5 shadow-sm hover:shadow-md transition-all cursor-pointer ${selectedTicket?.id === ticket.id ? 'ring-2 ring-[#8C1515]/20 bg-[#F4F4F4]' : ''} ${ticket.priority === 'high' ? 'border-l-[#8C1515]' : 'border-l-[#D2BA92]'}`}>
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-4">
                      <div className={`p-2 rounded-lg ${ticket.status === 'resolved' ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-600'}`}>{ticket.status === 'resolved' ? <CheckCircle2 size={24} /> : <AlertCircle size={24} />}</div>
                      <div><h3 className={`font-bold font-serif text-lg ${ticket.status === 'resolved' ? 'text-gray-300 line-through' : ''}`}>{ticket.title}</h3><span className="text-[10px] text-gray-400 font-bold uppercase">SLS-{ticket.id}</span></div>
                    </div>
                    <div className="flex items-center gap-4">
                      {(userRole === 'agent' || userRole === 'admin') && ticket.status !== 'resolved' && <button onClick={(e) => { e.stopPropagation(); handleResolve(ticket.id); }} className="text-[10px] font-bold text-[#007C92] border border-[#007C92] px-4 py-1.5 rounded hover:bg-[#007C92] hover:text-white uppercase transition">Resolve</button>}
                      {userRole === 'admin' && <button onClick={(e) => { e.stopPropagation(); handleDelete(ticket.id); }} className="text-gray-300 hover:text-red-600 p-1"><Trash2 size={18} /></button>}
                    </div>
                  </div>
                </div>
              ))}
            </div>}
          </section>
        </main>

        {/* SIDEBAR */}
{selectedTicket && (
  <aside className="w-96 bg-white border-l border-[#D2BA92] shadow-2xl flex flex-col animate-in slide-in-from-right duration-300">
    {/* Header */}
    <div className="p-6 border-b border-[#D2BA92] flex justify-between items-center bg-[#F4F4F4]">
      <h2 className="font-serif font-bold text-[#8C1515]">Ticket Details</h2>
      <button 
        onClick={() => setSelectedTicket(null)} 
        className="text-[10px] font-bold uppercase text-gray-400 hover:text-black transition-colors"
      >
        Close
      </button>
    </div>

    {/* Content Area */}
    <div className="p-8 space-y-6 overflow-y-auto flex-1 custom-scrollbar">
      {/* Priority & Title */}
      <div>
        <span className={`text-[9px] font-black uppercase px-2 py-1 rounded border ${getPriorityStyles(selectedTicket.priority)}`}>
          {selectedTicket.priority} Priority
        </span>
        <h1 className="text-2xl font-serif font-bold text-[#2E2D29] leading-tight mt-3">
          {selectedTicket.title}
        </h1>
        <p className="text-[10px] text-gray-400 mt-1 font-mono uppercase tracking-widest">Ref: SLS-{selectedTicket.id}</p>
      </div>

      {/* Description */}
      <div className="space-y-2">
        <label className="text-[10px] font-black text-[#4D4F53] uppercase tracking-widest">Description</label>
        <p className="text-sm text-[#2E2D29] leading-relaxed bg-[#F4F4F4] p-4 rounded-xl italic border border-[#D2BA92]/30">
          "{selectedTicket.description || 'No description provided.'}"
        </p>
      </div>

      {/* Status Grid */}
      <div className="grid grid-cols-2 gap-4 pt-4 border-t border-gray-100">
        <div className="text-[10px] font-black uppercase text-gray-400 tracking-widest">
          Status
          <p className={`mt-1 text-sm capitalize font-bold ${selectedTicket.status === 'resolved' ? 'text-green-600' : 'text-[#8C1515]'}`}>
            {selectedTicket.status}
          </p>
        </div>
        <div className="text-[10px] font-black uppercase text-gray-400 tracking-widest">
          Created
          <p className="mt-1 text-sm text-black font-medium">
            {new Date(selectedTicket.created_at).toLocaleDateString()}
          </p>
        </div>
      </div>

      {/* --- ACTIVITY LOG SECTION --- */}
      <div className="pt-6 border-t border-gray-100">
        <label className="text-[10px] font-black text-[#4D4F53] uppercase tracking-widest block mb-4">
          Activity Log
        </label>
        <div className="space-y-5">
          {activities.length === 0 ? (
            <p className="text-xs text-gray-400 italic">No activity recorded yet.</p>
          ) : (
            activities.map((log) => (
              <div key={log.id} className="flex gap-3 items-start animate-in fade-in slide-in-from-left-2 duration-500">
                {/* Timeline Dot */}
                <div className="mt-1.5 w-1.5 h-1.5 rounded-full bg-[#D2BA92] shrink-0 shadow-[0_0_0_2px_rgba(210,186,146,0.2)]" />
                <div>
                  <p className="text-xs text-[#2E2D29] font-semibold leading-none">
                    {log.action_text}
                  </p>
                  <p className="text-[10px] text-gray-400 mt-1.5 flex items-center gap-1">
                    <Clock size={10} />
                    {new Date(log.created_at).toLocaleString([], { 
                      month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' 
                    })}
                  </p>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Quick Actions */}
      <div className="pt-8 space-y-3">
        {selectedTicket.status !== 'resolved' && (userRole === 'agent' || userRole === 'admin') && (
          <button 
            onClick={() => handleResolve(selectedTicket.id)} 
            className="w-full bg-[#007C92] text-white py-3.5 rounded-xl font-bold text-[10px] uppercase tracking-widest hover:bg-[#005a6a] shadow-lg transition-all active:scale-[0.98]"
          >
            Mark Issue as Resolved
          </button>
        )}
        {userRole === 'admin' && (
          <button 
            onClick={() => handleDelete(selectedTicket.id)} 
            className="w-full border border-red-100 text-red-500 py-3.5 rounded-xl font-bold text-[10px] uppercase tracking-widest hover:bg-red-50 transition-colors"
          >
            Delete Ticket Permanently
          </button>
        )}
      </div>
    </div>
  </aside>
)}
      </div>

      {/* MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-[#2E2D29]/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden border border-[#D2BA92]">
            <div className="bg-[#8C1515] p-8 text-white"><h2 className="text-2xl font-serif font-bold">New Support Request</h2><p className="text-xs opacity-80 uppercase tracking-widest mt-1 font-semibold">Stanford Law School IT</p></div>
            <form onSubmit={handleCreateTicket} className="p-8 space-y-6">
              <div><label className="block text-xs font-bold text-[#4D4F53] uppercase mb-2">Issue Summary</label><input name="title" required className="w-full border-b-2 border-[#D2BA92] py-2 focus:border-[#8C1515] outline-none" /></div>
              <div><label className="block text-xs font-bold text-[#4D4F53] uppercase mb-2">Detailed Description</label><textarea name="description" rows="3" className="w-full border border-[#D2BA92] rounded-xl p-4 focus:ring-1 focus:ring-[#8C1515] outline-none bg-gray-50" /></div>
              <div><label className="block text-xs font-bold text-[#4D4F53] uppercase mb-2">Priority Level</label><select name="priority" defaultValue="medium" className="w-full bg-gray-50 border border-[#D2BA92] p-3 rounded-xl outline-none"><option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option></select></div>
              <div className="flex justify-end gap-4 pt-4"><button type="button" onClick={() => setIsModalOpen(false)} className="px-6 py-2 text-xs font-bold uppercase text-gray-400">Cancel</button><button type="submit" className="bg-[#8C1515] text-white px-10 py-3 rounded-xl font-bold uppercase text-xs">Submit Ticket</button></div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;