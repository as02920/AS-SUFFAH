import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, addDoc, doc, updateDoc, deleteDoc, query, where, orderBy, serverTimestamp, getDocs, writeBatch, increment } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from './firebase';
import { useAuth } from './AuthContext';
import { formatCurrency, toBengaliNumber, getDirectDriveUrl } from './lib/utils';
import { Plus, Search, UserPlus, Phone, Mail, MapPin, Briefcase, Trash2, Edit, ChevronRight, X, ArrowLeft, Wallet, History, User, Camera, MoreVertical, List, ChevronDown, Info } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from './lib/utils';
import { DataTable } from './components/DataTable';

export const Directors = () => {
  const { role, user } = useAuth();
  const [directors, setDirectors] = useState<any[]>([]);
  const [errorModal, setErrorModal] = useState<string | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingDirector, setEditingDirector] = useState<any>(null);
  const [selectedDirector, setSelectedDirector] = useState<any>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState<'info' | 'transactions' | 'list'>('list');
  const [transactions, setTransactions] = useState<any[]>([]);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [activeMenuDirector, setActiveMenuDirector] = useState<any>(null);
  const [menuPosition, setMenuPosition] = useState<{ top: number, left: number } | null>(null);

  const [formData, setFormData] = useState({
    name: '',
    fatherName: '',
    mobile: '',
    profession: '',
    address: '',
    email: '',
    photoUrl: ''
  });

  const [showTransactionModal, setShowTransactionModal] = useState(false);
  const [transactionType, setTransactionType] = useState<'deposit' | 'withdrawal' | 'profit_distribution' | 'profit_withdraw'>('deposit');
  const [transactionData, setTransactionData] = useState({
    amount: '',
    date: new Date().toISOString().split('T')[0],
    note: ''
  });

  const [showDeleteConfirm, setShowDeleteConfirm] = useState<{ id: string, type: 'director' | 'transaction', data?: any } | null>(null);

  useEffect(() => {
    const onBack = (e: Event) => {
      if (selectedDirector) {
        e.preventDefault();
        setSelectedDirector(null);
        setActiveTab('list');
      } else if (showAddModal) {
        e.preventDefault();
        setShowAddModal(false);
      } else if (showTransactionModal) {
        e.preventDefault();
        setShowTransactionModal(false);
      }
    };
    window.addEventListener('app:back', onBack);
    return () => window.removeEventListener('app:back', onBack);
  }, [selectedDirector, showAddModal, showTransactionModal]);

  const directorColumns = [
    { header: 'ক্রমিক', render: (_: any, idx: number) => toBengaliNumber(idx + 1), className: "text-center font-bold text-slate-400" },
    { 
      header: 'ছবি', 
      render: (director: any) => (
        <div className="w-8 h-8 rounded-lg bg-slate-100 overflow-hidden border border-slate-200">
          {director.photoUrl ? (
            <img 
              src={getDirectDriveUrl(director.photoUrl)} 
              alt="" 
              className="w-full h-full object-cover" 
              referrerPolicy="no-referrer"
              loading="lazy"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-slate-400">
              <User size={16} />
            </div>
          )}
        </div>
      )
    },
    { header: 'নাম', accessor: 'name', className: "font-bold text-slate-800" },
    { 
      header: 'মোবাইল', 
      render: (director: any) => (
        <a 
          href={`tel:${director.mobile}`}
          className="font-mono text-emerald-600 hover:text-emerald-700 hover:underline transition-colors"
        >
          {director.mobile}
        </a>
      )
    },
    { header: 'পেশা', accessor: 'profession' },
    { header: 'ব্যালেন্স', render: (director: any) => formatCurrency(director.balance), className: "text-right font-bold text-emerald-600" },
    { header: 'মুনাফা ব্যালেন্স', render: (director: any) => formatCurrency(director.profitBalance || 0), className: "text-right font-bold text-blue-600" },
    { 
      header: 'একশন', 
      render: (director: any) => (
        <div className="flex justify-center">
          <button 
            onClick={(e) => handleMenuToggle(e, director)}
            className="p-2 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-xl transition-all active:scale-90"
          >
            <MoreVertical size={20} />
          </button>
        </div>
      ),
      headerClassName: "text-center"
    }
  ];

  const transactionColumns = [
    { header: 'ক্রমিক', render: (_: any, idx: number) => toBengaliNumber(idx + 1), className: "text-center font-bold text-slate-400" },
    { 
      header: 'তারিখ', 
      accessor: 'date', 
      className: "font-mono",
      render: (tr: any) => toBengaliNumber(tr.date.split('-').reverse().join('-'))
    },
    { header: 'বিবরণ', accessor: 'note', className: "text-slate-500 italic" },
    { 
      header: 'জমা', 
      render: (tr: any) => tr.type === 'deposit' ? formatCurrency(tr.amount) : toBengaliNumber(0),
      className: "text-right text-emerald-600 font-bold"
    },
    { 
      header: 'উত্তোলন', 
      render: (tr: any) => tr.type === 'withdrawal' ? formatCurrency(tr.amount) : toBengaliNumber(0),
      className: "text-right text-rose-600 font-bold"
    },
    { 
      header: 'মুনাফা গ্রহণ', 
      render: (tr: any) => tr.type === 'profit_distribution' ? formatCurrency(tr.amount) : toBengaliNumber(0),
      className: "text-right text-blue-600 font-bold"
    },
    { 
      header: 'মুনাফা উত্তোলন', 
      render: (tr: any) => tr.type === 'profit_withdraw' ? formatCurrency(tr.amount) : toBengaliNumber(0),
      className: "text-right text-amber-600 font-bold"
    },
    { header: 'প্রক্রিয়াকারী', accessor: 'processedBy', className: "text-[10px]" },
    { 
      header: 'একশন', 
      render: (tr: any) => (
        <div className="flex justify-center">
          {role === 'super_admin' && (
            <button 
              onClick={() => setShowDeleteConfirm({ id: tr.id, type: 'transaction', data: tr })}
              className="p-2 text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
            >
              <Trash2 size={16} />
            </button>
          )}
        </div>
      ),
      headerClassName: "text-center"
    }
  ];

  const handleTransactionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDirector) return;

    const amount = parseFloat(transactionData.amount);
    if (isNaN(amount) || amount <= 0) return;

    try {
      const batch = writeBatch(db);
      const trRef = doc(collection(db, 'director_transactions'));
      batch.set(trRef, {
        directorId: selectedDirector.id,
        amount,
        type: transactionType,
        date: transactionData.date,
        note: transactionData.note,
        processedBy: user?.name || 'Unknown',
        createdAt: serverTimestamp()
      });

      const directorRef = doc(db, 'directors', selectedDirector.id);
      const updateData: any = {};

      if (transactionType === 'deposit') {
        updateData.totalDeposit = increment(amount);
        updateData.balance = increment(amount);
      } else if (transactionType === 'withdrawal') {
        updateData.totalWithdrawal = increment(amount);
        updateData.balance = increment(-amount);
      } else if (transactionType === 'profit_distribution') {
        updateData.totalProfitReceived = increment(amount);
        updateData.profitBalance = increment(amount);
      } else if (transactionType === 'profit_withdraw') {
        updateData.totalProfitWithdrawn = increment(amount);
        updateData.profitBalance = increment(-amount);
      }

      batch.update(directorRef, updateData);
      await batch.commit();
      
      setShowTransactionModal(false);
      setTransactionData({ amount: '', date: new Date().toISOString().split('T')[0], note: '' });
    } catch (error) {
      console.error("Error saving transaction:", error);
    }
  };

  useEffect(() => {
    if (!role) return;
    const unsub = onSnapshot(collection(db, 'directors'), (snap) => {
      setDirectors(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'directors');
    });
    return unsub;
  }, [role]);

  useEffect(() => {
    if (!role) return;
    if (selectedDirector) {
      const q = query(
        collection(db, 'director_transactions'),
        where('directorId', '==', selectedDirector.id)
      );
      const unsub = onSnapshot(q, (snap) => {
        const trs = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as any));
        trs.sort((a: any, b: any) => {
          const dateA = a.createdAt?.seconds || 0;
          const dateB = b.createdAt?.seconds || 0;
          return dateB - dateA;
        });
        setTransactions(trs);
      }, (error) => {
        handleFirestoreError(error, OperationType.LIST, 'director_transactions');
      });
      return unsub;
    }
  }, [selectedDirector, role]);

  useEffect(() => {
    // Removed scroll listener that closed the menu
  }, []);

  const stats = selectedDirector ? transactions.reduce((acc, tr) => {
    if (tr.type === 'deposit') acc.totalDeposit += tr.amount;
    if (tr.type === 'withdrawal') acc.totalWithdrawal += tr.amount;
    if (tr.type === 'profit_distribution') acc.totalProfitReceived += tr.amount;
    if (tr.type === 'profit_withdraw') acc.totalProfitWithdrawn += tr.amount;
    return acc;
  }, { totalDeposit: 0, totalWithdrawal: 0, totalProfitReceived: 0, totalProfitWithdrawn: 0 }) : { totalDeposit: 0, totalWithdrawal: 0, totalProfitReceived: 0, totalProfitWithdrawn: 0 };

  const currentBalance = stats.totalDeposit - stats.totalWithdrawal;
  const currentProfitBalance = stats.totalProfitReceived - stats.totalProfitWithdrawn;

  const handleMenuToggle = (e: React.MouseEvent, director: any) => {
    e.stopPropagation();
    const rect = e.currentTarget.getBoundingClientRect();
    setMenuPosition({ 
      top: rect.bottom + window.scrollY + 8, 
      left: rect.right + window.scrollX - 192
    });
    if (openMenuId === director.id) {
      setOpenMenuId(null);
      setActiveMenuDirector(null);
    } else {
      setOpenMenuId(director.id);
      setActiveMenuDirector(director);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (role !== 'super_admin' && editingDirector) return;

    try {
      const processedData = {
        ...formData,
        photoUrl: getDirectDriveUrl(formData.photoUrl)
      };

      if (editingDirector) {
        await updateDoc(doc(db, 'directors', editingDirector.id), {
          ...processedData,
          updatedAt: serverTimestamp()
        });
      } else {
        await addDoc(collection(db, 'directors'), {
          ...processedData,
          totalDeposit: 0,
          totalWithdrawal: 0,
          balance: 0,
          totalProfitReceived: 0,
          totalProfitWithdrawn: 0,
          profitBalance: 0,
          createdAt: serverTimestamp()
        });
      }
      setShowAddModal(false);
      setEditingDirector(null);
      setFormData({ 
        name: '', 
        fatherName: '',
        mobile: '', 
        profession: '', 
        address: '', 
        email: '', 
        photoUrl: '' 
      });
    } catch (error) {
      console.error("Error saving director:", error);
    }
  };

  const handleDeleteDirector = async (id: string) => {
    const director = directors.find(d => d.id === id);
    if (director && director.balance !== 0) {
      setErrorModal('পরিচালকের ব্যালেন্স জিরো না হওয়া পর্যন্ত ডিলিট করা যাবে না। দয়া করে আগে ব্যালেন্স উত্তোলন করুন।');
      setShowDeleteConfirm(null);
      return;
    }
    try {
      await deleteDoc(doc(db, 'directors', id));
      setShowDeleteConfirm(null);
    } catch (error) {
      console.error('Error deleting director:', error);
      setErrorModal("পরিচালক ডিলিট করতে সমস্যা হয়েছে");
    }
  };

  const handleDeleteTransaction = async (tr: any) => {
    try {
      const batch = writeBatch(db);
      batch.delete(doc(db, 'director_transactions', tr.id));
      
      const directorRef = doc(db, 'directors', tr.directorId);
      if (tr.type === 'deposit') {
        batch.update(directorRef, {
          totalDeposit: increment(-tr.amount),
          balance: increment(-tr.amount)
        });
      } else if (tr.type === 'withdrawal') {
        batch.update(directorRef, {
          totalWithdrawal: increment(-tr.amount),
          balance: increment(tr.amount)
        });
      } else if (tr.type === 'profit_distribution') {
        batch.update(directorRef, {
          totalProfitReceived: increment(-tr.amount),
          profitBalance: increment(-tr.amount)
        });
      } else if (tr.type === 'profit_withdraw') {
        batch.update(directorRef, {
          totalProfitWithdrawn: increment(-tr.amount),
          profitBalance: increment(tr.amount)
        });
      }
      
      await batch.commit();
      setShowDeleteConfirm(null);
    } catch (error) {
      console.error("Error deleting transaction:", error);
      setErrorModal("লেনদেন ডিলিট করতে সমস্যা হয়েছে");
    }
  };

  const filtered = directors.filter(d => 
    d.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    d.mobile.includes(searchTerm)
  );

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {selectedDirector && activeTab !== 'list' ? (
        <div className="fixed inset-0 top-[calc(env(safe-area-inset-top)+64px)] bottom-[calc(env(safe-area-inset-bottom)+64px)] z-20 bg-white flex flex-col animate-in slide-in-from-right duration-300">
          {/* Compact Header - Flat Design */}
          <div className="bg-white border-b border-slate-200 px-3 py-2 flex items-center justify-between sticky top-0 z-10">
            <div className="flex items-center gap-3">
              <div className="text-right">
                <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">
                  {activeTab === 'info' ? 'পরিচালক প্রোফাইল' : 'লেনদেন বিবরণী'}
                </h3>
                <p className="text-xs font-black text-slate-800 leading-none">{selectedDirector.name}</p>
              </div>
              <div className="h-6 w-px bg-slate-200"></div>
              <div className="text-right">
                <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">নিট ব্যালেন্স</h3>
                <p className="text-xs font-black text-emerald-600 leading-none">{formatCurrency(selectedDirector.balance)}</p>
              </div>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto bg-white">
            {activeTab === 'info' ? (
              <div className="p-4 space-y-6">
                <div className="flex flex-col items-center text-center space-y-3">
                  <div className="w-24 h-24 rounded-full bg-slate-100 border-2 border-slate-200 shadow-sm overflow-hidden">
                    {selectedDirector.photoUrl ? (
                      <img 
                        src={getDirectDriveUrl(selectedDirector.photoUrl)} 
                        alt="" 
                        className="w-full h-full object-cover" 
                        referrerPolicy="no-referrer" 
                        loading="lazy"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-slate-300">
                        <User size={40} />
                      </div>
                    )}
                  </div>
                  <div>
                    <h3 className="text-lg font-black text-slate-800">{selectedDirector.name}</h3>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">পিতা: {selectedDirector.fatherName || 'N/A'}</p>
                    <p className="text-xs font-bold text-emerald-600">{selectedDirector.profession}</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-3">
                  <div className="bg-slate-50 p-3 border border-slate-200 space-y-2">
                    <div className="flex items-center gap-2 text-slate-600">
                      <Phone size={14} className="text-emerald-600" />
                      <a 
                        href={`tel:${selectedDirector.mobile}`}
                        className="text-xs font-bold text-emerald-600 hover:text-emerald-700 hover:underline transition-colors"
                      >
                        {selectedDirector.mobile}
                      </a>
                    </div>
                    <div className="flex items-center gap-2 text-slate-600">
                      <Mail size={14} className="text-emerald-600" />
                      <span className="text-xs font-bold">{selectedDirector.email || 'N/A'}</span>
                    </div>
                    <div className="flex items-start gap-2 text-slate-600">
                      <MapPin size={14} className="text-emerald-600 mt-0.5" />
                      <span className="text-xs font-bold">{selectedDirector.address || 'N/A'}</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="bg-slate-50 p-4 border border-slate-200 rounded-2xl space-y-3">
                      <h4 className="text-xs font-black text-slate-800 border-b border-slate-200 pb-2 flex items-center gap-2">
                        <Wallet size={14} className="text-emerald-600" />
                        মূল হিসাব
                      </h4>
                      <div className="flex justify-between items-center">
                        <span className="text-[10px] font-black text-slate-500 uppercase">মোট জমা</span>
                        <span className="text-sm font-black text-emerald-600">{formatCurrency(stats.totalDeposit)}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-[10px] font-black text-slate-500 uppercase">মোট উত্তোলন</span>
                        <span className="text-sm font-black text-rose-600">{formatCurrency(stats.totalWithdrawal)}</span>
                      </div>
                      <div className="flex justify-between items-center pt-2 border-t border-slate-200">
                        <span className="text-[10px] font-black text-slate-500 uppercase">ব্যালেন্স</span>
                        <span className="text-sm font-black text-emerald-600">{formatCurrency(currentBalance)}</span>
                      </div>
                    </div>

                    <div className="bg-slate-50 p-4 border border-slate-200 rounded-2xl space-y-3">
                      <h4 className="text-xs font-black text-slate-800 border-b border-slate-200 pb-2 flex items-center gap-2">
                        <History size={14} className="text-blue-600" />
                        মুনাফা হিসাব
                      </h4>
                      <div className="flex justify-between items-center">
                        <span className="text-[10px] font-black text-slate-500 uppercase">মোট মুনাফা গ্রহণ</span>
                        <span className="text-sm font-black text-blue-600">{formatCurrency(stats.totalProfitReceived)}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-[10px] font-black text-slate-500 uppercase">মোট মুনাফা উত্তোলন</span>
                        <span className="text-sm font-black text-amber-600">{formatCurrency(stats.totalProfitWithdrawn)}</span>
                      </div>
                      <div className="flex justify-between items-center pt-2 border-t border-slate-200">
                        <span className="text-[10px] font-black text-slate-500 uppercase">মুনাফা ব্যালেন্স</span>
                        <span className="text-sm font-black text-blue-600">{formatCurrency(currentProfitBalance)}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="p-0">
                <div className="-mt-px">
                  <DataTable
                    columns={transactionColumns}
                    data={(() => {
                      let balance = 0;
                      return transactions
                        .sort((a, b) => {
                          const dateCompare = a.date.localeCompare(b.date);
                          if (dateCompare !== 0) return dateCompare;
                          return (a.createdAt?.seconds || 0) - (b.createdAt?.seconds || 0);
                        })
                        .map(tr => {
                          if (tr.type === 'deposit') balance += tr.amount;
                          else balance -= tr.amount;
                          return { ...tr, runningBalance: balance };
                        })
                        .reverse();
                    })()}
                    keyExtractor={(tr) => tr.id}
                    emptyMessage="এই পরিচালকের কোন লেনদেন ইতিহাস পাওয়া যায়নি"
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      ) : (
        <>
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-xl font-black text-slate-800">পরিচালক তালিকা</h2>
              <p className="text-xs font-bold text-slate-400">মোট পরিচালক: {toBengaliNumber(directors.length)}</p>
            </div>
            {(role === 'super_admin') && (
              <button 
                onClick={() => {
                  setEditingDirector(null);
                  setFormData({ 
                    name: '', 
                    fatherName: '',
                    mobile: '', 
                    profession: '', 
                    address: '', 
                    email: '', 
                    photoUrl: '' 
                  });
                  setShowAddModal(true);
                }}
                className="bg-emerald-600 text-white px-6 py-3 rounded-2xl shadow-lg shadow-emerald-200 hover:bg-emerald-700 transition-all flex items-center gap-2 font-bold active:scale-95"
              >
                <UserPlus size={20} /> নতুন পরিচালক
              </button>
            )}
          </div>

          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
            <input 
              type="text" 
              placeholder="নাম অথবা মোবাইল দিয়ে খুঁজুন..."
              className="w-full pl-12 pr-4 py-3 bg-white border border-slate-200 rounded-[20px] shadow-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 font-bold text-sm"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          <div className="bg-white">
            <DataTable
              columns={directorColumns}
              data={directors.filter(d => 
                d.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                d.mobile.includes(searchTerm)
              )}
              keyExtractor={(d) => d.id}
              emptyMessage="কোন পরিচালক পাওয়া যায়নি"
            />
          </div>
        </>
      )}

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
                <Info size={40} />
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

      {/* Action Menu Portal */}
      <AnimatePresence>
        {openMenuId && activeMenuDirector && menuPosition && (
          <>
            <div 
              className="fixed inset-0 z-[1000]" 
              onClick={() => setOpenMenuId(null)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: -10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: -10 }}
              style={{ 
                position: 'absolute',
                top: menuPosition.top,
                left: menuPosition.left,
              }}
              className="z-[1001] w-64 bg-white rounded-2xl shadow-2xl border border-slate-100 overflow-hidden"
            >
              <div className="p-2 space-y-1">
                <button
                  onClick={() => {
                    setSelectedDirector(activeMenuDirector);
                    setActiveTab('info');
                    setOpenMenuId(null);
                  }}
                  className="w-full flex items-center gap-3 px-4 py-3 text-sm font-bold text-slate-600 hover:bg-emerald-50 hover:text-emerald-600 rounded-xl transition-colors"
                >
                  <User size={18} /> প্রোফাইল দেখুন
                </button>
                <button
                  onClick={() => {
                    setSelectedDirector(activeMenuDirector);
                    setActiveTab('transactions');
                    setOpenMenuId(null);
                  }}
                  className="w-full flex items-center gap-3 px-4 py-3 text-sm font-bold text-slate-600 hover:bg-blue-50 hover:text-blue-600 rounded-xl transition-colors"
                >
                  <History size={18} /> লেনদেন দেখুন
                </button>
                {(role === 'super_admin') && (
                  <button
                    onClick={() => {
                      setEditingDirector(activeMenuDirector);
                      setFormData({
                        name: activeMenuDirector.name,
                        fatherName: activeMenuDirector.fatherName || '',
                        mobile: activeMenuDirector.mobile,
                        profession: activeMenuDirector.profession,
                        address: activeMenuDirector.address,
                        email: activeMenuDirector.email,
                        photoUrl: activeMenuDirector.photoUrl
                      });
                      setShowAddModal(true);
                      setOpenMenuId(null);
                    }}
                    className="w-full flex items-center gap-3 px-4 py-3 text-sm font-bold text-slate-600 hover:bg-amber-50 hover:text-amber-600 rounded-xl transition-colors"
                  >
                    <Edit size={18} /> তথ্য পরিবর্তন
                  </button>
                )}
                {role === 'super_admin' && (
                  <button
                    onClick={() => {
                      setShowDeleteConfirm({ id: activeMenuDirector.id, type: 'director' });
                      setOpenMenuId(null);
                    }}
                    className="w-full flex items-center gap-3 px-4 py-3 text-sm font-bold text-rose-600 hover:bg-rose-50 rounded-xl transition-colors"
                  >
                    <Trash2 size={18} /> ডিলিট করুন
                  </button>
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showDeleteConfirm && (
          <div className="fixed inset-0 z-[2000] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-[32px] w-full max-w-sm overflow-hidden shadow-2xl p-8 text-center"
            >
              <div className="w-20 h-20 bg-rose-50 text-rose-500 rounded-full flex items-center justify-center mx-auto mb-6">
                <Trash2 size={40} />
              </div>
              <h3 className="text-xl font-black text-slate-800 mb-2">আপনি কি নিশ্চিত?</h3>
              <p className="text-slate-500 font-bold mb-8">
                {showDeleteConfirm.type === 'director' 
                  ? 'এই পরিচালককে ডিলিট করলে তার সকল তথ্য এবং লেনদেন মুছে যাবে।' 
                  : 'এই লেনদেনটি ডিলিট করলে ব্যালেন্স পুনরায় সমন্বয় করা হবে।'}
              </p>
              <div className="flex gap-4">
                <button 
                  onClick={() => setShowDeleteConfirm(null)}
                  className="flex-1 py-4 bg-slate-100 text-slate-600 font-bold rounded-2xl hover:bg-slate-200 transition-colors"
                >
                  বাতিল
                </button>
                <button 
                  onClick={() => {
                    if (showDeleteConfirm.type === 'director') {
                      handleDeleteDirector(showDeleteConfirm.id);
                    } else {
                      handleDeleteTransaction(showDeleteConfirm.data);
                    }
                  }}
                  className="flex-1 py-4 bg-rose-600 text-white font-bold rounded-2xl shadow-lg shadow-rose-200 hover:bg-rose-700 transition-all active:scale-95"
                >
                  ডিলিট করুন
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showAddModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white w-full max-w-lg rounded-[40px] shadow-2xl overflow-hidden"
            >
              <div className="bg-emerald-600 p-6 flex justify-between items-center text-white">
                <h3 className="text-xl font-bold flex items-center gap-2">
                  <UserPlus size={24} />
                  {editingDirector ? 'পরিচালক তথ্য পরিবর্তন' : 'নতুন পরিচালক যোগ করুন'}
                </h3>
                <button onClick={() => setShowAddModal(false)} className="p-2 hover:bg-white/10 rounded-full transition-colors">
                  <X size={24} />
                </button>
              </div>
              <form onSubmit={handleSubmit} className="p-6 space-y-3 max-h-[80vh] overflow-y-auto">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-500 ml-1">পরিচালকের নাম</label>
                    <input 
                      required
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 font-bold text-sm"
                      value={formData.name}
                      onChange={e => setFormData({...formData, name: e.target.value})}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-500 ml-1">পিতার নাম</label>
                    <input 
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 font-bold text-sm"
                      value={formData.fatherName}
                      onChange={e => setFormData({...formData, fatherName: e.target.value})}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-500 ml-1">মোবাইল নম্বর</label>
                    <input 
                      required
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 font-bold text-sm"
                      value={formData.mobile}
                      onChange={e => setFormData({...formData, mobile: e.target.value})}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-500 ml-1">পেশা</label>
                    <input 
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 font-bold text-sm"
                      value={formData.profession}
                      onChange={e => setFormData({...formData, profession: e.target.value})}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-500 ml-1">ইমেল আইডি</label>
                    <input 
                      type="email"
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 font-bold text-sm"
                      value={formData.email}
                      onChange={e => setFormData({...formData, email: e.target.value})}
                    />
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-500 ml-1">ঠিকানা</label>
                  <textarea 
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 font-bold text-sm"
                    value={formData.address}
                    onChange={e => setFormData({...formData, address: e.target.value})}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-500 ml-1">প্রোফাইল ছবি (URL)</label>
                  <div className="relative">
                    <Camera className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                    <input 
                      className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 font-bold text-sm"
                      value={formData.photoUrl}
                      onChange={e => setFormData({...formData, photoUrl: e.target.value})}
                      placeholder="https://..."
                    />
                  </div>
                </div>
                <div className="pt-4 flex gap-3">
                  <button 
                    type="button"
                    onClick={() => setShowAddModal(false)}
                    className="flex-1 py-3 bg-slate-100 text-slate-600 font-bold rounded-xl hover:bg-slate-200 transition-colors text-sm"
                  >
                    বাতিল
                  </button>
                  <button 
                    type="submit"
                    className="flex-1 py-3 bg-emerald-600 text-white font-bold rounded-xl shadow-lg shadow-emerald-200 hover:bg-emerald-700 transition-all active:scale-95 text-sm"
                  >
                    {editingDirector ? 'আপডেট করুন' : 'সংরক্ষণ করুন'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showTransactionModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white rounded-[32px] w-full max-w-md overflow-hidden shadow-2xl"
            >
              <div className="bg-emerald-600 p-6 text-white flex justify-between items-center">
                <h3 className="text-xl font-black">লেনদেন করুন</h3>
                <button onClick={() => setShowTransactionModal(false)} className="p-2 hover:bg-white/10 rounded-xl transition-colors">
                  <X size={24} />
                </button>
              </div>
              <form onSubmit={handleTransactionSubmit} className="p-6 space-y-5">
                <div className="grid grid-cols-2 gap-2 bg-slate-100 p-1 rounded-xl">
                  <button
                    type="button"
                    onClick={() => setTransactionType('deposit')}
                    className={cn(
                      "py-2.5 rounded-lg text-[10px] font-black transition-all uppercase tracking-wider",
                      transactionType === 'deposit' ? "bg-white text-emerald-600 shadow-sm" : "text-slate-500"
                    )}
                  >
                    জমা
                  </button>
                  <button
                    type="button"
                    onClick={() => setTransactionType('withdrawal')}
                    className={cn(
                      "py-2.5 rounded-lg text-[10px] font-black transition-all uppercase tracking-wider",
                      transactionType === 'withdrawal' ? "bg-white text-rose-600 shadow-sm" : "text-slate-500"
                    )}
                  >
                    উত্তোলন
                  </button>
                  <button
                    type="button"
                    onClick={() => setTransactionType('profit_distribution')}
                    className={cn(
                      "py-2.5 rounded-lg text-[10px] font-black transition-all uppercase tracking-wider",
                      transactionType === 'profit_distribution' ? "bg-white text-blue-600 shadow-sm" : "text-slate-500"
                    )}
                  >
                    মুনাফা গ্রহণ
                  </button>
                  <button
                    type="button"
                    onClick={() => setTransactionType('profit_withdraw')}
                    className={cn(
                      "py-2.5 rounded-lg text-[10px] font-black transition-all uppercase tracking-wider",
                      transactionType === 'profit_withdraw' ? "bg-white text-amber-600 shadow-sm" : "text-slate-500"
                    )}
                  >
                    মুনাফা উত্তোলন
                  </button>
                </div>

                <div className="space-y-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-500 ml-1">পরিমাণ</label>
                    <input 
                      type="number"
                      required
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 font-bold text-base text-center"
                      value={transactionData.amount}
                      onChange={e => setTransactionData({...transactionData, amount: e.target.value})}
                      placeholder="0.00"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-500 ml-1">তারিখ</label>
                    <input 
                      type="date"
                      required
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 font-bold text-sm"
                      value={transactionData.date}
                      onChange={e => setTransactionData({...transactionData, date: e.target.value})}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-500 ml-1">নোট (ঐচ্ছিক)</label>
                    <textarea 
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 font-bold text-sm"
                      value={transactionData.note}
                      onChange={e => setTransactionData({...transactionData, note: e.target.value})}
                      placeholder="লেনদেন সম্পর্কে কিছু লিখুন..."
                    />
                  </div>
                </div>

                <div className="pt-4 flex gap-3">
                  <button 
                    type="button"
                    onClick={() => setShowTransactionModal(false)}
                    className="flex-1 py-3 bg-slate-100 text-slate-600 font-bold rounded-xl hover:bg-slate-200 transition-colors text-sm"
                  >
                    বাতিল
                  </button>
                  <button 
                    type="submit"
                    className={cn(
                      "flex-1 py-3 text-white font-bold rounded-xl shadow-lg transition-all active:scale-95 text-sm",
                      transactionType === 'deposit' ? "bg-emerald-600 shadow-emerald-200 hover:bg-emerald-700" : "bg-rose-600 shadow-rose-200 hover:bg-rose-700"
                    )}
                  >
                    নিশ্চিত করুন
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
