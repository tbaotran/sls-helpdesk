import React, { useEffect, useState } from 'react';
import { supabase } from './lib/supabaseClient';
import { LayoutDashboard, User, Settings, Plus, Search, Clock, AlertCircle, CheckCircle2, Trash2, LogOut, ShieldCheck, Download } from 'lucide-react';
import Auth from './Auth';

/** * Stanford Brand Guidelines:
 * font-sans: Source Sans 3 (UI/Body)
 * font-serif: Source Serif 4 (Headlines/Accents)
 */
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
  const [toast, setToast] = useState(null);
  const [lastLogin, setLastLogin] = useState(null);
  const [sortBy, setSortBy] = useState('newest');

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const exportToCSV = async () => {
    showToast("Preparing report...");
    const { data: resolutionLogs } = await supabase
      .from('ticket_activities')
      .select('ticket_id, actor_name')
      .eq('action_text', 'Status changed to Resolved');

    const resolverMap = {};
    resolutionLogs?.forEach(log => {
      resolverMap[log.ticket_id] = log.actor_name;
    });

    const headers = ["Ticket ID", "Title", "Priority", "Status", "Created At", "Resolved By"];
    const rows = tickets.map(t => {
      const agent = t.status === 'resolved' ? (resolverMap[t.id] || "System") : "";
      return [`SLS-${t.id}`, t.title.replace(/,/g, ""), t.priority, t.status, new Date(t.created_at).toLocaleDateString(), agent];
    });

    const csvContent = [headers, ...rows].map(e => e.join(",")).join("\n");
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `SLS_IT_Report_${new Date().toLocaleDateString()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast("Report downloaded");
  };

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

  useEffect(() => {
    if (!session) return;
    async function getProfile() {
      const { data } = await supabase.from('profiles').select('role, last_login').eq('id', session.user.id).single();
      if (data) { 
        setUserRole(data.role);
        setLastLogin(data.last_login); 
      }
    }
    getProfile();
  }, [session]);

  useEffect(() => {
    if (!session) return;
    async function fetchTickets() {
      setDataLoading(true);
      try {
        const { data, error } = await supabase.from('tickets').select('*').order('created_at', { ascending: false });
        if (error) throw error;
        setTickets(data || []);
      } catch (err) { console.error(err); } finally { setDataLoading(false); }
    }
    fetchTickets();
  }, [session]);

  useEffect(() => {
    if (!selectedTicket) {
      setActivities([]);
      return;
    }
    async function fetchActivities() {
      const { data, error } = await supabase.from('ticket_activities').select('*').eq('ticket_id', selectedTicket.id).order('created_at', { ascending: false });
      if (error) console.error("Error fetching logs:", error);
      else setActivities(data || []);
    }
    fetchActivities();
    const channel = supabase.channel(`logs-${selectedTicket.id}`).on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'ticket_activities', filter: `ticket_id=eq.${selectedTicket.id}` }, (payload) => {
      setActivities(prev => [payload.new, ...prev]);
    }).subscribe();
    return () => supabase.removeChannel(channel);
  }, [selectedTicket]);

  const stats = {
    total: tickets.length,
    high: tickets.filter(t => t.priority === 'high' && t.status !== 'resolved').length,
    open: tickets.filter(t => t.status !== 'resolved').length,
    resolved: tickets.filter(t => t.status === 'resolved').length
  };

  const handleCreateTicket = async (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const actorName = session?.user?.email?.split('@')[0];
    const newTicket = { title: formData.get('title'), description: formData.get('description'), priority: formData.get('priority'), status: 'open', user_id: session?.user?.id };
    const { data, error } = await supabase.from('tickets').insert([newTicket]).select();
    if (error) { showToast(error.message, "error"); } else if (data && data[0]) {
      await supabase.from('ticket_activities').insert([{ ticket_id: data[0].id, user_id: session?.user?.id, action_text: "Ticket created", actor_name: actorName }]);
      setTickets([data[0], ...tickets]);
      setIsModalOpen(false);
      showToast("Support request submitted!");
    }
  };

  const handleResolve = async (id) => {
    const { error } = await supabase.from('tickets').update({ status: 'resolved' }).eq('id', id);
    if (error) { showToast("Permission Denied", "error"); } else {
      const actorName = session?.user?.email?.split('@')[0];
      await supabase.from('ticket_activities').insert([{ ticket_id: id, user_id: session?.user?.id, action_text: "Status changed to Resolved", actor_name: actorName }]);
      setTickets(tickets.map(t => t.id === id ? { ...t, status: 'resolved' } : t));
      if (selectedTicket?.id === id) setSelectedTicket({ ...selectedTicket, status: 'resolved' });
      showToast(`Ticket resolved by ${actorName}`);
    }
  };

  const handleReopen = async (id) => {
    const { error } = await supabase.from('tickets').update({ status: 'open' }).eq('id', id);
    if (error) { showToast("Permission Denied", "error"); } else {
      const actorName = session?.user?.email?.split('@')[0];
      await supabase.from('ticket_activities').insert([{ ticket_id: id, user_id: session?.user?.id, action_text: "Ticket re-opened", actor_name: actorName }]);
      setTickets(tickets.map(t => t.id === id ? { ...t, status: 'open' } : t));
      if (selectedTicket?.id === id) setSelectedTicket({ ...selectedTicket, status: 'open' });
      showToast(`Ticket re-opened by ${actorName}`);
    }
  };

  const handleDelete = async (id) => {
    if (window.confirm("Delete ticket permanently?")) {
      const { error } = await supabase.from('tickets').delete().eq('id', id);
      if (error) showToast("Permission Denied", "error");
      else {
        setTickets(tickets.filter(t => t.id !== id));
        if (selectedTicket?.id === id) setSelectedTicket(null);
        showToast("Ticket removed from records");
      }
    }
  };

  const filteredTickets = (tickets || [])
    .filter(t => {
      const matchesPriority = filter === 'all' || t.priority === filter;
      const matchesSearch = (t.title || "").toLowerCase().includes(searchTerm.toLowerCase());
      const matchesStatus = statusFilter === 'all' || t.status === statusFilter;
      return matchesPriority && matchesSearch && matchesStatus;
    })
    .sort((a, b) => {
      if (sortBy === 'priority') {
        const priorityWeight = { high: 3, medium: 2, low: 1 };
        return priorityWeight[b.priority] - priorityWeight[a.priority] || new Date(b.created_at) - new Date(a.created_at);
      }
      return new Date(b.created_at) - new Date(a.created_at);
    });

  if (authLoading) return <div className="min-h-screen bg-[#F4F4F4] flex items-center justify-center font-serif italic text-[#8C1515]">Verifying...</div>;
  if (!session) return <Auth />;

  return (
    <div className="min-h-screen bg-[#F4F4F4] flex flex-col font-sans text-[#2E2D29] antialiased">
      {/* Google Fonts Import */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Source+Sans+3:ital,wght@0,400;0,600;0,700;1,400&family=Source+Serif+4:ital,wght@0,400;0,600;0,700;1,400&display=swap');
        .font-sans { font-family: 'Source Sans 3', sans-serif !important; }
        .font-serif { font-family: 'Source Serif 4', serif !important; }
      `}</style>

      {/* Identity Bar */}
      <div className="bg-[#8C1515] h-[30px] flex items-center px-8 text-white text-[13px] font-bold uppercase tracking-wide shrink-0 font-sans">
        Stanford University
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <aside className="w-64 bg-[#2E2D29] text-white flex flex-col shadow-xl shrink-0 font-sans">
          <div className="p-6">
            <h2 className="text-[#D2BA92] text-xl font-serif font-bold italic tracking-tight">SLS IT Portal</h2>
            <div className="mt-2 flex items-center gap-2 px-2 py-1 bg-white/10 rounded border border-white/20 w-fit">
              <ShieldCheck size={12} className="text-[#D2BA92]" />
              <span className="text-[10px] uppercase font-bold tracking-wider">{userRole} Access</span>
            </div>
          </div>
          <nav className="flex-1 px-4 space-y-2">
            <div className="flex items-center gap-3 p-3 bg-[#8C1515] rounded-lg text-white font-bold cursor-default"><LayoutDashboard size={20} /> Dashboard</div>
            {(userRole === 'admin' || userRole === 'agent') && (
              <button onClick={exportToCSV} className="flex items-center gap-3 w-full p-3 text-gray-400 hover:text-[#D2BA92] hover:bg-white/5 transition rounded-lg font-bold">
                <Download size={20} /> Export Report
              </button>
            )}
          </nav>
          <div className="p-4 border-t border-white/10">
            <div className="px-3 mb-4">
              <p className="text-[9px] uppercase font-bold text-gray-500 tracking-[0.2em] mb-1">System Access</p>
              <div className="flex items-center gap-2 text-gray-400">
                <Clock size={12} />
                <span className="text-[10px] font-medium italic">Last login: {lastLogin ? new Date(lastLogin).toLocaleString() : 'First session'}</span>
              </div>
            </div>
            <button onClick={() => supabase.auth.signOut()} className="flex items-center gap-3 w-full p-3 text-gray-400 hover:text-red-400 transition font-bold"><LogOut size={20} /> Sign Out</button>
          </div>
        </aside>

        {/* Main Dashboard */}
        <main className="flex-1 flex flex-col overflow-y-auto font-sans">
          <header className="bg-white border-b border-[#D2BA92] p-6 flex justify-between items-center shadow-sm shrink-0">
            <div className="flex items-center gap-4 flex-1">
              <div className="flex items-center gap-3 bg-[#F4F4F4] px-4 py-2 rounded-full border border-[#D2BA92] w-64">
                <Search size={16} className="text-[#4D4F53]" />
                <input type="text" placeholder="Search..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="bg-transparent border-none outline-none text-xs w-full" />
              </div>
              <div className="flex bg-[#F4F4F4] p-1 rounded-md border border-[#D2BA92]">
                {['open', 'resolved', 'all'].map(s => (
                  <button key={s} onClick={() => setStatusFilter(s)} className={`px-4 py-1.5 text-[11px] font-bold uppercase rounded transition-all ${statusFilter === s ? 'bg-white shadow-md text-[#8C1515]' : 'text-gray-400'}`}>{s}</button>
                ))}
              </div>
              <div className="flex items-center gap-2 pl-4 border-l border-gray-200">
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Sort:</span>
                <select value={sortBy} onChange={(e) => setSortBy(e.target.value)} className="bg-transparent text-[11px] font-bold text-[#8C1515] outline-none cursor-pointer uppercase">
                  <option value="newest">Newest</option>
                  <option value="priority">Priority</option>
                </select>
              </div>
            </div>
            <div className="flex items-center gap-6">
              <div className="text-right">
                <h1 className="text-[#8C1515] text-2xl font-serif font-bold leading-tight">Support Tickets</h1>
                <p className="text-[#4D4F53] text-[10px] font-bold uppercase tracking-widest leading-none">IT Services</p>
              </div>
              <button onClick={() => setIsModalOpen(true)} className="bg-[#8C1515] text-white px-6 py-3 rounded font-bold hover:bg-[#6b1010] flex items-center gap-2 shadow-lg transition active:scale-95"><Plus size={18} /> New Request</button>
            </div>
          </header>

          <div className="px-8 py-8 grid grid-cols-4 gap-6 max-w-6xl mx-auto w-full shrink-0">
            <div className="bg-white border border-[#D2BA92] p-5 rounded-xl shadow-sm"><p className="text-[11px] text-gray-500 uppercase font-bold mb-1">Total</p><p className="text-3xl font-serif font-bold">{stats.total}</p></div>
            <div onClick={() => setStatusFilter('open')} className={`p-5 rounded-xl shadow-sm border cursor-pointer transition-all ${statusFilter === 'open' ? 'border-[#007C92] bg-[#007C92]/5' : 'bg-white border-[#D2BA92]'}`}><p className="text-[11px] text-gray-500 uppercase font-bold mb-1">Active</p><p className="text-3xl font-serif font-bold text-[#007C92]">{stats.open}</p></div>
            <div onClick={() => { setSortBy('priority'); setStatusFilter('open'); }} className={`p-5 rounded-xl shadow-sm border cursor-pointer transition-all ${stats.high > 0 ? 'bg-red-50 border-[#8C1515]' : 'bg-white border-[#D2BA92]'}`}><p className="text-[11px] text-[#8C1515] uppercase font-bold mb-1">High Priority</p><p className="text-3xl font-serif font-bold text-[#8C1515]">{stats.high}</p></div>
            <div onClick={() => setStatusFilter('resolved')} className={`p-5 rounded-xl shadow-sm border cursor-pointer transition-all ${statusFilter === 'resolved' ? 'border-green-600 bg-green-50' : 'bg-white border-[#D2BA92]'}`}><p className="text-[11px] text-gray-500 uppercase font-bold mb-1">Resolved</p><p className="text-3xl font-serif font-bold text-green-600">{stats.resolved}</p></div>
          </div>

          <section className="p-8 max-w-6xl mx-auto w-full flex-grow">
            {dataLoading ? <div className="text-center p-12 animate-pulse italic font-serif text-gray-400">Loading Stanford Data...</div> : 
            <div className="space-y-4">
              {filteredTickets.map(ticket => (
                <div key={ticket.id} onClick={() => setSelectedTicket(ticket)} className={`bg-white border border-[#D2BA92] border-l-8 rounded-xl p-6 shadow-sm hover:shadow-md transition-all cursor-pointer ${selectedTicket?.id === ticket.id ? 'ring-2 ring-[#8C1515]/30 bg-[#F4F4F4]' : ''} ${ticket.priority === 'high' && ticket.status !== 'resolved' ? 'border-l-[#8C1515]' : 'border-l-[#D2BA92]'}`}>
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-5">
                      <div className={`p-2.5 rounded-lg ${ticket.status === 'resolved' ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-600'}`}>{ticket.status === 'resolved' ? <CheckCircle2 size={28} /> : <AlertCircle size={28} />}</div>
                      <div>
                        <div className="flex items-center gap-3"><h3 className={`font-bold font-serif text-xl ${ticket.status === 'resolved' ? 'text-gray-300 line-through' : ''}`}>{ticket.title}</h3>{ticket.status !== 'resolved' && <span className={`text-[9px] font-bold uppercase px-2 py-0.5 rounded-full border ${getPriorityStyles(ticket.priority)}`}>{ticket.priority}</span>}</div>
                        <span className="text-[11px] text-gray-400 font-bold uppercase tracking-widest">SLS-{ticket.id}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      {(userRole === 'agent' || userRole === 'admin') && ticket.status !== 'resolved' && <button onClick={(e) => { e.stopPropagation(); handleResolve(ticket.id); }} className="text-[11px] font-bold text-[#007C92] border-2 border-[#007C92] px-5 py-2 rounded hover:bg-[#007C92] hover:text-white uppercase transition-all">Resolve</button>}
                      {userRole === 'admin' && <button onClick={(e) => { e.stopPropagation(); handleDelete(ticket.id); }} className="text-gray-300 hover:text-red-600 p-1.5 transition-colors"><Trash2 size={22} /></button>}
                    </div>
                  </div>
                </div>
              ))}
            </div>}
          </section>

          {/* PIXEL-PERFECT STANFORD FOOTER */}
          <footer className="bg-[#8C1515] text-white py-14 px-10 mt-16 border-t-[6px] border-[#D2BA92] shrink-0">
            <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center md:items-start gap-14">
              <div className="shrink-0 mb-6 md:mb-0">
                <a href="https://www.stanford.edu" className="hover:no-underline border-none">
                  <div className="font-serif text-white flex flex-col">
                    <span className="text-[48px] font-bold leading-[0.65] tracking-[-0.08em] italic">Stanford</span>
                    <span className="text-[32px] font-bold leading-[1.3] tracking-[-0.02em] italic">University</span>
                  </div>
                </a>
              </div>
              <div className="flex-1 flex flex-col gap-6 text-center md:text-left">
                <nav aria-label="global footer menu">
                  <ul className="flex flex-wrap justify-center md:justify-start gap-x-10 gap-y-3 text-[17px] font-bold">
                    <li><a href="https://www.stanford.edu" className="hover:underline">Stanford Home</a></li>
                    <li><a href="https://visit.stanford.edu/plan/maps.html" className="hover:underline">Maps & Directions</a></li>
                    <li><a href="https://www.stanford.edu/search/" className="hover:underline">Search Stanford</a></li>
                    <li><a href="https://emergency.stanford.edu" className="hover:underline">Emergency Info</a></li>
                  </ul>
                </nav>
                <nav aria-label="policy links">
                  <ul className="flex flex-wrap justify-center md:justify-start gap-x-8 gap-y-3 text-[15px] text-white/90">
                    <li><a href="https://www.stanford.edu/site/terms/" className="hover:underline">Terms of Use</a></li>
                    <li><a href="https://www.stanford.edu/site/privacy/" className="hover:underline">Privacy</a></li>
                    <li><a href="https://www.stanford.edu/site/copyright/" className="hover:underline">Copyright</a></li>
                    <li><a href="https://adminguide.stanford.edu/chapter-1/subsections-5/trademarks" className="hover:underline">Trademarks</a></li>
                    <li><a href="https://exploredegrees.stanford.edu/nonacademicregulations/nondiscrimination/" className="hover:underline">Non-Discrimination</a></li>
                    <li><a href="https://uit.stanford.edu/accessibility/policy" className="hover:underline">Accessibility</a></li>
                  </ul>
                </nav>
                <div className="text-[15px] text-white/90 mt-2">
                  <p>© Stanford University. &nbsp; Stanford, California 94305.</p>
                </div>
              </div>
            </div>
          </footer>
        </main>

        {/* Selected Ticket Sidebar */}
        {selectedTicket && (
          <aside className="w-[450px] bg-white border-l-2 border-[#D2BA92] shadow-2xl flex flex-col animate-in slide-in-from-right duration-300 shrink-0 font-sans">
            <div className="p-8 border-b-2 border-[#D2BA92] flex justify-between items-center bg-[#F4F4F4]">
              <h2 className="font-serif font-bold text-2xl text-[#8C1515]">Ticket Details</h2>
              <button onClick={() => setSelectedTicket(null)} className="text-[11px] font-bold uppercase text-gray-400 hover:text-black tracking-widest">Close</button>
            </div>
            <div className="p-10 space-y-8 overflow-y-auto flex-1">
              <div><span className={`text-[10px] font-bold uppercase px-3 py-1 rounded border ${getPriorityStyles(selectedTicket.priority)} tracking-widest`}>{selectedTicket.priority} Priority</span><h1 className="text-3xl font-serif font-bold text-[#2E2D29] leading-tight mt-4">{selectedTicket.title}</h1></div>
              <div className="space-y-3"><label className="text-[11px] font-bold text-[#4D4F53] uppercase tracking-widest">Description</label><p className="text-base text-[#2E2D29] leading-relaxed bg-[#F4F4F4] p-6 rounded-xl italic border border-[#D2BA92]/30 shadow-inner">"{selectedTicket.description || 'No description provided.'}"</p></div>
              <div className="grid grid-cols-2 gap-6 pt-6 border-t-2 border-gray-100"><div className="text-[11px] font-bold uppercase text-gray-400 tracking-widest">Status<p className={`mt-2 text-base capitalize font-bold ${selectedTicket.status === 'resolved' ? 'text-green-600' : 'text-[#8C1515]'}`}>{selectedTicket.status}</p></div><div className="text-[11px] font-bold uppercase text-gray-400 tracking-widest">Created<p className="mt-2 text-base text-black font-bold">{new Date(selectedTicket.created_at).toLocaleDateString()}</p></div></div>
              <div className="pt-8 border-t-2 border-gray-100">
                <label className="text-[11px] font-bold text-[#4D4F53] uppercase tracking-widest block mb-6">Activity Log</label>
                <div className="space-y-6">{activities.length === 0 ? <p className="text-sm text-gray-400 italic">No activity recorded yet.</p> : activities.map((log) => (
                  <div key={log.id} className="flex gap-4 items-start animate-in fade-in slide-in-from-left-2 duration-500">
                    <div className="mt-2 w-2 h-2 rounded-full bg-[#D2BA92] shrink-0" />
                    <div><p className="text-sm text-[#2E2D29] font-bold">{log.action_text}</p><p className="text-[11px] text-gray-500 mt-1 uppercase font-bold tracking-tighter">By: {log.actor_name || 'System'}</p><p className="text-[11px] text-gray-400 mt-2 flex items-center gap-1.5 font-bold"><Clock size={12} />{new Date(log.created_at).toLocaleString()}</p></div>
                  </div>
                ))}</div>
              </div>
              <div className="pt-10 space-y-4">
                {selectedTicket.status === 'open' && (userRole === 'agent' || userRole === 'admin') && <button onClick={() => handleResolve(selectedTicket.id)} className="w-full bg-[#007C92] text-white py-4 rounded-xl font-bold text-[12px] uppercase tracking-widest hover:bg-[#005a6a] shadow-xl transition-all">Mark Resolved</button>}
                {selectedTicket.status === 'resolved' && (userRole === 'agent' || userRole === 'admin') && <button onClick={() => handleReopen(selectedTicket.id)} className="w-full border-2 border-[#007C92] text-[#007C92] py-4 rounded-xl font-bold text-[12px] uppercase tracking-widest hover:bg-[#007C92]/5 transition-all">Re-open Ticket</button>}
                {userRole === 'admin' && <button onClick={() => handleDelete(selectedTicket.id)} className="w-full border-2 border-red-100 text-red-500 py-4 rounded-xl font-bold text-[12px] uppercase tracking-widest hover:bg-red-50 transition-all">Delete Permanently</button>}
              </div>
            </div>
          </aside>
        )}
      </div>

      {/* Toast Feedback */}
      {toast && (
        <div className="fixed bottom-10 right-10 z-[100] animate-in fade-in slide-in-from-bottom-6">
          <div className={`flex items-center gap-4 px-8 py-5 rounded-2xl shadow-2xl border-2 ${toast.type === 'error' ? 'bg-red-50 border-red-200 text-[#8C1515]' : 'bg-white border-[#D2BA92] text-[#2E2D29]'}`}>
            {toast.type === 'error' ? <AlertCircle size={24} /> : <CheckCircle2 size={24} className="text-green-600" />}
            <p className="text-base font-serif font-bold italic">{toast.message}</p>
          </div>
        </div>
      )}

      {/* New Ticket Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-[#2E2D29]/85 backdrop-blur-md flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden border-2 border-[#D2BA92]">
            <div className="bg-[#8C1515] p-10 text-white font-serif"><h2 className="text-3xl font-bold italic">New Support Request</h2></div>
            <form onSubmit={handleCreateTicket} className="p-10 space-y-8 font-sans">
              <div><label className="block text-xs font-bold text-[#4D4F53] uppercase tracking-widest mb-3">Issue Summary</label><input name="title" required className="w-full border-b-2 border-[#D2BA92] py-3 focus:border-[#8C1515] outline-none text-lg font-bold" /></div>
              <div><label className="block text-xs font-bold text-[#4D4F53] uppercase tracking-widest mb-3">Detailed Description</label><textarea name="description" rows="4" className="w-full border border-[#D2BA92] rounded-2xl p-5 focus:ring-2 focus:ring-[#8C1515] outline-none bg-gray-50 text-base" /></div>
              <div><label className="block text-xs font-bold text-[#4D4F53] uppercase tracking-widest mb-3">Priority Level</label><select name="priority" defaultValue="medium" className="w-full bg-gray-50 border border-[#D2BA92] p-4 rounded-2xl outline-none font-bold"><option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option></select></div>
              <div className="flex justify-end gap-6 pt-6"><button type="button" onClick={() => setIsModalOpen(false)} className="px-8 py-3 text-xs font-bold uppercase tracking-widest text-gray-400">Cancel</button><button type="submit" className="bg-[#8C1515] text-white px-12 py-4 rounded-2xl font-bold uppercase tracking-widest text-sm shadow-xl hover:bg-[#6b1010] transition-all">Submit Ticket</button></div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;