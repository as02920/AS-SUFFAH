import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, addDoc, doc, updateDoc, increment, serverTimestamp, deleteDoc, query, where, getDocs, orderBy } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from './firebase';
import { useAuth } from './AuthContext';
import { formatCurrency, toBengaliNumber, cn, formatNumberWithCommas, parseNumberFromCommas, getDirectDriveUrl } from './lib/utils';
import { Plus, Search, MoreVertical, Trash2, FileText, Info, Award, X, User, ShieldCheck, Calendar, DollarSign, Package, Clock, Users, MapPin, Phone, CheckCircle2, List, ChevronDown, Printer, Download, ArrowLeft, Hash, Receipt, AlertCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { DataTable } from './components/DataTable';

export const Investments = () => {
  const { role, user } = useAuth();
  const [investments, setInvestments] = useState<any[]>([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('চলমান');
  const [activeActionMenu, setActiveActionMenu] = useState<string | null>(null);
  const [menuPosition, setMenuPosition] = useState({ top: 0, left: 0, isUpward: false });
  const [successMessage, setSuccessMessage] = useState('');
  
  // Action Modals State
  const [selectedInvestment, setSelectedInvestment] = useState<any>(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [showTransactionsModal, setShowTransactionsModal] = useState(false);
  const [showGuarantorsModal, setShowGuarantorsModal] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState(0);
  const [fineAmount, setFineAmount] = useState(0);
  const [showVoucherModal, setShowVoucherModal] = useState(false);
  const [lastTransaction, setLastTransaction] = useState<any>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [errorModal, setErrorModal] = useState<string | null>(null);
  const [transactions, setTransactions] = useState<any[]>([]);
  
  // Search state
  const [searchAccount, setSearchAccount] = useState('');
  const [foundCustomer, setFoundCustomer] = useState<any>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState('');

  const initialInvestmentData = {
    amount: '',
    profitPercent: '',
    profitAmount: '',
    totalAmount: 0,
    installmentCount: '1',
    perInstallment: 0,
    productInfo: '',
    startDate: new Date().toISOString().split('T')[0],
    endDate: '',
    investmentType: 'মাসিক',
  };

  const initialGuarantorData = {
    name: '',
    fatherName: '',
    motherName: '',
    mobile: '',
    nid: '',
    dob: '',
    profession: '',
    relationship: '',
    address: { village: '', postOffice: '', thana: '', district: '' }
  };

  const [investmentData, setInvestmentData] = useState(initialInvestmentData);
  const [guarantors, setGuarantors] = useState<any[]>([initialGuarantorData]);

  useEffect(() => {
    const onBack = (e: Event) => {
      if (showDetailsModal) {
        e.preventDefault();
        setShowDetailsModal(false);
      } else if (showTransactionsModal) {
        e.preventDefault();
        setShowTransactionsModal(false);
      } else if (showGuarantorsModal) {
        e.preventDefault();
        setShowGuarantorsModal(false);
      } else if (showPaymentModal) {
        e.preventDefault();
        setShowPaymentModal(false);
      } else if (showAddModal) {
        e.preventDefault();
        setShowAddModal(false);
        setFoundCustomer(null);
        setSearchAccount('');
        setInvestmentData(initialInvestmentData);
        setGuarantors([initialGuarantorData]);
      }
    };
    window.addEventListener('app:back', onBack);
    return () => window.removeEventListener('app:back', onBack);
  }, [showDetailsModal, showTransactionsModal, showGuarantorsModal, showPaymentModal, showAddModal]);

  useEffect(() => {
    if (!role) return;
    const unsub = onSnapshot(collection(db, 'investments'), (snap) => {
      setInvestments(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'investments');
    });
    return unsub;
  }, [role]);

  useEffect(() => {
    if (successMessage) {
      const timer = setTimeout(() => setSuccessMessage(''), 3000);
      return () => clearTimeout(timer);
    }
  }, [successMessage]);

  const handleSearchCustomer = async () => {
    if (!searchAccount) return;
    setIsSearching(true);
    setSearchError('');
    try {
      const q = query(collection(db, 'customers'), where('accountNumber', '==', searchAccount));
      const snap = await getDocs(q);
      if (!snap.empty) {
        setFoundCustomer({ id: snap.docs[0].id, ...snap.docs[0].data() });
      } else {
        setSearchError('গ্রাহক খুঁজে পাওয়া যায়নি');
      }
    } catch (err) {
      setSearchError('সার্চ করতে সমস্যা হয়েছে');
    } finally {
      setIsSearching(false);
    }
  };

  const calculateProfit = (type: 'percent' | 'amount', value: string) => {
    const amount = parseFloat(investmentData.amount) || 0;
    if (type === 'percent') {
      const percent = parseFloat(value) || 0;
      const profit = (amount * percent) / 100;
      const total = amount + profit;
      const perInst = total / (parseInt(investmentData.installmentCount) || 1);
      setInvestmentData(prev => ({
        ...prev,
        profitPercent: value,
        profitAmount: profit.toString(),
        totalAmount: total,
        perInstallment: perInst
      }));
    } else {
      const profit = parseFloat(value) || 0;
      const percent = amount > 0 ? (profit / amount) * 100 : 0;
      const total = amount + profit;
      const perInst = total / (parseInt(investmentData.installmentCount) || 1);
      setInvestmentData(prev => ({
        ...prev,
        profitAmount: value,
        profitPercent: percent.toFixed(2),
        totalAmount: total,
        perInstallment: perInst
      }));
    }
  };

  const handleAmountChange = (val: string) => {
    const rawValue = parseNumberFromCommas(val);
    const amount = parseFloat(rawValue) || 0;
    const percent = parseFloat(investmentData.profitPercent) || 0;
    const profit = (amount * percent) / 100;
    const total = amount + profit;
    const perInst = total / (parseInt(investmentData.installmentCount) || 1);
    setInvestmentData(prev => ({
      ...prev,
      amount: rawValue,
      profitAmount: profit.toString(),
      totalAmount: total,
      perInstallment: perInst
    }));
  };

  const handleInstallmentChange = (val: string) => {
    const count = parseInt(val) || 1;
    const perInst = investmentData.totalAmount / count;
    setInvestmentData(prev => ({
      ...prev,
      installmentCount: val,
      perInstallment: perInst
    }));
  };

  const handleAddGuarantor = () => {
    setGuarantors([...guarantors, initialGuarantorData]);
  };

  const updateGuarantor = (index: number, field: string, value: any) => {
    const newGuarantors = [...guarantors];
    if (field.includes('.')) {
      const [parent, child] = field.split('.');
      newGuarantors[index][parent][child] = value;
    } else {
      newGuarantors[index][field] = value;
    }
    setGuarantors(newGuarantors);
  };

  const [formTab, setFormTab] = useState<'investment' | 'guarantors'>('investment');

  const handleSubmit = async () => {
    if (!foundCustomer) return;
    if (role !== 'super_admin') return;

    // Basic validation
    if (!investmentData.amount || !investmentData.installmentCount) {
      setErrorModal('দয়া করে বিনিয়োগের পরিমাণ এবং কিস্তির সংখ্যা প্রদান করুন');
      return;
    }

    setIsSubmitting(true);
    try {
      await addDoc(collection(db, 'investments'), {
        ...investmentData,
        guarantors,
        customerId: foundCustomer.id,
        customerName: foundCustomer.name,
        customerAccountNumber: foundCustomer.accountNumber,
        paidAmount: 0,
        dueAmount: investmentData.totalAmount,
        status: 'চলমান',
        createdAt: serverTimestamp(),
        createdBy: user?.name || user?.email || 'unknown',
        createdByUserId: user?.uid || 'unknown'
      });

      // Reset
      setShowAddModal(false);
      setFoundCustomer(null);
      setSearchAccount('');
      setInvestmentData(initialInvestmentData);
      setGuarantors([initialGuarantorData]);
      setFormTab('investment');
      setSuccessMessage('বিনিয়োগ সফলভাবে সংরক্ষণ করা হয়েছে');
    } catch (err) {
      console.error("Error saving investment:", err);
      setErrorModal('বিনিয়োগ সংরক্ষণ করতে সমস্যা হয়েছে');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    setIsDeleting(true);
    try {
      await deleteDoc(doc(db, 'investments', id));
      setActiveActionMenu(null);
      setSuccessMessage('বিনিয়োগ ডিলিট করা হয়েছে');
    } catch (err) {
      console.error("Error deleting investment:", err);
      setErrorModal('বিনিয়োগ ডিলিট করতে সমস্যা হয়েছে');
    } finally {
      setIsDeleting(false);
    }
  };

  const filtered = investments.filter(inv => {
    const matchesSearch = inv.customerAccountNumber?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         inv.customerName?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'সব' || inv.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const columns = [
    {
      header: 'একশন',
      render: (inv: any) => (
        <div className="relative text-center">
          <button 
            onClick={(e) => {
              e.stopPropagation();
              const rect = e.currentTarget.getBoundingClientRect();
              const windowHeight = window.innerHeight;
              const isUpward = rect.bottom > windowHeight - 300;
              
              setMenuPosition({
                top: isUpward ? rect.top : rect.bottom,
                left: rect.left,
                isUpward
              });
              setActiveActionMenu(activeActionMenu === inv.id ? null : inv.id);
            }}
            className="flex items-center gap-1 px-3 py-2 bg-slate-100 border border-slate-200 rounded-xl hover:bg-slate-200 transition-all text-slate-700 mx-auto shadow-sm active:scale-95"
          >
            <List size={16} />
            <ChevronDown size={12} className={cn("transition-transform duration-300", activeActionMenu === inv.id && "rotate-180")} />
          </button>
          
          <AnimatePresence>
            {activeActionMenu === inv.id && (
              <>
                <div className="fixed inset-0 z-[100]" onClick={() => setActiveActionMenu(null)}></div>
                <motion.div 
                  initial={{ opacity: 0, scale: 0.95, y: menuPosition.isUpward ? 10 : -10 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95, y: menuPosition.isUpward ? 10 : -10 }}
                  style={{ 
                    position: 'fixed',
                    top: menuPosition.isUpward ? 'auto' : menuPosition.top + 8,
                    bottom: menuPosition.isUpward ? (window.innerHeight - menuPosition.top) + 8 : 'auto',
                    left: Math.max(16, Math.min(window.innerWidth - 256, menuPosition.left - 180)),
                    width: '240px'
                  }}
                  className="bg-white rounded-2xl shadow-[0_20px_70px_rgba(0,0,0,0.2)] border border-slate-100 z-[101] py-2 overflow-hidden text-left"
                >
                  <button 
                    onClick={() => {
                      setSelectedInvestment(inv);
                      fetchTransactions(inv.id);
                      setShowTransactionsModal(true);
                      setActiveActionMenu(null);
                    }}
                    className="w-full flex items-center gap-3 px-4 py-3 text-sm font-bold text-slate-700 hover:bg-blue-50 hover:text-blue-700 transition-colors border-b border-slate-50"
                  >
                    <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center text-blue-600">
                      <FileText size={16} />
                    </div>
                    <span>লেনদেনের তালিকা</span>
                  </button>
                  <button 
                    onClick={() => {
                      setSelectedInvestment(inv);
                      setShowDetailsModal(true);
                      setActiveActionMenu(null);
                    }}
                    className="w-full flex items-center gap-3 px-4 py-3 text-sm font-bold text-slate-700 hover:bg-slate-50 transition-colors border-b border-slate-50"
                  >
                    <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center text-slate-600">
                      <Printer size={16} />
                    </div>
                    <span>বিনিয়োগ তথ্য প্রিন্ট</span>
                  </button>
                  <button 
                    onClick={() => {
                      setSelectedInvestment(inv);
                      setShowGuarantorsModal(true);
                      setActiveActionMenu(null);
                    }}
                    className="w-full flex items-center gap-3 px-4 py-3 text-sm font-bold text-slate-700 hover:bg-indigo-50 hover:text-indigo-700 transition-colors border-b border-slate-50"
                  >
                    <div className="w-8 h-8 rounded-lg bg-indigo-100 flex items-center justify-center text-indigo-600">
                      <ShieldCheck size={16} />
                    </div>
                    <span>জামিনদারের বিবরণ</span>
                  </button>
                  {role === 'super_admin' && (
                    <button 
                      onClick={() => handleDelete(inv.id)}
                      className="w-full flex items-center gap-3 px-4 py-3 text-sm font-bold text-rose-600 hover:bg-rose-50 transition-colors"
                    >
                      <div className="w-8 h-8 rounded-lg bg-rose-100 flex items-center justify-center text-rose-600">
                        <Trash2 size={16} />
                      </div>
                      <span>ডিলিট বিনিয়োগ</span>
                    </button>
                  )}
                </motion.div>
              </>
            )}
          </AnimatePresence>
        </div>
      ),
      headerClassName: "text-center"
    },
    { header: 'ক্রমিক', render: (_: any, index: number) => toBengaliNumber(index + 1), className: "text-center font-bold text-slate-500" },
    { header: 'সদস্যের নাম', accessor: 'customerName', className: "font-bold text-slate-800" },
    { header: 'হিসাব নম্বর', accessor: 'customerAccountNumber', className: "font-mono font-bold text-emerald-700" },
    { header: 'বিনিয়োগের ধরন', accessor: 'investmentType' },
    { header: 'সময়কাল', render: (inv: any) => `${toBengaliNumber(inv.installmentCount)} কিস্তি` },
    { header: 'প্রতি কিস্তি', render: (inv: any) => formatCurrency(inv.perInstallment) },
    { header: 'পণ্য', accessor: 'productInfo' },
    { header: 'আসল', render: (inv: any) => formatCurrency(inv.amount) },
    { header: 'মুনাফা', render: (inv: any) => formatCurrency(inv.profitAmount) },
    { header: 'মোট', render: (inv: any) => formatCurrency(inv.totalAmount) },
    { header: 'পরিশোধিত', render: (inv: any) => formatCurrency(inv.paidAmount || 0), className: "text-emerald-600 font-bold" },
    { header: 'বকেয়া', render: (inv: any) => formatCurrency(inv.totalAmount - (inv.paidAmount || 0)), className: "text-rose-600 font-bold" },
    { 
      header: 'স্ট্যাটাস', 
      render: (inv: any) => (
        <span className={cn(
          "px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider",
          inv.status === 'চলমান' ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-700"
        )}>
          {inv.status}
        </span>
      )
    }
  ];

  const investmentTransactionColumns = [
    { header: 'ক্রমিক', render: (_: any, index: number) => toBengaliNumber(index + 1), className: "text-center font-bold text-slate-500" },
    { header: 'কোড', accessor: 'code', className: "font-mono" },
    { header: 'তারিখ', render: (tr: any) => formatDate(tr.date) },
    { header: 'জমার পরিমাণ', render: (tr: any) => formatCurrency(tr.amount), className: "font-bold" },
    { header: 'জরিমানা', render: (tr: any) => formatCurrency(tr.fine || 0), className: "text-rose-600" },
    { header: 'বিবরণ', render: (tr: any) => tr.description || 'কিস্তি আদায়' },
    { header: 'এন্টির তারিখ', render: (tr: any) => formatDate(tr.createdAt) },
    { header: 'প্রক্রিয়াকারী', accessor: 'processedBy' },
    {
      header: 'একশন',
      render: (tr: any) => (
        <div className="flex justify-center gap-2">
          <button 
            onClick={() => {
              setLastTransaction(tr);
              setShowVoucherModal(true);
            }}
            className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"
            title="ভাউচার প্রিন্ট"
          >
            <Printer size={16} />
          </button>
          {role === 'super_admin' && (
            <button 
              onClick={(e) => {
                e.stopPropagation();
                handleDeleteTransaction(tr);
              }}
              className="p-1.5 text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
              title="ডিলিট"
            >
              <Trash2 size={16} />
            </button>
          )}
        </div>
      ),
      headerClassName: "text-center"
    }
  ];

  const formatDate = (date: any) => {
    if (!date) return '';
    let dateStr = '';
    if (typeof date === 'string') {
      dateStr = date;
    } else if (date && typeof date.toDate === 'function') {
      dateStr = date.toDate().toISOString();
    } else {
      return '';
    }
    const datePart = dateStr.split('T')[0];
    const [y, m, d] = datePart.split('-');
    return `${d}-${m}-${y}`;
  };

  const fetchTransactions = async (investmentId: string) => {
    const q = query(collection(db, 'transactions'), where('investmentId', '==', investmentId));
    const snap = await getDocs(q);
    const trs = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as any));
    
    // Sort on client side to avoid composite index requirement
    trs.sort((a: any, b: any) => {
      const timeA = a.createdAt?.seconds || 0;
      const timeB = b.createdAt?.seconds || 0;
      return timeB - timeA;
    });
    
    setTransactions(trs);
  };

  const handlePayment = async (amount: number, fine: number, date: string, description: string) => {
    if (!selectedInvestment) return;
    
    try {
      const newPaidAmount = (selectedInvestment.paidAmount || 0) + amount;
      const newDueAmount = selectedInvestment.totalAmount - newPaidAmount;
      const isFullyPaid = newDueAmount <= 0;
      
      // 1. Update Investment
      await updateDoc(doc(db, 'investments', selectedInvestment.id), {
        paidAmount: newPaidAmount,
        dueAmount: Math.max(0, newDueAmount),
        status: isFullyPaid ? 'পরিশোধিত' : 'চলমান',
        lastPaymentDate: date
      });
      
      // 2. Add Transaction
      const transactionData = {
        investmentId: selectedInvestment.id,
        customerId: selectedInvestment.customerId,
        customerName: selectedInvestment.customerName,
        customerAccountNumber: selectedInvestment.customerAccountNumber,
        amount: amount,
        fine: fine,
        totalWithFine: amount + fine,
        date: date,
        description: description,
        type: 'payment',
        createdAt: new Date().toISOString(), // Use ISO string for easier display in voucher
        processedBy: user?.name || user?.email || 'unknown',
        code: `TRX-${Math.random().toString(36).substr(2, 9).toUpperCase()}`,
        investmentTotal: selectedInvestment.totalAmount,
        investmentDue: Math.max(0, newDueAmount)
      };

      await addDoc(collection(db, 'transactions'), {
        ...transactionData,
        createdAt: serverTimestamp()
      });
      
      setLastTransaction(transactionData);
      setShowPaymentModal(false);
      setShowVoucherModal(true);
      setSuccessMessage('পেমেন্ট সফলভাবে সম্পন্ন হয়েছে');
    } catch (err) {
      setErrorModal('পেমেন্ট প্রসেস করতে সমস্যা হয়েছে');
    }
  };

  const handleDeleteTransaction = async (tr: any) => {
    setIsDeleting(true);
    try {
      // 1. Delete Transaction
      await deleteDoc(doc(db, 'transactions', tr.id));
      
      // 2. Update Investment (reverse the payment)
      const invRef = doc(db, 'investments', tr.investmentId);
      
      await updateDoc(invRef, {
        paidAmount: increment(-tr.amount),
        dueAmount: increment(tr.amount),
        status: 'চলমান'
      });

      // Refresh transactions
      fetchTransactions(tr.investmentId);
      setSuccessMessage('লেনদেন ডিলিট করা হয়েছে');
    } catch (err) {
      console.error("Error deleting transaction:", err);
      setErrorModal('লেনদেন ডিলিট করতে সমস্যা হয়েছে');
    } finally {
      setIsDeleting(false);
    }
  };

  if (showTransactionsModal && selectedInvestment) {
    return (
      <div className="fixed inset-0 top-[calc(env(safe-area-inset-top)+64px)] bottom-[calc(env(safe-area-inset-bottom)+64px)] z-20 bg-white flex flex-col animate-in slide-in-from-right duration-300">
        {/* Sticky Header */}
        <div className="bg-white border-b border-slate-100 px-4 py-3 flex items-center justify-between sticky top-0 z-10 shadow-sm">
          <div className="flex items-center gap-2 ml-2">
            <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></div>
            <h2 className="text-base font-black text-slate-800 tracking-tight">লেনদেনের তালিকা</h2>
          </div>
          
          <div className="w-16 hidden md:block"></div>
        </div>

        <div className="flex-1 overflow-y-auto bg-slate-50/30">
          <div className="max-w-5xl mx-auto p-3 md:p-6 space-y-4">
            {/* Compact Investment Summary Card */}
            <div className="bg-[#003366] rounded-3xl p-5 text-white shadow-lg relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full -mr-16 -mt-16 blur-2xl"></div>
              
              <div className="relative z-10 flex flex-col gap-4">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-white/10 backdrop-blur-md rounded-2xl flex items-center justify-center border border-white/20">
                    <FileText size={24} className="text-emerald-400" />
                  </div>
                  <div>
                    <h3 className="text-xl font-black">{selectedInvestment.customerName}</h3>
                    <div className="flex items-center gap-1.5 text-blue-100/70 text-xs font-bold">
                      <Hash size={12} className="text-emerald-400" />
                      <span>হিসাব নম্বর: {toBengaliNumber(selectedInvestment.customerAccountNumber)}</span>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <div className="bg-white/5 backdrop-blur-sm p-2.5 rounded-2xl border border-white/10 text-center">
                    <p className="text-[9px] font-black uppercase tracking-widest text-blue-200 mb-0.5">মোট</p>
                    <p className="text-sm font-black">{formatCurrency(selectedInvestment.totalAmount)}</p>
                  </div>
                  <div className="bg-emerald-500/10 backdrop-blur-sm p-2.5 rounded-2xl border border-emerald-500/20 text-center">
                    <p className="text-[9px] font-black uppercase tracking-widest text-emerald-300 mb-0.5">পরিশোধিত</p>
                    <p className="text-sm font-black text-emerald-400">{formatCurrency(selectedInvestment.paidAmount)}</p>
                  </div>
                  <div className="bg-rose-500/10 backdrop-blur-sm p-2.5 rounded-2xl border border-rose-500/20 text-center">
                    <p className="text-[9px] font-black uppercase tracking-widest text-rose-300 mb-0.5">বকেয়া</p>
                    <p className="text-sm font-black text-rose-400">{formatCurrency(selectedInvestment.dueAmount)}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Transactions Table Section */}
            <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-50 bg-slate-50/50 flex items-center justify-between">
                <h3 className="text-sm font-black text-slate-800 flex items-center gap-2">
                  <Receipt size={16} className="text-emerald-600" />
                  লেনদেন বিবরণী
                </h3>
                <span className="text-[9px] font-black bg-white px-2.5 py-1 rounded-full border border-slate-200 text-slate-500 uppercase tracking-widest">
                  {toBengaliNumber(transactions.length)} টি লেনদেন
                </span>
              </div>

              <div className="p-0 overflow-x-auto">
                <DataTable 
                  columns={investmentTransactionColumns} 
                  data={transactions} 
                  keyExtractor={(tr) => tr.id} 
                  emptyMessage="কোন লেনদেন পাওয়া যায়নি"
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (showGuarantorsModal && selectedInvestment) {
    return (
      <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-20">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3 ml-2">
            <div className="w-3 h-3 rounded-full bg-indigo-500 animate-pulse" />
            <h2 className="text-lg font-black text-slate-800">জামিনদারের তথ্য</h2>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6">
          {selectedInvestment.guarantors && selectedInvestment.guarantors.length > 0 ? (
            selectedInvestment.guarantors.map((g: any, idx: number) => (
              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                key={idx} 
                className="bg-white rounded-[40px] shadow-xl border border-slate-100 overflow-hidden"
              >
                <div className="bg-indigo-600 p-6 text-white flex items-center gap-3">
                  <ShieldCheck size={24} />
                  <h3 className="text-xl font-black">জামিনদার {toBengaliNumber(idx + 1)}: {g.name}</h3>
                </div>
                <div className="p-8 grid grid-cols-1 md:grid-cols-3 gap-8">
                  <div className="space-y-6">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center">
                        <User size={22} />
                      </div>
                      <div>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">নাম</p>
                        <p className="text-lg font-black text-slate-700">{g.name}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center">
                        <Phone size={22} />
                      </div>
                      <div>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">মোবাইল</p>
                        <a 
                          href={`tel:${g.mobile}`}
                          className="text-lg font-black text-emerald-600 hover:text-emerald-700 hover:underline transition-colors"
                        >
                          {toBengaliNumber(g.mobile)}
                        </a>
                      </div>
                    </div>
                  </div>
                  <div className="space-y-6">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center">
                        <Users size={22} />
                      </div>
                      <div>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">সম্পর্ক</p>
                        <p className="text-lg font-black text-slate-700">{g.relationship}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-amber-50 text-amber-600 rounded-2xl flex items-center justify-center">
                        <Award size={22} />
                      </div>
                      <div>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">এনআইডি</p>
                        <p className="text-lg font-black text-slate-700">{toBengaliNumber(g.nid)}</p>
                      </div>
                    </div>
                  </div>
                  <div className="space-y-6">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-purple-50 text-purple-600 rounded-2xl flex items-center justify-center">
                        <MapPin size={22} />
                      </div>
                      <div>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">ঠিকানা</p>
                        <p className="text-lg font-black text-slate-700">{g.address?.village}, {g.address?.thana}, {g.address?.district}</p>
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            ))
          ) : (
            <div className="bg-white rounded-[40px] p-20 text-center border-2 border-dashed border-slate-200">
              <ShieldCheck size={64} className="mx-auto text-slate-200 mb-4" />
              <p className="text-xl font-black text-slate-400 italic">কোন জামিনদারের তথ্য পাওয়া যায়নি</p>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3 pb-96 animate-in fade-in duration-500">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-black text-slate-800">সকল বিনিয়োগ</h2>
        {role === 'super_admin' && (
          <button 
            onClick={() => setShowAddModal(true)}
            className="bg-emerald-600 text-white flex items-center gap-2 px-4 py-2 rounded-xl shadow-lg hover:bg-emerald-700 transition-all font-bold text-xs active:scale-95"
          >
            <Plus size={16} />
            <span>নতুন বিনিয়োগ</span>
          </button>
        )}
      </div>

      {/* Filter */}
      <div className="bg-white p-2 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
          <input 
            type="text" 
            placeholder="একাউন্ট নাম্বার বা নাম দিয়ে ফিল্টার করুন"
            className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 text-xs font-bold"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="w-32 md:w-40">
          <select 
            className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 font-black text-slate-700 text-[10px] uppercase"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="সব">সব</option>
            <option value="চলমান">চলমান</option>
            <option value="পরিশোধিত">পরিশোধিত</option>
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="-mt-1 relative">
        <DataTable 
          columns={columns} 
          data={filtered} 
          keyExtractor={(inv) => inv.id} 
        />
      </div>

      {/* Error Modal */}
      <AnimatePresence>
        {errorModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white rounded-3xl shadow-2xl max-w-sm w-full p-8 text-center border border-slate-100"
            >
              <div className="w-20 h-20 bg-rose-50 rounded-full flex items-center justify-center mx-auto mb-6">
                <AlertCircle className="text-rose-500" size={40} />
              </div>
              <h3 className="text-2xl font-black text-slate-800 mb-3 tracking-tight">ত্রুটি!</h3>
              <p className="text-slate-600 font-bold mb-8 leading-relaxed">
                {errorModal}
              </p>
              <button
                onClick={() => setErrorModal(null)}
                className="w-full py-4 bg-slate-900 text-white rounded-2xl font-black text-sm hover:bg-slate-800 transition-all active:scale-95 shadow-lg shadow-slate-200"
              >
                ঠিক আছে
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* New Investment Modal */}
      <AnimatePresence>
        {showAddModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md overflow-y-auto">
            <motion.div 
              initial={{ scale: 0.95, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 20 }}
              className="bg-slate-50 w-full max-w-6xl rounded-[40px] shadow-2xl overflow-hidden my-8"
            >
              {/* Header */}
              <div className="bg-[#003366] p-6 flex justify-between items-center">
                <h3 className="text-xl font-bold text-white flex items-center gap-2">
                  <Plus className="bg-emerald-500 rounded-lg p-1" size={24} />
                  নতুন বিনিয়োগ
                </h3>
                <button 
                  onClick={() => {
                    setShowAddModal(false);
                    setFoundCustomer(null);
                    setSearchAccount('');
                  }} 
                  className="p-2 hover:bg-white/10 text-white rounded-full transition-colors"
                >
                  <X size={24} />
                </button>
              </div>

              {!foundCustomer ? (
                /* Search Phase */
                <div className="p-12 text-center space-y-8">
                  <div className="max-w-md mx-auto space-y-6">
                    <div className="w-24 h-24 bg-emerald-50 text-emerald-600 rounded-[32px] flex items-center justify-center mx-auto shadow-inner border border-emerald-100">
                      <Search size={48} />
                    </div>
                    <div className="space-y-2">
                      <h4 className="text-3xl font-black text-slate-800">গ্রাহক খুঁজুন</h4>
                      <p className="text-slate-500 font-medium">বিনিয়োগ শুরু করতে গ্রাহকের একাউন্ট নাম্বার লিখুন</p>
                    </div>
                    <div className="space-y-4">
                      <div className="relative group">
                        <input 
                          type="text" 
                          placeholder="একাউন্ট নাম্বার লিখুন (যেমন: ১)"
                          className="w-full p-6 bg-white border-2 border-slate-100 rounded-3xl text-center text-3xl font-black text-[#003366] focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 focus:outline-none transition-all placeholder:text-slate-200"
                          value={searchAccount}
                          onChange={e => setSearchAccount(e.target.value)}
                          onKeyPress={e => e.key === 'Enter' && handleSearchCustomer()}
                        />
                      </div>
                      {searchError && (
                        <motion.p 
                          initial={{ opacity: 0, y: -10 }}
                          animate={{ opacity: 1, y: 0 }}
                          className="text-rose-500 font-bold bg-rose-50 py-2 rounded-xl"
                        >
                          {searchError}
                        </motion.p>
                      )}
                      <button 
                        onClick={handleSearchCustomer}
                        disabled={isSearching || !searchAccount}
                        className="w-full py-5 bg-emerald-600 text-white text-xl font-black rounded-3xl shadow-xl shadow-emerald-200 hover:bg-emerald-700 hover:-translate-y-1 active:translate-y-0 transition-all disabled:opacity-50 flex items-center justify-center gap-3"
                      >
                        {isSearching ? (
                          <div className="w-6 h-6 border-4 border-white/30 border-t-white rounded-full animate-spin" />
                        ) : (
                          <>
                            <Search size={24} />
                            <span>গ্রাহক খুঁজুন</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                /* Form Phase */
                <div className="p-0 max-h-[90vh] overflow-y-auto bg-[#F8FAFC]">
                  {/* Customer Info Header (Based on Image) */}
                  <div className="p-6 space-y-6 bg-white border-b border-slate-200">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {/* Primary Info Table */}
                      <div className="border border-slate-200 rounded-lg overflow-hidden">
                        <div className="bg-indigo-600 text-white px-4 py-2 font-bold text-lg">প্রাথমিক তথ্য</div>
                        <table className="w-full text-sm">
                          <tbody className="divide-y divide-slate-100">
                            <tr>
                              <td className="bg-slate-50 px-4 py-2 font-bold w-1/3 border-r border-slate-100">হিসাব নম্বর</td>
                              <td className="px-4 py-2 font-bold text-slate-700">{toBengaliNumber(foundCustomer.accountNumber)}</td>
                            </tr>
                            <tr>
                              <td className="bg-slate-50 px-4 py-2 font-bold w-1/3 border-r border-slate-100">নাম</td>
                              <td className="px-4 py-2 font-bold text-slate-700">{foundCustomer.name}</td>
                            </tr>
                            <tr>
                              <td className="bg-slate-50 px-4 py-2 font-bold w-1/3 border-r border-slate-100">এরিয়া</td>
                              <td className="px-4 py-2 font-bold text-slate-700">{foundCustomer.presentAddress?.village}</td>
                            </tr>
                            <tr>
                              <td className="bg-slate-50 px-4 py-2 font-bold w-1/3 border-r border-slate-100">সদস্যের পিতা-মাতা</td>
                              <td className="px-4 py-2 font-bold text-slate-700">{foundCustomer.fatherName} / {foundCustomer.motherName}</td>
                            </tr>
                          </tbody>
                        </table>
                      </div>

                      {/* Contact Info Table */}
                      <div className="border border-slate-200 rounded-lg overflow-hidden">
                        <div className="bg-emerald-500 text-white px-4 py-2 font-bold text-lg flex items-center gap-2">
                          <Phone size={18} /> যোগাযোগ ও অন্যান্য তথ্য
                        </div>
                        <table className="w-full text-sm">
                          <tbody className="divide-y divide-slate-100">
                            <tr>
                              <td className="bg-slate-50 px-4 py-2 font-bold w-1/3 border-r border-slate-100">স্ত্রী</td>
                              <td className="px-4 py-2 font-bold text-slate-700">{foundCustomer.spouseName || 'অবিবাহিত'}</td>
                            </tr>
                            <tr>
                              <td className="bg-slate-50 px-4 py-2 font-bold w-1/3 border-r border-slate-100">ঠিকানা</td>
                              <td className="px-4 py-2 font-bold text-slate-700">{foundCustomer.presentAddress?.village}, {foundCustomer.presentAddress?.thana}</td>
                            </tr>
                            <tr>
                              <td className="bg-slate-50 px-4 py-2 font-bold w-1/3 border-r border-slate-100">মোবাইল নং</td>
                              <td className="px-4 py-2 font-bold text-emerald-600">
                                <a href={`tel:${foundCustomer.mobile}`} className="hover:underline">
                                  {toBengaliNumber(foundCustomer.mobile)}
                                </a>
                              </td>
                            </tr>
                            <tr>
                              <td className="bg-slate-50 px-4 py-2 font-bold w-1/3 border-r border-slate-100">সদস্যের ধরণ</td>
                              <td className="px-4 py-2 font-bold text-slate-700">{foundCustomer.memberType || 'মাসিক'}</td>
                            </tr>
                            <tr>
                              <td className="bg-slate-50 px-4 py-2 font-bold w-1/3 border-r border-slate-100">গ্যারান্টর</td>
                              <td className="px-4 py-2 font-bold text-slate-700"></td>
                            </tr>
                          </tbody>
                        </table>
                      </div>
                    </div>

                    {/* Photo Section */}
                    <div className="border border-slate-200 rounded-lg overflow-hidden max-w-md mx-auto">
                      <div className="bg-orange-400 text-white px-4 py-2 font-bold text-lg">ছবি</div>
                      <div className="p-6 flex justify-center bg-slate-50">
                        <div className="w-32 h-32 rounded-full border-4 border-white shadow-lg overflow-hidden bg-white flex items-center justify-center text-slate-300">
                          {foundCustomer.photoUrl ? (
                            <img 
                              src={getDirectDriveUrl(foundCustomer.photoUrl)} 
                              alt="" 
                              className="w-full h-full object-cover" 
                              referrerPolicy="no-referrer" 
                              loading="lazy" 
                            />
                          ) : (
                            <User size={64} />
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Tab Switcher */}
                  <div className="sticky top-0 z-10 bg-white border-b border-slate-200 p-4 flex gap-4 shadow-sm">
                    <button 
                      onClick={() => setFormTab('investment')}
                      className={`flex-1 py-4 rounded-2xl font-black text-xl transition-all flex items-center justify-center gap-3 ${formTab === 'investment' ? 'bg-[#003366] text-white shadow-lg shadow-blue-100' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}
                    >
                      <DollarSign size={24} />
                      বিনিয়োগ
                    </button>
                    <button 
                      onClick={() => setFormTab('guarantors')}
                      className={`flex-1 py-4 rounded-2xl font-black text-xl transition-all flex items-center justify-center gap-3 ${formTab === 'guarantors' ? 'bg-[#003366] text-white shadow-lg shadow-blue-100' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}
                    >
                      <ShieldCheck size={24} />
                      জামিনদার
                    </button>
                  </div>

                  <div className="p-8 max-w-5xl mx-auto">
                    {formTab === 'investment' ? (
                      <div className="bg-white p-8 rounded-[32px] border border-slate-200 shadow-sm space-y-8">
                        <section className="space-y-6">
                          <h4 className="text-xl font-bold text-emerald-700 border-b pb-2">বিনিয়োগের তথ্য</h4>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-1">
                              <label className="text-xs font-bold text-slate-500 uppercase">বিনিয়োগের ধরন</label>
                              <select 
                                className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 font-bold"
                                value={investmentData.investmentType}
                                onChange={e => setInvestmentData({...investmentData, investmentType: e.target.value})}
                              >
                                <option value="মাসিক">মাসিক</option>
                                <option value="সাপ্তাহিক">সাপ্তাহিক</option>
                                <option value="দৈনিক">দৈনিক</option>
                              </select>
                            </div>

                            <div className="space-y-1">
                              <label className="text-xs font-bold text-slate-500 uppercase">বিনিয়োগের পরিমাণ</label>
                              <div className="relative">
                                <input 
                                  type="text" 
                                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 font-bold text-xl"
                                  value={formatNumberWithCommas(investmentData.amount)}
                                  onChange={e => handleAmountChange(e.target.value)}
                                />
                                <span className="absolute right-4 top-1/2 -translate-y-1/2 font-bold text-slate-400">৳</span>
                              </div>
                            </div>

                            <div className="space-y-1">
                              <label className="text-xs font-bold text-slate-500 uppercase">মুনাফা %</label>
                              <input 
                                type="number" 
                                className="w-full p-3 bg-emerald-50/50 border border-emerald-100 rounded-xl focus:outline-none font-bold text-emerald-600"
                                value={investmentData.profitPercent}
                                onChange={e => calculateProfit('percent', e.target.value)}
                              />
                            </div>

                            <div className="space-y-1">
                              <label className="text-xs font-bold text-slate-500 uppercase">মুনাফার পরিমাণ</label>
                              <input 
                                type="number" 
                                className="w-full p-3 bg-emerald-50/50 border border-emerald-100 rounded-xl focus:outline-none font-bold text-emerald-600"
                                value={investmentData.profitAmount}
                                onChange={e => calculateProfit('amount', e.target.value)}
                              />
                            </div>

                            <div className="md:col-span-2 bg-emerald-600 p-6 rounded-2xl text-white flex justify-between items-center shadow-lg shadow-emerald-100">
                              <div className="space-y-1">
                                <span className="text-[10px] font-black uppercase tracking-widest opacity-80">সর্বমোট (মুনাফা সহ)</span>
                                <p className="text-3xl font-black">{formatCurrency(investmentData.totalAmount)}</p>
                              </div>
                              <Award size={40} className="opacity-20" />
                            </div>

                            <div className="space-y-1">
                              <label className="text-xs font-bold text-slate-500 uppercase">কিস্তির সংখ্যা</label>
                              <input 
                                type="number" 
                                className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none font-bold"
                                value={investmentData.installmentCount}
                                onChange={e => handleInstallmentChange(e.target.value)}
                              />
                            </div>

                            <div className="space-y-1">
                              <label className="text-xs font-bold text-slate-500 uppercase">প্রতি কিস্তি</label>
                              <div className="p-3 bg-slate-100 border border-slate-200 rounded-xl font-bold text-slate-600">
                                {formatCurrency(investmentData.perInstallment)}
                              </div>
                            </div>

                            <div className="md:col-span-2 space-y-1">
                              <label className="text-xs font-bold text-slate-500 uppercase">পণ্যের তথ্য</label>
                              <textarea 
                                className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none min-h-[80px] font-medium"
                                value={investmentData.productInfo}
                                onChange={e => setInvestmentData({...investmentData, productInfo: e.target.value})}
                              />
                            </div>

                            <div className="md:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-4">
                              <div className="space-y-1">
                                <label className="text-xs font-bold text-slate-500 uppercase">শুরুর তারিখ</label>
                                <input 
                                  type="date" 
                                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none font-bold"
                                  value={investmentData.startDate}
                                  onChange={e => setInvestmentData({...investmentData, startDate: e.target.value})}
                                />
                              </div>
                              <div className="space-y-1">
                                <label className="text-xs font-bold text-slate-500 uppercase">শেষের তারিখ</label>
                                <input 
                                  type="date" 
                                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none font-bold"
                                  value={investmentData.endDate}
                                  onChange={e => setInvestmentData({...investmentData, endDate: e.target.value})}
                                />
                              </div>
                            </div>
                          </div>
                        </section>

                        <div className="pt-6">
                          <button 
                            disabled={isSubmitting}
                            onClick={handleSubmit}
                            className="w-full py-4 bg-[#003366] text-white text-xl font-bold rounded-2xl shadow-xl hover:bg-[#002244] transition-all flex items-center justify-center gap-3 disabled:opacity-50"
                          >
                            {isSubmitting ? (
                              <div className="w-6 h-6 border-4 border-white/30 border-t-white rounded-full animate-spin" />
                            ) : (
                              <>
                                <FileText size={24} />
                                <span>বিনিয়োগ সংরক্ষণ করুন</span>
                              </>
                            )}
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-8">
                        <div className="space-y-6 pb-12">
                          {guarantors.map((g, idx) => (
                            <motion.div 
                              initial={{ opacity: 0, y: 20 }}
                              animate={{ opacity: 1, y: 0 }}
                              key={idx} 
                              className="bg-white p-8 rounded-[32px] border border-slate-200 shadow-sm space-y-6"
                            >
                              <div className="flex justify-between items-center border-b pb-4">
                                <h4 className="text-lg font-bold text-emerald-700 flex items-center gap-2">
                                  <ShieldCheck size={20} />
                                  জামিনদার {toBengaliNumber(idx + 1)} এর তথ্য
                                </h4>
                                {idx > 0 && (
                                  <button 
                                    onClick={() => setGuarantors(guarantors.filter((_, i) => i !== idx))}
                                    className="p-2 text-rose-400 hover:text-rose-600 hover:bg-rose-50 rounded-full transition-all"
                                  >
                                    <Trash2 size={20} />
                                  </button>
                                )}
                              </div>

                              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <div className="space-y-1">
                                  <label className="text-xs font-bold text-slate-500 uppercase">সম্পূর্ণ নাম</label>
                                  <input className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none font-bold" value={g.name} onChange={e => updateGuarantor(idx, 'name', e.target.value)} />
                                </div>
                                <div className="space-y-1">
                                  <label className="text-xs font-bold text-slate-500 uppercase">মোবাইল</label>
                                  <input className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none font-bold" value={g.mobile} onChange={e => updateGuarantor(idx, 'mobile', e.target.value)} />
                                </div>
                                <div className="space-y-1">
                                  <label className="text-xs font-bold text-slate-500 uppercase">সম্পর্ক</label>
                                  <input className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none font-bold" value={g.relationship} onChange={e => updateGuarantor(idx, 'relationship', e.target.value)} />
                                </div>
                                <div className="space-y-1">
                                  <label className="text-xs font-bold text-slate-500 uppercase">পিতার নাম</label>
                                  <input className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none font-bold" value={g.fatherName} onChange={e => updateGuarantor(idx, 'fatherName', e.target.value)} />
                                </div>
                                <div className="space-y-1">
                                  <label className="text-xs font-bold text-slate-500 uppercase">মাতার নাম</label>
                                  <input className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none font-bold" value={g.motherName} onChange={e => updateGuarantor(idx, 'motherName', e.target.value)} />
                                </div>
                                <div className="space-y-1">
                                  <label className="text-xs font-bold text-slate-500 uppercase">এনআইডি নম্বর</label>
                                  <input className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none font-bold" value={g.nid} onChange={e => updateGuarantor(idx, 'nid', e.target.value)} />
                                </div>
                                <div className="space-y-1">
                                  <label className="text-xs font-bold text-slate-500 uppercase">জন্ম তারিখ</label>
                                  <input type="date" className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none font-bold" value={g.dob} onChange={e => updateGuarantor(idx, 'dob', e.target.value)} />
                                </div>
                                <div className="md:col-span-3 space-y-1">
                                  <label className="text-xs font-bold text-slate-500 uppercase">ঠিকানা</label>
                                  <textarea className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none font-medium min-h-[60px]" value={g.address.village} onChange={e => updateGuarantor(idx, 'address', {...g.address, village: e.target.value})} />
                                </div>
                              </div>
                            </motion.div>
                          ))}
                        </div>

                        <div className="flex flex-col items-center gap-4">
                          <button 
                            onClick={handleAddGuarantor}
                            className="flex items-center gap-2 px-8 py-4 bg-emerald-50 text-emerald-600 border-2 border-dashed border-emerald-200 rounded-2xl hover:bg-emerald-100 transition-all font-bold group"
                          >
                            <Plus size={24} className="group-hover:rotate-90 transition-transform" />
                            <span>আরো জামিনদার এড করুন</span>
                          </button>
                          
                          <button 
                            disabled={isSubmitting}
                            onClick={handleSubmit}
                            className="w-full py-4 bg-[#003366] text-white text-xl font-bold rounded-2xl shadow-xl hover:bg-[#002244] transition-all flex items-center justify-center gap-3 disabled:opacity-50"
                          >
                            {isSubmitting ? (
                              <div className="w-6 h-6 border-4 border-white/30 border-t-white rounded-full animate-spin" />
                            ) : (
                              <>
                                <FileText size={24} />
                                <span>বিনিয়োগ সংরক্ষণ করুন</span>
                              </>
                            )}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Details Modal */}
      <AnimatePresence>
        {showDetailsModal && selectedInvestment && (
          <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md">
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white w-full max-w-2xl rounded-[32px] shadow-2xl overflow-hidden"
            >
              <div className="bg-[#003366] p-6 flex justify-between items-center text-white">
                <h3 className="text-xl font-bold flex items-center gap-2">
                  <Info size={24} className="text-emerald-400" />
                  বিনিয়োগের বিস্তারিত তথ্য
                </h3>
                <button onClick={() => setShowDetailsModal(false)} className="p-2 hover:bg-white/10 rounded-full transition-colors">
                  <X size={24} />
                </button>
              </div>
              <div className="p-8 space-y-6">
                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-1">
                    <p className="text-xs font-bold text-slate-400 uppercase">সদস্যের নাম</p>
                    <p className="text-lg font-bold text-slate-800">{selectedInvestment.customerName}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs font-bold text-slate-400 uppercase">হিসাব নম্বর</p>
                    <p className="text-lg font-bold text-emerald-700 font-mono">{toBengaliNumber(selectedInvestment.customerAccountNumber)}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs font-bold text-slate-400 uppercase">বিনিয়োগের পরিমাণ</p>
                    <p className="text-lg font-bold text-slate-800">{formatCurrency(selectedInvestment.amount)}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs font-bold text-slate-400 uppercase">মুনাফার পরিমাণ</p>
                    <p className="text-lg font-bold text-emerald-600">{formatCurrency(selectedInvestment.profitAmount)} ({toBengaliNumber(selectedInvestment.profitPercent)}%)</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs font-bold text-slate-400 uppercase">মোট পরিমাণ</p>
                    <p className="text-lg font-bold text-blue-700">{formatCurrency(selectedInvestment.totalAmount)}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs font-bold text-slate-400 uppercase">কিস্তির সংখ্যা</p>
                    <p className="text-lg font-bold text-slate-800">{toBengaliNumber(selectedInvestment.installmentCount)} টি</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs font-bold text-slate-400 uppercase">প্রতি কিস্তি</p>
                    <p className="text-lg font-bold text-slate-800">{formatCurrency(selectedInvestment.perInstallment)}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs font-bold text-slate-400 uppercase">শুরুর তারিখ</p>
                    <p className="text-lg font-bold text-slate-800">{formatDate(selectedInvestment.startDate)}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs font-bold text-slate-400 uppercase">শেষের তারিখ</p>
                    <p className="text-lg font-bold text-slate-800">{formatDate(selectedInvestment.endDate)}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs font-bold text-slate-400 uppercase">তৈরি করেছেন</p>
                    <p className="text-lg font-bold text-indigo-600">{selectedInvestment.createdBy}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs font-bold text-slate-400 uppercase">স্ট্যাটাস</p>
                    <span className="px-3 py-1 bg-emerald-100 text-emerald-700 rounded-full text-xs font-bold">{selectedInvestment.status}</span>
                  </div>
                </div>
                <div className="pt-6 border-t">
                  <button onClick={() => setShowDetailsModal(false)} className="w-full py-3 bg-slate-100 text-slate-600 font-bold rounded-xl hover:bg-slate-200 transition-colors">বন্ধ করুন</button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Transactions Modal */}
      <AnimatePresence>
        {showTransactionsModal && selectedInvestment && (
          <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md">
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white w-full max-w-6xl rounded-[40px] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
            >
              <div className="bg-[#003366] p-6 flex justify-between items-center text-white shrink-0">
                <h3 className="text-xl font-bold flex items-center gap-2">
                  <FileText size={24} className="text-emerald-400" />
                  লেনদেনের তালিকা - {selectedInvestment.customerName} ({toBengaliNumber(selectedInvestment.customerAccountNumber)})
                </h3>
                <button onClick={() => setShowTransactionsModal(false)} className="p-2 hover:bg-white/10 rounded-full transition-colors">
                  <X size={24} />
                </button>
              </div>
              
              <div className="p-6 bg-slate-50 border-b flex justify-between items-center shrink-0">
                <div className="flex gap-4">
                  <div className="bg-white px-4 py-2 rounded-xl border border-slate-200 shadow-sm">
                    <p className="text-[10px] font-bold text-slate-400 uppercase">মোট বিনিয়োগ</p>
                    <p className="text-lg font-black text-slate-800">{formatCurrency(selectedInvestment.totalAmount)}</p>
                  </div>
                  <div className="bg-white px-4 py-2 rounded-xl border border-slate-200 shadow-sm">
                    <p className="text-[10px] font-bold text-slate-400 uppercase">পরিশোধিত</p>
                    <p className="text-lg font-black text-emerald-600">{formatCurrency(selectedInvestment.paidAmount)}</p>
                  </div>
                  <div className="bg-white px-4 py-2 rounded-xl border border-slate-200 shadow-sm">
                    <p className="text-[10px] font-bold text-slate-400 uppercase">বকেয়া</p>
                    <p className="text-lg font-black text-rose-600">{formatCurrency(selectedInvestment.dueAmount)}</p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors text-sm font-bold">
                    <Printer size={16} /> প্রিন্ট
                  </button>
                  <button className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 transition-colors text-sm font-bold">
                    <Download size={16} /> ডাউনলোড
                  </button>
                </div>
              </div>

              <div className="flex-1 overflow-auto">
                <DataTable 
                  columns={investmentTransactionColumns} 
                  data={transactions} 
                  keyExtractor={(tr) => tr.id} 
                  emptyMessage="কোন লেনদেন পাওয়া যায়নি"
                />
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Voucher Modal */}
      <AnimatePresence>
        {showVoucherModal && lastTransaction && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md overflow-y-auto">
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white w-full max-w-md rounded-[32px] shadow-2xl overflow-hidden my-8"
            >
              <div className="bg-emerald-600 p-6 flex justify-between items-center text-white print:hidden">
                <h3 className="text-xl font-bold flex items-center gap-2">
                  <CheckCircle2 size={24} />
                  পেমেন্ট ভাউচার
                </h3>
                <div className="flex gap-2">
                  <button 
                    onClick={() => window.print()}
                    className="p-2 hover:bg-white/10 rounded-full transition-colors flex items-center gap-2 px-4 bg-emerald-700"
                  >
                    <Printer size={20} />
                    <span>প্রিন্ট</span>
                  </button>
                  <button onClick={() => setShowVoucherModal(false)} className="p-2 hover:bg-white/10 rounded-full transition-colors">
                    <X size={24} />
                  </button>
                </div>
              </div>
              
              <div id="voucher-print-area" className="p-8 bg-white">
                <div className="border-2 border-slate-200 p-6 rounded-2xl space-y-6">
                  <div className="text-center space-y-2 border-b pb-6">
                    <h2 className="text-2xl font-black text-slate-800">পেমেন্ট ভাউচার</h2>
                    <p className="text-sm font-bold text-slate-500">লেনদেন কোড: <span className="font-mono text-emerald-600">{lastTransaction.code}</span></p>
                  </div>

                  <div className="space-y-4">
                    <div className="flex justify-between border-b border-slate-100 pb-2">
                      <span className="text-slate-500 font-bold">গ্রাহকের নাম:</span>
                      <span className="text-slate-800 font-black">{lastTransaction.customerName}</span>
                    </div>
                    <div className="flex justify-between border-b border-slate-100 pb-2">
                      <span className="text-slate-500 font-bold">হিসাব নম্বর:</span>
                      <span className="text-slate-800 font-black font-mono">{toBengaliNumber(lastTransaction.customerAccountNumber)}</span>
                    </div>
                    <div className="flex justify-between border-b border-slate-100 pb-2">
                      <span className="text-slate-500 font-bold">তারিখ:</span>
                      <span className="text-slate-800 font-black">{formatDate(lastTransaction.date)}</span>
                    </div>
                    <div className="flex justify-between border-b border-slate-100 pb-2">
                      <span className="text-slate-500 font-bold">বিবরণ:</span>
                      <span className="text-slate-800 font-black">{lastTransaction.description || 'কিস্তি আদায়'}</span>
                    </div>
                    <div className="flex justify-between bg-emerald-50 p-4 rounded-xl">
                      <span className="text-emerald-700 font-bold text-lg">জমার পরিমাণ:</span>
                      <span className="text-emerald-800 font-black text-2xl">{formatCurrency(lastTransaction.amount)}</span>
                    </div>
                  </div>

                  <div className="pt-12 flex justify-between">
                    <div className="text-center">
                      <div className="w-32 border-t border-slate-400 pt-2 text-xs font-bold text-slate-500">গ্রাহকের স্বাক্ষর</div>
                    </div>
                    <div className="text-center">
                      <div className="w-32 border-t border-slate-400 pt-2 text-xs font-bold text-slate-500">ক্যাশিয়ারের স্বাক্ষর</div>
                    </div>
                  </div>
                </div>
              </div>

              <style>
                {`
                  @media print {
                    body * {
                      visibility: hidden;
                    }
                    #voucher-print-area, #voucher-print-area * {
                      visibility: visible;
                    }
                    #voucher-print-area {
                      position: fixed;
                      left: 0;
                      top: 0;
                      width: 100%;
                      padding: 40px;
                      background: white !important;
                    }
                    .print\\:hidden {
                      display: none !important;
                    }
                  }
                `}
              </style>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      <AnimatePresence>
        {showVoucherModal && lastTransaction && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md overflow-y-auto">
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white w-full max-w-md rounded-[32px] shadow-2xl overflow-hidden my-8"
            >
              <div className="bg-emerald-600 p-6 flex justify-between items-center text-white print:hidden">
                <h3 className="text-xl font-bold flex items-center gap-2">
                  <CheckCircle2 size={24} />
                  পেমেন্ট ভাউচার
                </h3>
                <div className="flex gap-2">
                  <button 
                    onClick={() => window.print()}
                    className="p-2 hover:bg-white/10 rounded-full transition-colors flex items-center gap-2 px-4 bg-emerald-700"
                  >
                    <Printer size={20} />
                    <span>প্রিন্ট</span>
                  </button>
                  <button onClick={() => setShowVoucherModal(false)} className="p-2 hover:bg-white/10 rounded-full transition-colors">
                    <X size={24} />
                  </button>
                </div>
              </div>
              
              <div id="voucher-print-area" className="p-8 bg-white">
                <div className="border-2 border-slate-200 p-6 rounded-2xl space-y-6">
                  <div className="text-center space-y-2 border-b pb-6">
                    <h2 className="text-2xl font-black text-slate-800">পেমেন্ট ভাউচার</h2>
                    <p className="text-sm font-bold text-slate-500">লেনদেন কোড: <span className="font-mono text-emerald-600">{lastTransaction.code}</span></p>
                  </div>

                  <div className="space-y-4">
                    <div className="flex justify-between border-b border-slate-100 pb-2">
                      <span className="text-slate-500 font-bold">গ্রাহকের নাম:</span>
                      <span className="text-slate-800 font-black">{lastTransaction.customerName}</span>
                    </div>
                    <div className="flex justify-between border-b border-slate-100 pb-2">
                      <span className="text-slate-500 font-bold">হিসাব নম্বর:</span>
                      <span className="text-slate-800 font-black font-mono">{toBengaliNumber(lastTransaction.customerAccountNumber)}</span>
                    </div>
                    <div className="flex justify-between border-b border-slate-100 pb-2">
                      <span className="text-slate-500 font-bold">তারিখ:</span>
                      <span className="text-slate-800 font-black">{formatDate(lastTransaction.date)}</span>
                    </div>
                    <div className="flex justify-between border-b border-slate-100 pb-2">
                      <span className="text-slate-500 font-bold">বিবরণ:</span>
                      <span className="text-slate-800 font-black">{lastTransaction.description || 'কিস্তি আদায়'}</span>
                    </div>
                    <div className="flex justify-between bg-emerald-50 p-4 rounded-xl">
                      <span className="text-emerald-700 font-bold text-lg">জমার পরিমাণ:</span>
                      <span className="text-emerald-800 font-black text-2xl">{formatCurrency(lastTransaction.amount)}</span>
                    </div>
                  </div>

                  <div className="pt-12 flex justify-between">
                    <div className="text-center">
                      <div className="w-32 border-t border-slate-400 pt-2 text-xs font-bold text-slate-500">গ্রাহকের স্বাক্ষর</div>
                    </div>
                    <div className="text-center">
                      <div className="w-32 border-t border-slate-400 pt-2 text-xs font-bold text-slate-500">ক্যাশিয়ারের স্বাক্ষর</div>
                    </div>
                  </div>
                </div>
              </div>

              <style>
                {`
                  @media print {
                    body * {
                      visibility: hidden;
                    }
                    #voucher-print-area, #voucher-print-area * {
                      visibility: visible;
                    }
                    #voucher-print-area {
                      position: fixed;
                      left: 0;
                      top: 0;
                      width: 100%;
                      padding: 40px;
                      background: white !important;
                    }
                    .print\\:hidden {
                      display: none !important;
                    }
                  }
                `}
              </style>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Guarantors Modal */}
      <AnimatePresence>
        {showGuarantorsModal && selectedInvestment && (
          <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md">
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white w-full max-w-4xl rounded-[40px] shadow-2xl overflow-hidden"
            >
              <div className="bg-[#003366] p-6 flex justify-between items-center text-white">
                <h3 className="text-xl font-bold flex items-center gap-2">
                  <ShieldCheck size={24} className="text-emerald-400" />
                  জামিনদারের তথ্য
                </h3>
                <button onClick={() => setShowGuarantorsModal(false)} className="p-2 hover:bg-white/10 rounded-full transition-colors">
                  <X size={24} />
                </button>
              </div>
              <div className="p-8 space-y-6 max-h-[80vh] overflow-y-auto">
                {selectedInvestment.guarantors && selectedInvestment.guarantors.length > 0 ? (
                  selectedInvestment.guarantors.map((g: any, idx: number) => (
                    <div key={idx} className="bg-slate-50 p-6 rounded-3xl border border-slate-200 space-y-4">
                      <h4 className="text-lg font-bold text-emerald-700 border-b pb-2 flex items-center gap-2">
                        <User size={18} /> জামিনদার {toBengaliNumber(idx + 1)}
                      </h4>
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                        <div className="space-y-1">
                          <p className="text-[10px] font-bold text-slate-400 uppercase">নাম</p>
                          <p className="font-bold text-slate-700">{g.name}</p>
                        </div>
                        <div className="space-y-1">
                          <p className="text-[10px] font-bold text-slate-400 uppercase">মোবাইল</p>
                          <p className="font-bold text-emerald-600">
                            <a href={`tel:${g.mobile}`} className="hover:underline">
                              {toBengaliNumber(g.mobile)}
                            </a>
                          </p>
                        </div>
                        <div className="space-y-1">
                          <p className="text-[10px] font-bold text-slate-400 uppercase">সম্পর্ক</p>
                          <p className="font-bold text-slate-700">{g.relationship}</p>
                        </div>
                        <div className="space-y-1">
                          <p className="text-[10px] font-bold text-slate-400 uppercase">পিতার নাম</p>
                          <p className="font-bold text-slate-700">{g.fatherName}</p>
                        </div>
                        <div className="space-y-1">
                          <p className="text-[10px] font-bold text-slate-400 uppercase">মাতার নাম</p>
                          <p className="font-bold text-slate-700">{g.motherName}</p>
                        </div>
                        <div className="space-y-1">
                          <p className="text-[10px] font-bold text-slate-400 uppercase">এনআইডি</p>
                          <p className="font-bold text-slate-700">{toBengaliNumber(g.nid)}</p>
                        </div>
                        <div className="space-y-1">
                          <p className="text-[10px] font-bold text-slate-400 uppercase">জন্ম তারিখ</p>
                          <p className="font-bold text-slate-700">{formatDate(g.dob)}</p>
                        </div>
                        <div className="col-span-full space-y-1">
                          <p className="text-[10px] font-bold text-slate-400 uppercase">ঠিকানা</p>
                          <p className="font-bold text-slate-700">{g.address?.village}, {g.address?.thana}, {g.address?.district}</p>
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-center p-12 text-slate-400 font-bold italic">
                    কোন জামিনদারের তথ্য পাওয়া যায়নি
                  </div>
                )}
                <div className="pt-6 border-t">
                  <button onClick={() => setShowGuarantorsModal(false)} className="w-full py-3 bg-slate-100 text-slate-600 font-bold rounded-xl hover:bg-slate-200 transition-colors">বন্ধ করুন</button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Payment Modal */}
      <AnimatePresence>
        {showPaymentModal && selectedInvestment && (
          <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md">
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white w-full max-w-md rounded-[32px] shadow-2xl overflow-hidden"
            >
              <div className="bg-emerald-600 p-6 flex justify-between items-center text-white">
                <h3 className="text-xl font-bold flex items-center gap-2">
                  <DollarSign size={24} />
                  কিস্তি আদায় করুন
                </h3>
                <button onClick={() => setShowPaymentModal(false)} className="p-2 hover:bg-white/10 rounded-full transition-colors">
                  <X size={24} />
                </button>
              </div>
              <form 
                onSubmit={(e) => {
                  e.preventDefault();
                  const formData = new FormData(e.currentTarget);
                  handlePayment(
                    parseFloat(formData.get('amount') as string),
                    parseFloat(formData.get('fine') as string) || 0,
                    formData.get('date') as string,
                    formData.get('description') as string
                  );
                }}
                className="p-8 space-y-4"
              >
                <div className="bg-emerald-50 p-4 rounded-2xl border border-emerald-100 mb-4">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-sm text-emerald-700 font-bold">মোট বকেয়া:</span>
                    <span className="text-lg font-black text-emerald-800">{formatCurrency(selectedInvestment.dueAmount)}</span>
                  </div>
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-sm text-emerald-700 font-bold">প্রতি কিস্তি:</span>
                    <span className="text-lg font-black text-emerald-800">{formatCurrency(selectedInvestment.perInstallment)}</span>
                  </div>
                  <div className="pt-2 border-t border-emerald-200 flex justify-between items-center">
                    <span className="text-sm text-emerald-700 font-bold uppercase">জরিমানা সহ মোট:</span>
                    <span className="text-xl font-black text-emerald-900">{formatCurrency(paymentAmount + fineAmount)}</span>
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500 ml-1">জমার পরিমাণ</label>
                  <input 
                    name="amount"
                    type="number"
                    required
                    value={paymentAmount}
                    onChange={(e) => setPaymentAmount(parseFloat(e.target.value) || 0)}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 font-bold"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500 ml-1">জরিমানা</label>
                  <input 
                    name="fine"
                    type="number"
                    value={fineAmount}
                    onChange={(e) => setFineAmount(parseFloat(e.target.value) || 0)}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 font-bold text-rose-600"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500 ml-1">তারিখ</label>
                  <input 
                    name="date"
                    type="date"
                    required
                    defaultValue={new Date().toISOString().split('T')[0]}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 font-bold"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500 ml-1">বিবরণ (ঐচ্ছিক)</label>
                  <input 
                    name="description"
                    type="text"
                    placeholder="কিস্তি আদায়"
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 font-bold"
                  />
                </div>
                <div className="pt-4 flex gap-3">
                  <button 
                    type="button"
                    onClick={() => setShowPaymentModal(false)}
                    className="flex-1 py-3 bg-slate-100 text-slate-600 font-bold rounded-xl hover:bg-slate-200 transition-colors"
                  >
                    বাতিল
                  </button>
                  <button 
                    type="submit"
                    className="flex-1 py-3 bg-emerald-600 text-white font-bold rounded-xl hover:bg-emerald-700 shadow-lg shadow-emerald-200 transition-all active:scale-95"
                  >
                    জমা করুন
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
