import React, { useEffect, useState } from 'react';
import { supabase } from './lib/supabaseClient';
// Added CheckCircle2 to imports
import { LayoutDashboard, User, Settings, Plus, Clock, AlertCircle, CheckCircle2, Trash2 } from 'lucide-react';

function App() {
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [filter, setFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    async function fetchTickets() {
      const { data, error } = await supabase
        .from('tickets')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching tickets:', error);
      } else {
        setTickets(data);
      }
      setLoading(false);
    }
    fetchTickets();
  }, []);

  const handleCreateTicket = async (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const newTicket = {
      title: formData.get('title'),
      description: formData.get('description'),
      priority: formData.get('priority'),
      status: 'open'
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
  // A simple browser confirmation to prevent accidental deletes
  if (window.confirm("Are you sure you want to remove this ticket from the SLS records?")) {
    const { error } = await supabase
      .from('tickets')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error deleting ticket:', error.message);
    } else {
      // Remove the ticket from the local screen immediately
      setTickets(tickets.filter(t => t.id !== id));
    }
    }
    };

  const getPriorityStyles = (priority) => {
  switch (priority?.toLowerCase()) {
    case 'high':
      return 'bg-red-50 text-red-700 border-red-200';
    case 'medium':
      return 'bg-amber-50 text-amber-700 border-amber-200';
    case 'low':
      return 'bg-slate-50 text-slate-600 border-slate-200';
    default:
      return 'bg-gray-50 text-gray-600 border-gray-200';
    }
    }; 

    const filteredTickets = tickets.filter(t => {
    const matchesPriority = filter === 'all' || t.priority === filter;
    const matchesSearch = t.title.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesPriority && matchesSearch;
    });

  return (
    <div className="min-h-screen bg-[#F4F4F4] flex flex-col font-sans">
      <div className="bg-[#8C1515] h-[30px] flex items-center px-8 text-white text-[13px] font-semibold uppercase tracking-wide">
        Stanford University
      </div>

      <div className="flex flex-1">
        <aside className="w-64 bg-[#2E2D29] text-white flex flex-col">
          <div className="p-6">
            <h2 className="text-[#D2BA92] text-xl font-serif font-bold">SLS IT Portal</h2>
          </div>
          <nav className="flex-1 px-4 space-y-2">
            <div className="flex items-center gap-3 p-3 bg-[#8C1515] rounded-lg text-white">
              <LayoutDashboard size={20} /> Dashboard
            </div>
            <div className="flex items-center gap-3 p-3 text-gray-400 hover:text-white cursor-pointer transition">
              <User size={20} /> My Profile
            </div>
          </nav>
        </aside>

        <main className="flex-1 flex flex-col">
          <header className="bg-white border-b border-[#D2BA92] p-6 flex justify-between items-center">
            
            <div className="flex items-center gap-3 bg-[#F4F4F4] px-4 py-2 rounded-full border border-[#D2BA92] w-64 shadow-inner focus-within:border-[#8C1515] transition-all">
            <Search size={16} className="text-[#4D4F53]" />
            <input 
            type="text" 
            placeholder="Search tickets..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="bg-transparent border-none outline-none text-xs w-full text-[#2E2D29] placeholder-[#4D4F53]"
            />
            </div>
            
            <div>
              <h1 className="text-[#8C1515] text-2xl font-serif font-bold">Support Tickets</h1>
              <p className="text-[#4D4F53] text-sm font-medium uppercase tracking-wider">Information Technology Services</p>
            
            <select 
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="bg-transparent text-xs font-bold text-[#2E2D29] outline-none cursor-pointer"
            >
            <option value="all">All Tickets</option>
            <option value="high">High Priority</option>
            <option value="medium">Medium Priority</option>
            <option value="low">Low Priority</option>
            </select>
            
            </div>
            
            <button 
              onClick={() => setIsModalOpen(true)}
              className="bg-[#8C1515] text-white px-6 py-2 rounded font-bold hover:bg-[#6b1010] flex items-center gap-2 transition shadow-md">
              <Plus size={18} /> New Request
            </button>
          </header>

          <section className="p-8 max-w-5xl">
            {loading ? (
              <p className="text-gray-500 italic">Loading Stanford Law database...</p>
            ) : filteredTickets.length === 0 ? (
              <div className="text-center p-12 bg-white rounded-xl border border-dashed border-[#D2BA92]">
                <p className="text-[#4D4F53] font-serif italic text-lg">
                  filter === 'all' 
                  ? "No active tickets found. All systems operational." 
                  : `No {filter} priority tickets found.`
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {filteredTickets.map((ticket) => (
  <div 
    key={ticket.id} 
    className={`bg-white border-y border-r border-l-4 rounded-xl p-5 shadow-sm transition-all hover:shadow-md ${
      ticket.priority === 'high' ? 'border-l-[#8C1515]' : 
      ticket.priority === 'medium' ? 'border-l-amber-500' : 'border-l-slate-300'
    } border-[#D2BA92]`}
  >
    <div className="flex justify-between items-center">
      <div className="flex items-center gap-4">
        {/* Status Icon */}
        <div className={`p-2 rounded-lg ${ticket.status === 'resolved' ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-600'}`}>
          {ticket.status === 'resolved' ? <CheckCircle2 size={24} /> : <AlertCircle size={24} />}
        </div>
        
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h3 className={`font-bold font-serif ${ticket.status === 'resolved' ? 'text-gray-400 line-through' : 'text-[#2E2D29]'}`}>
              {ticket.title}
            </h3>
            {/* PRIORITY BADGE */}
            {ticket.status !== 'resolved' && (
              <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded border ${getPriorityStyles(ticket.priority)}`}>
                {ticket.priority}
              </span>
            )}
          </div>
          <div className="flex items-center gap-3">
            <span className="text-[10px] text-[#4D4F53] font-semibold uppercase bg-gray-100 px-2 py-0.5 rounded">SLS-{ticket.id}</span>
            <span className="text-[10px] text-gray-400 flex items-center gap-1"><Clock size={12}/> {new Date(ticket.created_at).toLocaleDateString()}</span>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-4">
        {ticket.status !== 'resolved' ? (
          <button 
            onClick={() => handleResolve(ticket.id)}
            className="text-[10px] font-bold text-[#007C92] border border-[#007C92] px-3 py-1 rounded hover:bg-[#007C92] hover:text-white transition uppercase tracking-widest">
            Mark Resolved
          </button>
        ) : (
          <span className="bg-green-50 text-green-700 text-[10px] font-black px-3 py-1 rounded-full border border-green-200 uppercase tracking-widest">
            Resolved
          </span>
        )}
        <button 
          onClick={() => handleDelete(ticket.id)}
          className="text-gray-400 hover:text-red-600 transition-colors p-1"
        >
          <Trash2 size={16} />
        </button>
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
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg overflow-hidden border border-[#D2BA92]">
            <div className="bg-[#8C1515] p-6 text-white">
              <h2 className="text-xl font-serif font-bold">New Support Request</h2>
              <p className="text-xs opacity-80 uppercase tracking-widest mt-1">Stanford Law IT Services</p>
            </div>
            
            <form onSubmit={handleCreateTicket} className="p-8 space-y-6">
              <div>
                <label className="block text-xs font-bold text-[#4D4F53] uppercase mb-2">Issue Title</label>
                <input name="title" required placeholder="e.g., Classroom Audio Issues" className="w-full border-b-2 border-[#D2BA92] py-2 focus:border-[#8C1515] outline-none transition-colors" />
              </div>
              
              <div>
                <label className="block text-xs font-bold text-[#4D4F53] uppercase mb-2">Detailed Description</label>
                <textarea name="description" rows="3" className="w-full border border-[#D2BA92] rounded-md p-3 focus:ring-1 focus:ring-[#8C1515] outline-none" />
              </div>

              <div>
                <label className="block text-xs font-bold text-[#4D4F53] uppercase mb-2">Urgency / Priority</label>
                <select name="priority" className="w-full bg-slate-50 border border-[#D2BA92] p-3 rounded-md outline-none focus:ring-1 focus:ring-[#8C1515]">
                <option value="low">Low - General Inquiry</option>
                <option value="medium">Medium - Functional Issue</option>
                <option value="high">High - Critical / Class Interrupted</option>
                </select>
              </div>

              <div className="flex justify-end gap-4 pt-4">
                <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 text-[#4D4F53] font-bold hover:text-black transition">Cancel</button>
                <button type="submit" className="bg-[#8C1515] text-white px-8 py-2 rounded-md font-bold hover:bg-[#6b1010] shadow-lg transition-all active:scale-95">
                  Submit Request
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;