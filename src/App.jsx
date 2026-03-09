import React, { useEffect, useState, useRef } from 'react';
// STEP 1: Import both the standard and admin clients
import { supabase, supabaseAdmin } from './lib/supabaseClient';
import { LayoutDashboard, User, Settings, Plus, Search, Clock, AlertCircle, CheckCircle2, Trash2, LogOut, ShieldCheck, Download, Menu, X, RefreshCcw, Users, ShieldAlert, KeyRound, UserPlus } from 'lucide-react';
import Auth from './Auth';

const getPriorityStyles = (priority) => {
  switch (priority?.toLowerCase()) {
    case 'high': return 'bg-red-50 text-red-700 border-red-200';
    case 'medium': return 'bg-amber-50 text-amber-700 border-amber-200';
    case 'low': return 'bg-slate-50 text-slate-600 border-slate-200';
    default: return 'bg-gray-50 text-gray-600 border-gray-200';
  }
};

const formatRelativeTime = (date) => {
  const now = new Date();
  const diffInSeconds = Math.floor((now - new Date(date)) / 1000);
  if (diffInSeconds < 60) return 'just now';
  const diffInMinutes = Math.floor(diffInSeconds / 60);
  if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
  const diffInHours = Math.floor(diffInMinutes / 60);
  if (diffInHours < 24) return `${diffInHours}h ago`;
  return new Date(date).toLocaleDateString();
};

