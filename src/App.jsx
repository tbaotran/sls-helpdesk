import React, { useEffect, useState, useRef } from 'react';
import { supabase } from './lib/supabaseClient';
import { LayoutDashboard, User, Settings, Plus, Search, Clock, AlertCircle, CheckCircle2, Trash2, LogOut, ShieldCheck, Download, Menu, X, RefreshCcw, Filter } from 'lucide-react';
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
  const [isModalOpen, setIsModalOpen] = useState(false); // Modal trigger
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [activities, setActivities] = useState([]);
  const [toast, setToast] = useState(null);
  const [lastLogin, setLastLogin] = useState(null);
  const [sortBy, setSortBy] = useState('newest');

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
    if (!session) return;
    async function getProfile() {
      const { data } = await supabase.from('profiles').select('role, last_login').eq('id', session.user.id).single();
      if (data) { 
        setUserRole(data.role || 'user');
        setLastLogin(data.last_login); 
      }
    }
    getProfile();
    fetchTickets();
  }, [session]);

  // RESTORED: Ticket Creation Logic
  const handleCreateTicket = async (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const actorName = session?.user?.email?.split('@')[0];
    const newTicket = { 
      title: formData.get('title'), 
      description: formData.get('description'), 
      priority: formData.get('priority'), 
      status: 'open', 
      user_id: session?.user?.id 
    };
    
    const { data, error } = await supabase.from('tickets').insert([newTicket]).select();
    if (error) { 
      showToast(error.message, "error"); 
    } else if (data && data[0]) {
      setTickets([data[0], ...tickets]);
      setIsModalOpen(false); // Close modal on success
      showToast("Support request submitted!");
    }
  };

  const handleResolve = async (id) => {
    const { error } = await supabase.from('tickets').update({ status: 'resolved' }).eq('id', id);
    if (!error) {
      setTickets(tickets.map(t => t.id === id ? { ...t, status: 'resolved' } : t));
      showToast("Ticket marked as resolved");
    }
  };

  const exportToCSV = async () => {
    const headers = ["ID", "Title", "Priority", "Status", "Created"];
    const rows = tickets.map(t => [`SLS-${t.id}`, t.title, t.priority, t.status, new Date(t.created_at).toLocaleDateString()]);
    const csvContent = [headers, ...rows].map(e => e.join(",")).join("\n");
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `SLS_Export_${new Date().toLocaleDateString()}.csv`;
    link.click();
  };

  // Pull-to-Refresh Handlers
  const handleTouchStart = (e) => { if (e.currentTarget.scrollTop === 0) touchStart.current = e.targetTouches[0].pageY; };
  const handleTouchMove = (e) => {
    if (touchStart.current === 0) return;
    const distance = e.targetTouches[0].pageY - touchStart.current;
    if (distance > 0 && distance < 100) setPullDistance(distance);
  };
  const handleTouchEnd = async () => {
    if (pullDistance > 70) { setIsRefreshing(true); await fetchTickets(); setIsRefreshing(false); showToast("Dashboard Refreshed"); }
    setPullDistance(0); touchStart.current = 0;
  };

  const stats = {
    total: tickets.length,
    high: tickets.filter(t => t.priority === 'high' && t.status !== 'resolved').length,
    open: tickets.filter(t => t.status !== 'resolved').length,
    resolved: tickets.filter(t => t.status === 'resolved').length
  };

  const filteredTickets = (tickets || [])
    .filter(t => {
      const matchesSearch = (t.title || "").toLowerCase().includes(searchTerm.toLowerCase());
      const matchesStatus = statusFilter === 'all' || t.status === statusFilter;
      return matchesSearch && matchesStatus;
    });

  if (authLoading) return <div className="min-h-screen flex items-center justify-center font-serif text-[#8C1515]">Loading Portal...</div>;
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
        {/* Sidebar */}
        <aside className={`fixed lg:relative w-64 h-full bg-[#2E2D29] text-white flex flex-col z-50 transition-transform lg:translate-x-0 ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
          <div className="p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-[#D2BA92] text-xl font-serif font-bold italic">SLS IT Portal</h2>
              <button className="lg:hidden" onClick={() => setIsSidebarOpen(false)}><X size={24} /></button>
            </div>
            <div className="flex items-center gap-2 px-2 py-1 bg-white/10 rounded border border-white/20 w-fit">
              <ShieldCheck size={12} className="text-[#D2BA92]" />
              <span className="text-[10px] uppercase font-bold tracking-widest text-[#D2BA92]">{userRole} Access</span>
            </div>
          </div>
          <nav className="flex-1 px-4 space-y-2">
            <div className="flex items-center gap-3 p-3 bg-[#8C1515] rounded-lg text-white font-bold"><LayoutDashboard size={20} /> Dashboard</div>
            {(userRole === 'admin' || userRole === 'agent') && <button onClick={exportToCSV} className="flex items-center gap-3 w-full p-3 text-gray-400 hover:text-[#D2BA92] transition font-bold uppercase text-[11px]"><Download size={18} /> Export Report</button>}
          </nav>
          <div className="p-4 border-t border-white/10">
            <div className="px-3 mb-4">
              <p className="text-[9px] uppercase font-bold text-gray-500 tracking-[0.2em] mb-1">Last Session</p>
              <div className="flex items-center gap-2 text-gray-400">
                <Clock size={12} /><span className="text-[10px] italic">{lastLogin ? new Date(lastLogin).toLocaleString() : 'Just now'}</span>
              </div>
            </div>
            <button onClick={() => supabase.auth.signOut()} className="flex items-center gap-3 w-full p-3 text-gray-400 hover:text-red-400 transition font-bold"><LogOut size={20} /> Sign Out</button>
          </div>
        </aside>

        <main className="flex-1 flex flex-col overflow-y-auto w-full relative" onTouchStart={handleTouchStart} onTouchMove={handleTouchMove} onTouchEnd={handleTouchEnd}>
          <div className="flex justify-center items-center overflow-hidden transition-all bg-gray-100" style={{ height: pullDistance > 0 ? `${pullDistance}px` : (isRefreshing ? '50px' : '0px') }}><RefreshCcw size={20} className={`text-[#8C1515] ${isRefreshing ? 'animate-spin' : ''}`} /></div>
          
          <header className="bg-white border-b border-[#D2BA92] p-4 md:p-6 flex flex-col md:flex-row justify-between items-center gap-4 sticky top-0 z-30 shadow-sm font-sans">
            <div className="flex items-center gap-4 w-full md:w-auto">
              <button className="lg:hidden p-2 bg-gray-50 rounded border" onClick={() => setIsSidebarOpen(true)}><Menu size={20} /></button>
              <div className="flex items-center gap-3 bg-[#F4F4F4] px-4 py-2 rounded-full border border-[#D2BA92] flex-1 md:w-64">
                <Search size={16} /><input type="text" placeholder="Search..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="bg-transparent border-none outline-none text-xs w-full" />
              </div>
            </div>
            <div className="flex items-center justify-between w-full md:w-auto gap-4">
              <div className="flex bg-[#F4F4F4] p-1 rounded-md border border-[#D2BA92] hidden sm:flex">
                {['open', 'resolved', 'all'].map(s => (
                  <button key={s} onClick={() => setStatusFilter(s)} className={`px-3 py-1 text-[10px] font-bold uppercase rounded ${statusFilter === s ? 'bg-white shadow-sm text-[#8C1515]' : 'text-gray-400'}`}>{s}</button>
                ))}
              </div>
              <button onClick={() => setIsModalOpen(true)} className="bg-[#8C1515] text-white px-4 py-2 rounded font-bold shadow-lg text-sm flex items-center gap-2"><Plus size={18} /> <span className="hidden sm:inline">New Request</span><span className="sm:hidden">New</span></button>
            </div>
          </header>

          <div className="px-4 md:px-8 py-6 grid grid-cols-2 lg:grid-cols-4 gap-4 w-full">
            <div className="bg-white border border-[#D2BA92] p-4 rounded-xl shadow-sm"><p className="text-[10px] text-gray-500 uppercase font-bold mb-1">Queue</p><p className="text-2xl font-serif font-bold">{stats.total}</p></div>
            <div onClick={() => setStatusFilter('open')} className={`p-4 rounded-xl border cursor-pointer ${statusFilter === 'open' ? 'border-[#007C92] bg-[#007C92]/5' : 'bg-white border-[#D2BA92]'}`}><p className="text-[10px] text-gray-500 uppercase font-bold mb-1">Active</p><p className="text-2xl font-serif font-bold text-[#007C92]">{stats.open}</p></div>
            <div className={`p-4 rounded-xl border ${stats.high > 0 ? 'bg-red-50 border-[#8C1515]' : 'bg-white border-[#D2BA92]'}`}><p className="text-[10px] uppercase font-bold text-[#8C1515] mb-1">High</p><p className="text-2xl font-serif font-bold text-[#8C1515]">{stats.high}</p></div>
            <div onClick={() => setStatusFilter('resolved')} className={`p-4 rounded-xl border cursor-pointer ${statusFilter === 'resolved' ? 'border-green-600 bg-green-50' : 'bg-white border-[#D2BA92]'}`}><p className="text-[10px] text-gray-500 uppercase font-bold mb-1">Fixed</p><p className="text-2xl font-serif font-bold text-green-600">{stats.resolved}</p></div>
          </div>

          <section className="px-4 md:px-8 pb-10 flex-grow">
            <div className="space-y-3">
              {filteredTickets.map(ticket => (
                <div key={ticket.id} onClick={() => setSelectedTicket(ticket)} className={`bg-white border border-[#D2BA92] border-l-4 rounded-xl p-4 shadow-sm hover:shadow-md transition-all cursor-pointer ${selectedTicket?.id === ticket.id ? 'ring-2 ring-[#8C1515]/20' : ''} ${ticket.priority === 'high' && ticket.status !== 'resolved' ? 'border-l-[#8C1515]' : 'border-l-[#D2BA92]'}`}>
                  <div className="flex justify-between items-center gap-3">
                    <div className="flex items-center gap-3 truncate">
                      {ticket.status === 'resolved' ? <CheckCircle2 className="text-green-600" size={20} /> : <AlertCircle className="text-red-600" size={20} />}
                      <h3 className={`font-bold font-serif text-base md:text-lg truncate ${ticket.status === 'resolved' ? 'text-gray-300 line-through' : ''}`}>{ticket.title}</h3>
                    </div>
                    <span className="text-[9px] font-bold text-gray-400 shrink-0 uppercase tracking-widest">SLS-{ticket.id}</span>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* OFFICIAL FULL STANFORD GLOBAL FOOTER */}
          <footer className="bg-[#8C1515] text-white py-12 px-8 mt-12 border-t-[5px] border-[#D2BA92] shrink-0 font-sans">
            <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center md:items-start gap-12">
              <div className="shrink-0 mb-4 md:mb-0">
                <a href="https://www.stanford.edu" className="hover:no-underline border-none">
                  <div className="font-serif text-white flex flex-col">
                    <span className="text-[44px] font-bold leading-[0.7] tracking-[-0.07em] italic">Stanford</span>
                    <span className="text-[30px] font-bold leading-[1.2] tracking-[-0.02em] italic">University</span>
                  </div>
                </a>
              </div>
              <div className="flex-1 flex flex-col gap-6 text-center md:text-left">
                <nav aria-label="global footer menu">
                  <ul className="flex flex-wrap justify-center md:justify-start gap-x-10 gap-y-3 text-[16px] font-bold">
                    <li><a href="https://www.stanford.edu" className="hover:underline">Stanford Home</a></li>
                    <li><a href="https://visit.stanford.edu/plan/maps.html" className="hover:underline">Maps & Directions</a></li>
                    <li><a href="https://www.stanford.edu/search/" className="hover:underline">Search Stanford</a></li>
                    <li><a href="https://emergency.stanford.edu" className="hover:underline">Emergency Info</a></li>
                  </ul>
                </nav>
                <nav aria-label="policy links">
                  <ul className="flex flex-wrap justify-center md:justify-start gap-x-6 gap-y-3 text-[14px] text-white/90">
                    <li><a href="https://www.stanford.edu/site/terms/" className="hover:underline">Terms of Use</a></li>
                    <li><a href="https://www.stanford.edu/site/privacy/" className="hover:underline">Privacy</a></li>
                    <li><a href="https://www.stanford.edu/site/copyright/" className="hover:underline">Copyright</a></li>
                    <li><a href="https://adminguide.stanford.edu/chapter-1/subsections-5/trademarks" className="hover:underline">Trademarks</a></li>
                    <li><a href="https://exploredegrees.stanford.edu/nonacademicregulations/nondiscrimination/" className="hover:underline">Non-Discrimination</a></li>
                    <li><a href="https://uit.stanford.edu/accessibility/policy" className="hover:underline">Accessibility</a></li>
                  </ul>
                </nav>
                <div className="text-[14px] text-white/80 mt-1 italic">
                  <p>© Stanford University, Stanford, California 94305.</p>
                </div>
              </div>
            </div>
          </footer>
        </main>

        {/* RESTORED MODAL: Fixed the non-responsive button issue */}
        {isModalOpen && (
          <div className="fixed inset-0 bg-[#2E2D29]/90 backdrop-blur-sm flex items-center justify-center p-4 z-[100]">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden border-2 border-[#D2BA92]">
              <div className="bg-[#8C1515] p-6 text-white font-serif flex justify-between items-center">
                <h2 className="text-2xl font-bold italic">Submit New Request</h2>
                <button onClick={() => setIsModalOpen(false)}><X size={24} /></button>
              </div>
              <form onSubmit={handleCreateTicket} className="p-6 space-y-5 font-sans">
                <div>
                  <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Issue Subject</label>
                  <input name="title" required className="w-full border-b-2 py-2 outline-none font-bold" />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Details</label>
                  <textarea name="description" rows="3" className="w-full border rounded-xl p-3 bg-gray-50 text-sm" />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Urgency</label>
                  <select name="priority" className="w-full border rounded-xl p-2 font-bold bg-white">
                    <option value="low">Low</option>
                    <option value="medium" selected>Medium</option>
                    <option value="high">High</option>
                  </select>
                </div>
                <div className="flex justify-end gap-4 pt-4">
                  <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 text-xs font-bold uppercase text-gray-400">Cancel</button>
                  <button type="submit" className="bg-[#8C1515] text-white px-8 py-3 rounded-xl font-bold uppercase text-xs shadow-lg transition active:scale-95">Submit Request</button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default App;