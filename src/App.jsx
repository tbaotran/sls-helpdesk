import React, { useEffect, useState, useRef } from 'react';
import { supabase } from './lib/supabaseClient';
import { LayoutDashboard, User, Settings, Plus, Search, Clock, AlertCircle, CheckCircle2, Trash2, LogOut, ShieldCheck, Download, Menu, X, RefreshCcw } from 'lucide-react';
import Auth from './Auth';

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
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [activities, setActivities] = useState([]);
  const [toast, setToast] = useState(null);
  const [lastLogin, setLastLogin] = useState(null);
  const [sortBy, setSortBy] = useState('newest');

  // Pull-to-Refresh State
  const [pullDistance, setPullDistance] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const touchStart = useRef(0);

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const fetchTickets = async () => {
    setDataLoading(true);
    try {
      const { data, error } = await supabase.from('tickets').select('*').order('created_at', { ascending: false });
      if (error) throw error;
      setTickets(data || []);
    } catch (err) { console.error(err); } finally { setDataLoading(false); }
  };

  // TOUCH HANDLERS FOR PULL-TO-REFRESH
  const handleTouchStart = (e) => {
    // Only track if we are at the top of the scrollable area
    const scrollContainer = e.currentTarget;
    if (scrollContainer.scrollTop === 0) {
      touchStart.current = e.targetTouches[0].pageY;
    } else {
      touchStart.current = 0;
    }
  };

  const handleTouchMove = (e) => {
    if (touchStart.current === 0) return;
    const touchY = e.targetTouches[0].pageY;
    const distance = touchY - touchStart.current;

    if (distance > 0 && distance < 100) {
      setPullDistance(distance);
    }
  };

  const handleTouchEnd = async () => {
    if (pullDistance > 70) {
      setIsRefreshing(true);
      await fetchTickets();
      showToast("Dashboard Updated");
      setIsRefreshing(false);
    }
    setPullDistance(0);
    touchStart.current = 0;
  };

  const exportToCSV = async () => {
    showToast("Preparing report...");
    const { data: resolutionLogs } = await supabase
      .from('ticket_activities')
      .select('ticket_id, actor_name')
      .eq('action_text', 'Status changed to Resolved');

    const resolverMap = {};
    resolutionLogs?.forEach(log => { resolverMap[log.ticket_id] = log.actor_name; });

    const headers = ["Ticket ID", "Title", "Priority", "Status", "Created At", "Resolved By"];
    const rows = tickets.map(t => [
      `SLS-${t.id}`, t.title.replace(/,/g, ""), t.priority, t.status, 
      new Date(t.created_at).toLocaleDateString(), 
      t.status === 'resolved' ? (resolverMap[t.id] || "System") : ""
    ]);

    const csvContent = [headers, ...rows].map(e => e.join(",")).join("\n");
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `SLS_IT_Report_${new Date().toLocaleDateString()}.csv`);
    link.click();
    showToast("Report downloaded");
  };

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setAuthLoading(false);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setAuthLoading(false);
    });
    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (session) fetchTickets();
  }, [session]);

  const filteredTickets = (tickets || [])
    .filter(t => {
      const matchesSearch = (t.title || "").toLowerCase().includes(searchTerm.toLowerCase());
      const matchesStatus = statusFilter === 'all' || t.status === statusFilter;
      return matchesSearch && matchesStatus;
    })
    .sort((a, b) => {
      if (sortBy === 'priority') {
        const p = { high: 3, medium: 2, low: 1 };
        return p[b.priority] - p[a.priority] || new Date(b.created_at) - new Date(a.created_at);
      }
      return new Date(b.created_at) - new Date(a.created_at);
    });

  if (authLoading) return <div className="min-h-screen flex items-center justify-center font-serif italic text-[#8C1515]">Verifying...</div>;
  if (!session) return <Auth />;

  return (
    <div className="min-h-screen bg-[#F4F4F4] flex flex-col font-sans text-[#2E2D29] antialiased">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Source+Sans+3:ital,wght@0,400;0,600;0,700;1,400&family=Source+Serif+4:ital,wght@0,400;0,600;0,700;1,400&display=swap');
        .font-sans { font-family: 'Source Sans 3', sans-serif !important; }
        .font-serif { font-family: 'Source Serif 4', serif !important; }
      `}</style>

      {/* Identity Bar */}
      <div className="bg-[#8C1515] h-[30px] flex items-center px-4 md:px-8 text-white text-[11px] md:text-[13px] font-bold uppercase tracking-wide shrink-0 z-50">
        Stanford University
      </div>

      <div className="flex flex-1 overflow-hidden relative">
        {/* Mobile Menu Overlay */}
        {isSidebarOpen && <div className="fixed inset-0 bg-black/50 z-40 lg:hidden" onClick={() => setIsSidebarOpen(false)} />}

        {/* Sidebar */}
        <aside className={`fixed lg:relative w-64 h-full bg-[#2E2D29] text-white flex flex-col z-50 transition-transform lg:translate-x-0 ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
          <div className="p-6 flex justify-between items-center lg:block">
            <h2 className="text-[#D2BA92] text-xl font-serif font-bold italic">SLS IT Portal</h2>
            <button className="lg:hidden" onClick={() => setIsSidebarOpen(false)}><X size={24} /></button>
          </div>
          <nav className="flex-1 px-4 space-y-2">
            <div className="flex items-center gap-3 p-3 bg-[#8C1515] rounded-lg text-white font-bold"><LayoutDashboard size={20} /> Dashboard</div>
            {(userRole === 'admin' || userRole === 'agent') && <button onClick={exportToCSV} className="flex items-center gap-3 w-full p-3 text-gray-400 hover:text-[#D2BA92] hover:bg-white/5 transition rounded-lg font-bold"><Download size={20} /> Export Report</button>}
          </nav>
          <div className="p-4 border-t border-white/10">
             <button onClick={() => supabase.auth.signOut()} className="flex items-center gap-3 w-full p-3 text-gray-400 hover:text-red-400 transition font-bold"><LogOut size={20} /> Sign Out</button>
          </div>
        </aside>

        {/* Main Content */}
        <main 
          className="flex-1 flex flex-col overflow-y-auto w-full relative"
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        >
          {/* PULL INDICATOR */}
          <div 
            className="flex justify-center items-center overflow-hidden transition-all duration-200 bg-gray-100" 
            style={{ height: pullDistance > 0 ? `${pullDistance}px` : (isRefreshing ? '50px' : '0px') }}
          >
            <RefreshCcw size={20} className={`text-[#8C1515] ${isRefreshing ? 'animate-spin' : ''}`} style={{ transform: `rotate(${pullDistance * 3}deg)` }} />
          </div>

          <header className="bg-white border-b border-[#D2BA92] p-4 md:p-6 flex flex-col md:flex-row justify-between items-center gap-4 sticky top-0 z-30 shadow-sm">
            <div className="flex items-center gap-4 w-full md:w-auto">
              <button className="lg:hidden p-2 bg-gray-50 rounded border border-gray-200" onClick={() => setIsSidebarOpen(true)}><Menu size={20} /></button>
              <div className="flex items-center gap-3 bg-[#F4F4F4] px-4 py-2 rounded-full border border-[#D2BA92] flex-1 md:w-64">
                <Search size={16} />
                <input type="text" placeholder="Search..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="bg-transparent border-none outline-none text-xs w-full font-sans" />
              </div>
            </div>
            
            <div className="flex items-center justify-between w-full md:w-auto gap-4">
              <select value={sortBy} onChange={(e) => setSortBy(e.target.value)} className="bg-transparent text-[11px] font-bold text-[#8C1515] uppercase border border-[#D2BA92] px-2 py-1 rounded">
                <option value="newest">Recent</option><option value="priority">Priority</option>
              </select>
              <button onClick={() => setIsModalOpen(true)} className="bg-[#8C1515] text-white px-4 py-2 rounded font-bold shadow-lg text-sm flex items-center gap-2">
                <Plus size={18} /> New Request
              </button>
            </div>
          </header>

          <div className="px-4 md:px-8 py-6 grid grid-cols-2 lg:grid-cols-4 gap-4 w-full">
            <div className="bg-white border border-[#D2BA92] p-4 rounded-xl"><p className="text-[10px] uppercase font-bold text-gray-400">Total</p><p className="text-2xl font-serif font-bold">{stats.total}</p></div>
            <div onClick={() => setStatusFilter('open')} className={`p-4 rounded-xl border cursor-pointer ${statusFilter === 'open' ? 'bg-[#007C92]/5 border-[#007C92]' : 'bg-white border-[#D2BA92]'}`}><p className="text-[10px] uppercase font-bold text-gray-400">Open</p><p className="text-2xl font-serif font-bold text-[#007C92]">{stats.open}</p></div>
            <div className={`p-4 rounded-xl border ${stats.high > 0 ? 'bg-red-50 border-[#8C1515]' : 'bg-white border-[#D2BA92]'}`}><p className="text-[10px] uppercase font-bold text-[#8C1515]">High</p><p className="text-2xl font-serif font-bold text-[#8C1515]">{stats.high}</p></div>
            <div onClick={() => setStatusFilter('resolved')} className={`p-4 rounded-xl border cursor-pointer ${statusFilter === 'resolved' ? 'bg-green-50 border-green-600' : 'bg-white border-[#D2BA92]'}`}><p className="text-[10px] uppercase font-bold text-gray-400">Fixed</p><p className="text-2xl font-serif font-bold text-green-600">{stats.resolved}</p></div>
          </div>

          <section className="px-4 md:px-8 pb-10 flex-grow">
            <div className="space-y-3">
              {filteredTickets.map(ticket => (
                <div key={ticket.id} onClick={() => setSelectedTicket(ticket)} className={`bg-white border-l-4 rounded-xl p-4 shadow-sm cursor-pointer border ${ticket.priority === 'high' ? 'border-l-[#8C1515]' : 'border-l-[#D2BA92]'}`}>
                  <div className="flex justify-between items-center gap-3">
                    <div className="flex items-center gap-3 truncate">
                      {ticket.status === 'resolved' ? <CheckCircle2 className="text-green-600 shrink-0" size={20} /> : <AlertCircle className="text-red-600 shrink-0" size={20} />}
                      <h3 className={`font-bold font-serif text-base md:text-lg truncate ${ticket.status === 'resolved' ? 'text-gray-300 line-through' : ''}`}>{ticket.title}</h3>
                    </div>
                    <span className="text-[9px] font-bold text-gray-400 shrink-0 uppercase tracking-widest">SLS-{ticket.id}</span>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* BRANDED FOOTER */}
          <footer className="bg-[#8C1515] text-white py-12 px-6 border-t-[5px] border-[#D2BA92] shrink-0">
            <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center md:items-start gap-10">
              <div className="shrink-0 text-center md:text-left">
                <div className="font-serif text-white flex flex-col">
                  <span className="text-[42px] font-bold leading-[0.7] tracking-[-0.07em] italic">Stanford</span>
                  <span className="text-[28px] font-bold leading-[1.3] tracking-[-0.02em] italic">University</span>
                </div>
              </div>
              <div className="flex-1 flex flex-col gap-4 text-center md:text-left text-[14px]">
                <nav><ul className="flex flex-wrap justify-center md:justify-start gap-x-8 font-bold"><li><a href="#" className="hover:underline">Stanford Home</a></li><li><a href="#" className="hover:underline">Emergency Info</a></li></ul></nav>
                <p className="text-white/80 italic">© Stanford University, Stanford, California 94305.</p>
              </div>
            </div>
          </footer>
        </main>

        {/* DETAIL SIDEBAR / MOBILE MODAL */}
        {selectedTicket && (
          <aside className="fixed inset-0 lg:relative lg:w-[450px] bg-white border-l-2 border-[#D2BA92] z-[60] flex flex-col animate-in slide-in-from-right">
            <div className="p-6 border-b flex justify-between items-center bg-gray-50">
              <h2 className="font-serif font-bold text-lg text-[#8C1515]">Ticket Details</h2>
              <button onClick={() => setSelectedTicket(null)} className="p-2 bg-gray-200 rounded-full lg:bg-transparent"><X size={24} /></button>
            </div>
            <div className="p-6 md:p-10 space-y-6 overflow-y-auto flex-1 font-sans">
              <span className={`text-[10px] font-bold uppercase px-2 py-1 rounded border ${getPriorityStyles(selectedTicket.priority)}`}>{selectedTicket.priority} Priority</span>
              <h1 className="text-2xl md:text-3xl font-serif font-bold text-[#2E2D29] leading-tight">{selectedTicket.title}</h1>
              <p className="text-sm md:text-base text-gray-600 bg-gray-50 p-5 rounded-xl border italic">"{selectedTicket.description}"</p>
              <div className="pt-6 border-t"><button onClick={() => setSelectedTicket(null)} className="w-full border-2 border-gray-200 py-3 rounded-xl font-bold lg:hidden uppercase text-xs">Close Details</button></div>
            </div>
          </aside>
        )}
      </div>

      {toast && (
        <div className="fixed bottom-10 left-1/2 -translate-x-1/2 md:translate-x-0 md:left-auto md:right-10 z-[100] w-[90%] md:w-auto">
          <div className="bg-white border-2 border-[#D2BA92] px-6 py-4 rounded-2xl shadow-2xl flex items-center gap-3">
             <CheckCircle2 size={20} className="text-green-600" />
             <p className="text-sm font-serif font-bold italic">{toast.message}</p>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;