function App() {
  const [activeTab, setActiveTab] = useState('dashboard'); 
  const [statusFilter, setStatusFilter] = useState('open'); 
  const [session, setSession] = useState(null);
  const [userRole, setUserRole] = useState('user'); 
  const [tickets, setTickets] = useState([]);
  const [allUsers, setAllUsers] = useState([]); 
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

  const fetchAllUsers = async () => {
    if (userRole !== 'admin') return;
    setDataLoading(true);
    try {
      const { data, error } = await supabase.from('profiles').select('*').order('email', { ascending: true });
      if (error) throw error;
      setAllUsers(data || []);
    } catch (err) { console.error(err); } finally { setDataLoading(false); }
  };

  const handleUpdateUserRole = async (userId, newRole) => {
    const { error } = await supabase.from('profiles').update({ role: newRole }).eq('id', userId);
    if (error) {
      showToast("Failed to update role", "error");
    } else {
      setAllUsers(allUsers.map(u => u.id === userId ? { ...u, role: newRole } : u));
      showToast(`User promoted to ${newRole}`);
    }
  };

  // STEP 2: Update Manual Registration to use supabaseAdmin
  const handleManualRegister = async (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const email = formData.get('email').toLowerCase().trim();
    const password = formData.get('password');

    if (password.length < 6) {
      showToast("Password must be 6+ chars", "error");
      return;
    }

    setDataLoading(true);
    // Use the admin client to bypass RLS and auto-confirm
    const { data, error } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true 
    });

    if (error) {
      showToast(error.message, "error");
    } else {
      showToast("Staff registered successfully!");
      fetchAllUsers();
      e.target.reset();
    }
    setDataLoading(false);
  };

  // STEP 3: Update Reset Password to use supabaseAdmin
  const handleAdminResetPassword = async (userId) => {
    const newPassword = prompt("Enter a new temporary password for this user:");
    if (!newPassword) return;
    if (newPassword.length < 6) {
      showToast("Password too short", "error");
      return;
    }

    // Use the admin client to update password without a reset link
    const { error } = await supabaseAdmin.auth.admin.updateUserById(userId, {
      password: newPassword
    });

    if (error) showToast(error.message, "error");
    else showToast("User password updated!");
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
        setUserRole(data.role || 'user');
        setLastLogin(data.last_login); 
      }
    }
    getProfile();
    fetchTickets();
  }, [session]);

  useEffect(() => {
    if (activeTab === 'users') fetchAllUsers();
  }, [activeTab]);

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
  }, [selectedTicket]);

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
    if (error) { showToast(error.message, "error"); } else if (data && data[0]) {
      await supabase.from('ticket_activities').insert([{ 
        ticket_id: data[0].id, user_id: session?.user?.id, 
        action_text: "Ticket created", actor_name: actorName 
      }]);
      setTickets([data[0], ...tickets]);
      setIsModalOpen(false);
      showToast("Support request submitted!");
    }
  };

  const handleResolve = async (id) => {
    const { error } = await supabase.from('tickets').update({ status: 'resolved' }).eq('id', id);
    if (!error) {
      const actorName = session?.user?.email?.split('@')[0];
      await supabase.from('ticket_activities').insert([{ 
        ticket_id: id, user_id: session?.user?.id, 
        action_text: "Status changed to Resolved", actor_name: actorName 
      }]);
      setTickets(tickets.map(t => t.id === id ? { ...t, status: 'resolved' } : t));
      if (selectedTicket?.id === id) setSelectedTicket({ ...selectedTicket, status: 'resolved' });
      showToast("Ticket resolved");
    }
  };

  const handleReopen = async (id) => {
    const { error } = await supabase.from('tickets').update({ status: 'open' }).eq('id', id);
    if (!error) {
      const actorName = session?.user?.email?.split('@')[0];
      await supabase.from('ticket_activities').insert([{ 
        ticket_id: id, user_id: session?.user?.id, 
        action_text: "Ticket re-opened", actor_name: actorName 
      }]);
      setTickets(tickets.map(t => t.id === id ? { ...t, status: 'open' } : t));
      if (selectedTicket?.id === id) setSelectedTicket({ ...selectedTicket, status: 'open' });
      showToast("Ticket re-opened");
    }
  };

  const handleDelete = async (id) => {
    if (window.confirm("Delete ticket permanently?")) {
      const { error } = await supabase.from('tickets').delete().eq('id', id);
      if (!error) {
        setTickets(tickets.filter(t => t.id !== id));
        if (selectedTicket?.id === id) setSelectedTicket(null);
        showToast("Ticket deleted");
      }
    }
  };

  const exportToCSV = async () => {
    const headers = ["ID", "Title", "Priority", "Status", "Created"];
    const rows = tickets.map(t => [`SLS-${t.id}`, t.title.replace(/,/g, ""), t.priority, t.status, new Date(t.created_at).toLocaleDateString()]);
    const csvContent = [headers, ...rows].map(e => e.join(",")).join("\n");
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `SLS_Report_${new Date().toLocaleDateString()}.csv`;
    link.click();
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
      if (statusFilter === 'high') return matchesSearch && t.status === 'open' && t.priority === 'high';
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

  if (authLoading) return <div className="min-h-screen flex items-center justify-center font-serif text-[#8C1515]">Loading Portal...</div>;
  if (!session) return <Auth />;

  return (
    <div className="h-screen bg-[#F4F4F4] flex flex-col font-sans text-[#2E2D29] antialiased overflow-hidden">
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
        {/* Mobile Overlay */}
        {isSidebarOpen && <div className="fixed inset-0 bg-black/50 z-40 lg:hidden" onClick={() => setIsSidebarOpen(false)} />}

        {/* Sidebar */}
        <aside className={`fixed lg:relative w-64 h-full bg-[#2E2D29] text-white flex flex-col z-50 transition-transform lg:translate-x-0 ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
          <div className="p-6 shrink-0">
            <div className="flex justify-between items-center mb-1">
              <h2 className="text-[#D2BA92] text-xl font-serif font-bold italic tracking-tight">SLS IT Portal</h2>
              <button className="lg:hidden" onClick={() => setIsSidebarOpen(false)}><X size={24} /></button>
            </div>
            <p className="text-[11px] text-gray-400 mb-4 truncate font-medium">{session?.user?.email}</p>
            <div className="flex items-center gap-2 px-2 py-1 bg-white/10 rounded border border-white/20 w-fit">
              <ShieldCheck size={12} className="text-[#D2BA92]" />
              <span className="text-[10px] uppercase font-bold tracking-widest text-[#D2BA92]">{userRole} Access</span>
            </div>
          </div>

          <nav className="flex-1 px-4 space-y-2 overflow-y-auto">
            <button 
              onClick={() => {setActiveTab('dashboard'); setIsSidebarOpen(false);}}
              className={`flex items-center gap-3 w-full p-3 rounded-lg font-bold transition-all duration-200 group ${
                activeTab === 'dashboard' ? 'bg-[#8C1515] text-white shadow-md' : 'text-gray-400 hover:bg-[#D2BA92]/10 hover:text-[#D2BA92]'
              }`}
            >
              <LayoutDashboard size={20} className={activeTab === 'dashboard' ? 'text-white' : 'group-hover:text-[#D2BA92]'} /> Dashboard
            </button>
            
            {userRole === 'admin' && (
              <button 
                onClick={() => {setActiveTab('users'); setIsSidebarOpen(false);}}
                className={`flex items-center gap-3 w-full p-3 rounded-lg font-bold transition-all duration-200 group ${
                  activeTab === 'users' ? 'bg-[#8C1515] text-white shadow-md' : 'text-gray-400 hover:bg-[#D2BA92]/10 hover:text-[#D2BA92]'
                }`}
              >
                <Users size={20} className={activeTab === 'users' ? 'text-white' : 'group-hover:text-[#D2BA92]'} /> User Management
              </button>
            )}

            {(userRole === 'admin' || userRole === 'agent') && (
              <button onClick={exportToCSV} className="flex items-center gap-3 w-full p-3 text-gray-400 hover:bg-[#D2BA92]/10 hover:text-[#D2BA92] transition-all duration-200 rounded-lg font-bold uppercase text-[10px] group">
                <Download size={18} className="group-hover:text-[#D2BA92]" /> Export Report
              </button>
            )}
          </nav>
          
          <div className="p-4 border-t border-white/10 text-gray-400 shrink-0">
            <p className="uppercase font-bold text-gray-500 mb-1 tracking-widest text-[9px]">Last Session</p>
            <div className="flex items-center gap-2 text-[10px] italic mb-4"><Clock size={12} /> {lastLogin ? new Date(lastLogin).toLocaleDateString() : 'Just now'}</div>
            <button onClick={() => supabase.auth.signOut()} className="flex items-center gap-3 w-full p-3 text-gray-400 hover:text-red-400 transition font-bold"><LogOut size={20} /> Sign Out</button>
          </div>
        </aside>

        <main className="flex-1 flex flex-col h-full relative overflow-hidden">
          <header className="bg-white border-b border-[#D2BA92] p-4 md:p-6 flex flex-col md:flex-row justify-between items-center gap-4 shrink-0 z-30 shadow-sm font-sans">
            <div className="flex items-center gap-4 w-full md:w-auto">
              <button className="lg:hidden p-2 bg-gray-50 rounded border" onClick={() => setIsSidebarOpen(true)}><Menu size={20} /></button>
              <h1 className="text-[#8C1515] text-xl font-serif font-bold uppercase tracking-tight">
                {activeTab === 'dashboard' ? 'Service Queue' : 'Access Control'}
              </h1>
            </div>
            
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-3 bg-[#F4F4F4] px-4 py-2 rounded-full border border-[#D2BA92] w-64 hidden md:flex">
                <Search size={16} /><input type="text" placeholder="Search..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="bg-transparent border-none outline-none text-xs w-full font-bold" />
              </div>
              {activeTab === 'dashboard' && (
                <button onClick={() => setIsModalOpen(true)} className="bg-[#8C1515] text-white px-4 py-2 rounded font-bold shadow-lg text-sm flex items-center gap-2"><Plus size={18} /> New Request</button>
              )}
            </div>
          </header>

          <div className="flex-1 overflow-y-auto">
            {activeTab === 'dashboard' ? (
              <>
                <div className="px-4 md:px-8 py-6 grid grid-cols-2 lg:grid-cols-4 gap-4 w-full shrink-0">
                  <div onClick={() => setStatusFilter('all')} className={`p-4 rounded-xl border cursor-pointer ${statusFilter === 'all' ? 'border-[#8C1515] bg-[#8C1515]/5' : 'bg-white border-[#D2BA92]'}`}><p className="text-[10px] text-gray-500 uppercase font-bold mb-1">Queue</p><p className="text-2xl font-serif font-bold">{stats.total}</p></div>
                  <div onClick={() => setStatusFilter('open')} className={`p-4 rounded-xl border cursor-pointer ${statusFilter === 'open' ? 'border-[#007C92] bg-[#007C92]/5' : 'bg-white border-[#D2BA92]'}`}><p className="text-[10px] text-gray-500 uppercase font-bold mb-1">Active</p><p className="text-2xl font-serif font-bold text-[#007C92]">{stats.open}</p></div>
                  <div onClick={() => { setStatusFilter('high'); showToast("Urgency Filter Active"); }} className={`p-4 rounded-xl border cursor-pointer ${statusFilter === 'high' ? 'bg-red-50 border-[#8C1515]' : 'bg-white border-[#D2BA92]'}`}><p className="text-[10px] uppercase font-bold text-[#8C1515] mb-1">High</p><p className="text-2xl font-serif font-bold text-[#8C1515]">{stats.high}</p></div>
                  <div onClick={() => setStatusFilter('resolved')} className={`p-4 rounded-xl border cursor-pointer ${statusFilter === 'resolved' ? 'border-green-600 bg-green-50' : 'bg-white border-[#D2BA92]'}`}><p className="text-[10px] text-gray-500 uppercase font-bold mb-1">Fixed</p><p className="text-2xl font-serif font-bold text-green-600">{stats.resolved}</p></div>
                </div>

                <section className="px-4 md:px-8 pb-10">
                  <div className="space-y-3">
                    {filteredTickets.map(ticket => (
                      <div key={ticket.id} onClick={() => setSelectedTicket(ticket)} className={`bg-white border border-[#D2BA92] border-l-4 rounded-xl p-4 shadow-sm hover:shadow-md transition-all cursor-pointer ${selectedTicket?.id === ticket.id ? 'ring-2 ring-[#8C1515]/20 bg-gray-50' : ''} ${ticket.priority === 'high' && ticket.status !== 'resolved' ? 'border-l-[#8C1515]' : 'border-l-[#D2BA92]'}`}>
                        <div className="flex justify-between items-center gap-3">
                          <div className="flex items-center gap-3 truncate">
                            {ticket.status === 'resolved' ? <CheckCircle2 className="text-green-600" size={20} /> : <AlertCircle className="text-red-600" size={20} />}
                            <div className="flex flex-col truncate">
                              <div className="flex items-center gap-2 truncate">
                                <h3 className={`font-bold font-serif text-base md:text-lg truncate ${ticket.status === 'resolved' ? 'text-gray-300 line-through' : ''}`}>{ticket.title}</h3>
                                {ticket.status !== 'resolved' && <span className={`text-[8px] font-bold uppercase px-1.5 py-0.5 rounded-full border ${getPriorityStyles(ticket.priority)}`}>{ticket.priority}</span>}
                              </div>
                              <span className="text-[9px] font-bold text-gray-400 shrink-0 uppercase tracking-widest">SLS-{ticket.id}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              </>
            ) : (
              /* USER MANAGEMENT INTERFACE */
              <section className="px-4 md:px-8 py-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                {/* MANUAL REGISTRATION FORM */}
                <div className="bg-white border-2 border-[#D2BA92] rounded-2xl p-6 mb-8 shadow-sm">
                  <div className="flex items-center gap-2 mb-4">
                    <UserPlus size={18} className="text-[#8C1515]" />
                    <h3 className="font-serif font-bold text-[#8C1515] text-lg">Register New Staff Manually</h3>
                  </div>
                  <form onSubmit={handleManualRegister} className="flex flex-col md:flex-row gap-4 items-end">
                    <div className="flex-1 w-full">
                      <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1 block">Staff Email</label>
                      <input name="email" placeholder="sunetid@stanford.edu" required className="w-full border-b-2 border-[#D2BA92] p-2 outline-none focus:border-[#8C1515] text-sm font-bold" />
                    </div>
                    <div className="flex-1 w-full">
                      <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1 block">Temporary Password</label>
                      <input name="password" type="password" placeholder="Min 6 characters" required className="w-full border-b-2 border-[#D2BA92] p-2 outline-none focus:border-[#8C1515] text-sm font-bold" />
                    </div>
                    <button type="submit" disabled={dataLoading} className="bg-[#8C1515] text-white px-8 py-2.5 rounded shadow-lg font-bold uppercase text-[10px] tracking-widest disabled:opacity-50 h-fit">
                      {dataLoading ? 'Processing...' : 'Create Account'}
                    </button>
                  </form>
                </div>

                {/* USER LIST TABLE */}
                <div className="bg-white border-2 border-[#D2BA92] rounded-2xl shadow-sm overflow-hidden">
                  <table className="w-full text-left border-collapse">
                    <thead className="bg-[#F4F4F4] text-[10px] uppercase font-bold text-gray-500 tracking-widest border-b-2 border-[#D2BA92]">
                      <tr>
                        <th className="p-4">Stanford Identity</th>
                        <th className="p-4">Assigned Role</th>
                        <th className="p-4">Last Active</th>
                        <th className="p-4 text-right">Access Controls</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {allUsers.map(user => (
                        <tr key={user.id} className="hover:bg-gray-50 transition-colors">
                          <td className="p-4">
                            <p className="font-bold text-sm">{user.email}</p>
                            <p className="text-[9px] text-gray-400 font-mono uppercase tracking-tighter">UID: {user.id.substring(0,8)}...</p>
                          </td>
                          <td className="p-4">
                            <select 
                              value={user.role} 
                              disabled={user.id === session.user.id}
                              onChange={(e) => handleUpdateUserRole(user.id, e.target.value)}
                              className="text-[10px] font-bold bg-[#F4F4F4] border border-[#D2BA92] p-1.5 rounded outline-none cursor-pointer uppercase"
                            >
                              <option value="user">User</option>
                              <option value="agent">Agent</option>
                              <option value="admin">Admin</option>
                            </select>
                          </td>
                          <td className="p-4 text-[11px] text-gray-500 italic">
                            {user.last_login ? formatRelativeTime(user.last_login) : 'Inactive'}
                          </td>
                          <td className="p-4 text-right">
                            <button 
                              onClick={() => handleAdminResetPassword(user.id)}
                              className="inline-flex items-center gap-2 text-[10px] font-bold text-[#8C1515] border border-[#8C1515]/20 px-3 py-1.5 rounded hover:bg-[#8C1515] hover:text-white transition-all group"
                            >
                              <KeyRound size={12} className="group-hover:rotate-12 transition-transform" />
                              Reset Password
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="mt-6 flex items-start gap-3 p-4 bg-amber-50 border-2 border-amber-200 rounded-xl">
                  <ShieldAlert className="text-amber-600 shrink-0" size={20} />
                  <p className="text-xs text-amber-800 font-bold leading-relaxed">
                    Manual Registration bypasses the standard email verification loop. Users created here can log in immediately using the temporary password provided. Encourage them to update their credentials upon first login.
                  </p>
                </div>
              </section>
            )}

            <footer className="bg-[#8C1515] text-white py-12 px-8 mt-12 border-t-[5px] border-[#D2BA92] shrink-0 font-sans">
              <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center md:items-start gap-12 text-center md:text-left">
                <div className="shrink-0">
                  <div className="font-serif text-white flex flex-col">
                    <span className="text-[44px] font-bold leading-[0.7] tracking-[-0.07em] italic">Stanford</span>
                    <span className="text-[30px] font-bold leading-[1.2] tracking-[-0.02em] italic">University</span>
                  </div>
                </div>
                <div className="flex-1 flex flex-col gap-6 text-[14px]">
                  <nav aria-label="global footer menu"><ul className="flex flex-wrap justify-center md:justify-start gap-x-10 font-bold"><li><a href="https://www.stanford.edu" className="hover:underline">Stanford Home</a></li><li><a href="https://emergency.stanford.edu" className="hover:underline">Emergency Info</a></li></ul></nav>
                  <p className="text-white/80 italic font-bold">© Stanford University, Stanford, California 94305.</p>
                </div>
              </div>
            </footer>
          </div>
        </main>

        {selectedTicket && (
          <aside className="fixed inset-0 lg:relative lg:inset-auto lg:w-[450px] bg-white border-l-2 border-[#D2BA92] z-[60] flex flex-col h-full animate-in slide-in-from-right duration-300">
            <div className="p-6 border-b flex justify-between items-center bg-[#F4F4F4] shrink-0">
              <h2 className="font-serif font-bold text-xl text-[#8C1515]">Request Details</h2>
              <button onClick={() => setSelectedTicket(null)} className="p-2 bg-gray-200 rounded-full lg:bg-transparent lg:p-0"><X size={24} /></button>
            </div>
            <div className="p-6 md:p-10 space-y-8 overflow-y-auto flex-1 font-sans">
              <div>
                <span className={`text-[10px] font-bold uppercase px-3 py-1 rounded border ${getPriorityStyles(selectedTicket.priority)}`}>{selectedTicket.priority} Priority</span>
                <h1 className="text-3xl font-serif font-bold text-[#2E2D29] mt-4">{selectedTicket.title}</h1>
              </div>
              <div className="p-6 bg-gray-50 border border-gray-100 rounded-xl italic text-sm">"{selectedTicket.description || 'No description provided.'}"</div>
              <div className="pt-6 border-t">
                <label className="text-[11px] font-bold text-gray-500 uppercase tracking-widest block mb-4">Activity Log</label>
                <div className="space-y-4">
                  {activities.map((log) => (
                    <div key={log.id} className="flex gap-3 text-sm">
                      <div className="mt-1 w-1.5 h-1.5 rounded-full bg-[#D2BA92] shrink-0" />
                      <div>
                        <p className="font-bold text-gray-800">{log.action_text}</p>
                        <p className="text-[10px] text-gray-500 uppercase">By: {log.actor_name || 'System'} • {formatRelativeTime(log.created_at)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="pt-8 border-t space-y-3 shrink-0">
                {selectedTicket.status === 'open' && (userRole === 'agent' || userRole === 'admin') && (
                  <button onClick={() => handleResolve(selectedTicket.id)} className="w-full bg-[#007C92] text-white py-4 rounded-xl font-bold uppercase tracking-widest text-xs shadow-lg transition-all active:scale-95">Resolve Issue</button>
                )}
                {selectedTicket.status === 'resolved' && (userRole === 'agent' || userRole === 'admin') && (
                  <button onClick={() => handleReopen(selectedTicket.id)} className="w-full border-2 border-[#007C92] text-[#007C92] py-4 rounded-xl font-bold uppercase tracking-widest text-xs">Re-open Ticket</button>
                )}
                {userRole === 'admin' && (
                  <button onClick={() => handleDelete(selectedTicket.id)} className="w-full border-2 border-red-100 text-red-500 py-4 rounded-xl font-bold uppercase tracking-widest text-[10px]">Delete Permanently</button>
                )}
              </div>
            </div>
          </aside>
        )}
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-[#2E2D29]/90 backdrop-blur-sm flex items-center justify-center p-4 z-[100]">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden border-2 border-[#D2BA92]">
            <div className="bg-[#8C1515] p-6 text-white font-serif flex justify-between items-center"><h2 className="text-2xl font-bold italic">New Support Request</h2><button onClick={() => setIsModalOpen(false)}><X size={24} /></button></div>
            <form onSubmit={handleCreateTicket} className="p-6 space-y-5 font-sans">
              <div><label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Subject</label><input name="title" required className="w-full border-b-2 py-2 outline-none font-bold text-lg" /></div>
              <div><label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Priority</label>
                <select name="priority" className="w-full border rounded-xl p-3 font-bold bg-white outline-none">
                  <option value="low">Low</option><option value="medium" selected>Medium</option><option value="high">High</option>
                </select>
              </div>
              <button type="submit" className="w-full bg-[#8C1515] text-white py-3 rounded-xl font-bold uppercase text-xs shadow-lg">Submit</button>
            </form>
          </div>
        </div>
      )}

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

export default App;"