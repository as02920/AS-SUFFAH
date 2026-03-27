import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, addDoc, deleteDoc, doc, updateDoc, query, where, orderBy, serverTimestamp, increment, writeBatch } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from './firebase';
import { useAuth } from './AuthContext';
import { Plus, Search, Landmark, MoreVertical, Edit, Trash2, History, X, ChevronRight, ArrowLeft, Wallet, Calendar, User } from 'lucide-react';
import { formatCurrency, toBengaliNumber, cn } from './lib/utils';
import { motion, AnimatePresence } from 'motion/react';
import { DataTable } from './components/DataTable';

export const Banks = () => {
  const { role, user } = useAuth();
  const [banks, setBanks] = useState<any[]>([]);
  const [errorModal, setErrorModal] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingBank, setEditingBank] = useState<any>(null);
  const [selectedBank, setSelectedBank] = useState<any>(null);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [menuPosition, setMenuPosition] = useState<{ top: number, left: number } | null>(null);

  const [formData, setFormData] = useState({
    accountNumber: '',
    accountName: '',
    bankName: '',
    branch: ''
  });

  useEffect(() => {
    const onBack = (e: Event) => {
      if (selectedBank) {
        e.preventDefault();
        setSelectedBank(null);
      } else if (showAddModal) {
        e.preventDefault();
        setShowAddModal(false);
      }
    };
    window.addEventListener('app:back', onBack);
    return () => window.removeEventListener('app:back', onBack);
  }, [selectedBank, showAddModal]);

  useEffect(() => {
    if (!role) return;
    const unsub = onSnapshot(collection(db, 'banks'), (snap) => {
      setBanks(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'banks');
    });
    return unsub;
  }, [role]);

  useEffect(() => {
    if (!role || !selectedBank) return;
    const q = query(
      collection(db, 'bank_transactions'),
      where('bankId', '==', selectedBank.id)
    );
    const unsub = onSnapshot(q, (snap) => {
      const docs = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      // Sort client-side to avoid composite index requirement
      docs.sort((a: any, b: any) => (b.date || '').localeCompare(a.date || ''));
      setTransactions(docs);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'bank_transactions');
    });
    return unsub;
  }, [selectedBank, role]);

  const handleMenuToggle = (e: React.MouseEvent, bank: any) => {
    e.stopPropagation();
    const rect = e.currentTarget.getBoundingClientRect();
    setMenuPosition({ 
      top: rect.bottom + window.scrollY + 8, 
      left: rect.right + window.scrollX - 200
    });
    setOpenMenuId(openMenuId === bank.id ? null : bank.id);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingBank) {
        await updateDoc(doc(db, 'banks', editingBank.id), formData);
      } else {
        await addDoc(collection(db, 'banks'), {
          ...formData,
          balance: 0,
          createdAt: serverTimestamp()
        });
      }
      setShowAddModal(false);
      setEditingBank(null);
      setFormData({ accountNumber: '', accountName: '', bankName: '', branch: '' });
    } catch (err) {
      console.error(err);
      setErrorModal("ব্যাংক তথ্য সংরক্ষণ করতে সমস্যা হয়েছে");
    }
  };

  const handleDeleteBank = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'banks', id));
    } catch (err) {
      console.error(err);
      setErrorModal("ব্যাংক ডিলিট করতে সমস্যা হয়েছে");
    }
  };

  const handleDeleteTransaction = async (tr: any) => {
    try {
      const batch = writeBatch(db);
      batch.delete(doc(db, 'bank_transactions', tr.id));
      batch.update(doc(db, 'banks', tr.bankId), {
        balance: increment(tr.type === 'deposit' ? -tr.amount : tr.amount)
      });
      await batch.commit();
    } catch (err) {
      console.error(err);
      setErrorModal("লেনদেন ডিলিট করতে সমস্যা হয়েছে");
    }
  };

  const filtered = banks.filter(b => 
    b.accountName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    b.accountNumber.includes(searchTerm) ||
    b.bankName.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const bankColumns = [
    {
      header: 'একাউন্ট নাম',
      render: (bank: any) => (
        <p className="text-sm font-black text-slate-700">{bank.accountName}</p>
      )
    },
    {
      header: 'একাউন্ট নাম্বার',
      accessor: 'accountNumber',
      className: 'text-xs font-black text-slate-600'
    },
    {
      header: 'ব্যাংকের নাম',
      accessor: 'bankName',
      className: 'text-xs font-bold text-slate-500'
    },
    {
      header: 'শাখা',
      accessor: 'branch',
      className: 'text-xs font-bold text-slate-500'
    },
    {
      header: 'ব্যালেন্স',
      render: (bank: any) => (
        <p className="text-sm font-black text-emerald-600">{formatCurrency(bank.balance)}</p>
      ),
      className: 'text-right'
    },
    {
      header: 'একশন',
      render: (bank: any) => (
        <div className="flex justify-center gap-2">
          <button 
            onClick={(e) => {
              e.stopPropagation();
              setSelectedBank(bank);
            }}
            className="p-2 text-emerald-600 hover:bg-emerald-50 rounded-xl transition-colors"
            title="বিস্তারিত"
          >
            <History size={16} />
          </button>
          {role === 'super_admin' && (
            <button 
              onClick={(e) => {
                e.stopPropagation();
                setEditingBank(bank);
                setFormData({
                  accountNumber: bank.accountNumber,
                  accountName: bank.accountName,
                  bankName: bank.bankName,
                  branch: bank.branch
                });
                setShowAddModal(true);
              }}
              className="p-2 text-blue-600 hover:bg-blue-50 rounded-xl transition-colors"
              title="এডিট"
            >
              <Edit size={16} />
            </button>
          )}
          {role === 'super_admin' && (
            <button 
              onClick={(e) => {
                e.stopPropagation();
                handleDeleteBank(bank.id);
              }}
              className="p-2 text-rose-600 hover:bg-rose-50 rounded-xl transition-colors"
              title="ডিলিট"
            >
              <Trash2 size={16} />
            </button>
          )}
        </div>
      ),
      className: 'text-center'
    }
  ];

  const transactionColumns = [
    {
      header: 'তারিখ',
      accessor: 'date',
      className: 'text-xs font-black text-slate-700',
      render: (tr: any) => toBengaliNumber(tr.date.split('-').reverse().join('-'))
    },
    {
      header: 'জমা',
      render: (tr: any) => (
        <span className="text-emerald-600">
          {tr.type === 'deposit' ? formatCurrency(tr.amount) : '০'}
        </span>
      ),
      className: 'text-right font-black text-xs'
    },
    {
      header: 'উত্তোলন',
      render: (tr: any) => (
        <span className="text-rose-600">
          {tr.type === 'withdrawal' ? formatCurrency(tr.amount) : '০'}
        </span>
      ),
      className: 'text-right font-black text-xs'
    },
    {
      header: 'ব্যালেন্স',
      render: (tr: any) => (
        <span className="text-slate-800">
          {formatCurrency(tr.runningBalance)}
        </span>
      ),
      className: 'text-right font-black text-xs'
    },
    {
      header: 'প্রক্রিয়াকারী',
      accessor: 'processedBy',
      className: 'text-xs font-bold text-slate-500'
    },
    {
      header: 'একশন',
      render: (tr: any) => (
        <div className="flex justify-center">
          {role === 'super_admin' && (
            <button 
              onClick={(e) => {
                e.stopPropagation();
                handleDeleteTransaction(tr);
              }}
              className="p-2 text-rose-500 hover:bg-rose-50 rounded-xl transition-colors"
            >
              <Trash2 size={16} />
            </button>
          )}
        </div>
      ),
      className: 'text-center'
    }
  ];

  if (selectedBank) {
    return (
      <div className="fixed inset-0 top-[calc(env(safe-area-inset-top)+64px)] bottom-[calc(env(safe-area-inset-bottom)+64px)] z-20 bg-white flex flex-col animate-in slide-in-from-right duration-300">
        <div className="flex items-center justify-between bg-white p-2 border-b border-slate-100 sticky top-0 z-10">
          <div className="flex items-center gap-4 ml-2">
            <div className="text-right">
              <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest">লেনদেন বিবরণী</h3>
              <p className="text-sm font-black text-slate-800">{selectedBank.accountName}</p>
            </div>
            <div className="h-8 w-px bg-slate-100"></div>
            <div className="text-right">
              <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest">নিট ব্যালেন্স</h3>
              <p className="text-sm font-black text-emerald-600">{formatCurrency(selectedBank.balance)}</p>
            </div>
          </div>
        </div>
        
        <div className="flex-1 overflow-y-auto bg-slate-50/30">
          <div className="bg-white">
            <DataTable 
              columns={transactionColumns}
            data={(() => {
              let runningBalance = 0;
              const sorted = [...transactions].sort((a, b) => a.date.localeCompare(b.date));
              const withBalance = sorted.map(tr => {
                if (tr.type === 'deposit') runningBalance += tr.amount;
                else runningBalance -= tr.amount;
                return { ...tr, runningBalance };
              });
              return withBalance.reverse();
            })()}
            keyExtractor={(tr) => tr.id}
            emptyMessage="কোনো লেনদেন পাওয়া যায়নি"
          />
        </div>
      </div>
    </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-xl font-black text-slate-800">সকল ব্যাংক</h2>
          <p className="text-xs font-bold text-slate-400">মোট একাউন্ট: {toBengaliNumber(banks.length)}</p>
        </div>
        {role === 'super_admin' && (
          <button 
            onClick={() => {
              setEditingBank(null);
              setFormData({ accountNumber: '', accountName: '', bankName: '', branch: '' });
              setShowAddModal(true);
            }}
            className="bg-emerald-600 text-white px-5 py-3 rounded-2xl font-bold text-sm shadow-lg shadow-emerald-100 flex items-center gap-2 hover:bg-emerald-700 transition-all active:scale-95"
          >
            <Plus size={18} />
            একাউন্ট নাম্বার
          </button>
        )}
      </div>

      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
        <input 
          type="text" 
          placeholder="নাম অথবা একাউন্ট নাম্বার দিয়ে খুঁজুন..."
          className="w-full pl-12 pr-4 py-4 bg-white border border-slate-200 rounded-[1.5rem] shadow-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 font-bold text-sm"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      <div className="bg-white overflow-hidden">
        <DataTable 
          columns={bankColumns}
          data={filtered}
          keyExtractor={(bank) => bank.id}
          onRowClick={(bank) => setSelectedBank(bank)}
          emptyMessage="কোনো ব্যাংক একাউন্ট পাওয়া যায়নি"
        />
      </div>

      {/* Error Modal */}
      <AnimatePresence>
        {errorModal && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white w-full max-w-sm rounded-3xl p-8 text-center space-y-6"
            >
              <div className="w-20 h-20 bg-rose-50 text-rose-600 rounded-full flex items-center justify-center mx-auto">
                <User size={40} />
              </div>
              <div className="space-y-2">
                <h3 className="text-xl font-bold text-slate-800">সতর্কবার্তা</h3>
                <p className="text-slate-500">{errorModal}</p>
              </div>
              <button 
                onClick={() => setErrorModal(null)}
                className="w-full py-3 bg-slate-800 text-white font-bold rounded-xl hover:bg-slate-900 transition-colors"
              >
                ঠিক আছে
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showAddModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white rounded-[2.5rem] w-full max-w-md overflow-hidden shadow-2xl"
            >
              <div className="bg-emerald-600 p-6 text-white flex justify-between items-center">
                <h3 className="text-xl font-black">{editingBank ? 'ব্যাংক এডিট করুন' : 'নতুন ব্যাংক একাউন্ট'}</h3>
                <button onClick={() => setShowAddModal(false)} className="p-2 hover:bg-white/10 rounded-xl transition-colors">
                  <X size={24} />
                </button>
              </div>
              <form onSubmit={handleSubmit} className="p-6 space-y-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-500 ml-1">একাউন্ট নাম্বার</label>
                  <input 
                    required
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 font-bold text-sm"
                    value={formData.accountNumber}
                    onChange={e => setFormData({...formData, accountNumber: e.target.value})}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-500 ml-1">একাউন্ট নাম</label>
                  <input 
                    required
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 font-bold text-sm"
                    value={formData.accountName}
                    onChange={e => setFormData({...formData, accountName: e.target.value})}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-500 ml-1">ব্যাংকের নাম</label>
                  <input 
                    required
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 font-bold text-sm"
                    value={formData.bankName}
                    onChange={e => setFormData({...formData, bankName: e.target.value})}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-500 ml-1">শাখা</label>
                  <input 
                    required
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 font-bold text-sm"
                    value={formData.branch}
                    onChange={e => setFormData({...formData, branch: e.target.value})}
                  />
                </div>
                <div className="pt-4 flex gap-3">
                  <button 
                    type="button"
                    onClick={() => setShowAddModal(false)}
                    className="flex-1 py-4 bg-slate-100 text-slate-600 font-bold rounded-2xl hover:bg-slate-200 transition-colors"
                  >
                    বাতিল
                  </button>
                  <button 
                    type="submit"
                    className="flex-1 py-4 bg-emerald-600 text-white font-bold rounded-2xl shadow-lg shadow-emerald-200 hover:bg-emerald-700 transition-all active:scale-95"
                  >
                    সংরক্ষণ করুন
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
