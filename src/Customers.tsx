import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, addDoc, deleteDoc, doc, updateDoc, serverTimestamp, query, orderBy, limit, getDocs, where } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from './firebase';
import { useAuth } from './AuthContext';
import { generateId, getDirectDriveUrl, toBengaliNumber } from './lib/utils';
import { Plus, Search, MoreVertical, Edit2, Trash2, X, Eye, CheckCircle2, List, ChevronDown, Info } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { DataTable } from './components/DataTable';

export const Customers = () => {
  const { role } = useAuth();
  const [customers, setCustomers] = useState<any[]>([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState<any>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeActionMenu, setActiveActionMenu] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [sameAsPresent, setSameAsPresent] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [errorModal, setErrorModal] = useState<string | null>(null);
  const [menuPosition, setMenuPosition] = useState({ top: 0, left: 0 });
  
  const initialFormData = {
    name: '',
    nameEnglish: '',
    mobile: '',
    altMobile: '',
    fatherName: '',
    motherName: '',
    nid: '',
    gender: 'Male',
    email: '',
    profession: '',
    religion: 'Islam',
    businessName: '',
    dob: '',
    education: '',
    maritalStatus: 'No',
    spouseName: '',
    spouseFatherName: '',
    spouseMotherName: '',
    spouseNid: '',
    spouseDob: '',
    spouseAddress: '',
    photoUrl: '',
    presentAddress: { village: '', postOffice: '', thana: '', district: '' },
    permanentAddress: { village: '', postOffice: '', thana: '', district: '' },
    bloodGroup: 'O+',
    joiningDate: new Date().toISOString().split('T')[0],
    status: 'active'
  };

  const [formData, setFormData] = useState(initialFormData);

  useEffect(() => {
    const onBack = (e: Event) => {
      if (showViewModal) {
        e.preventDefault();
        setShowViewModal(null);
      } else if (showAddModal) {
        e.preventDefault();
        setShowAddModal(false);
        setEditingId(null);
        setFormData(initialFormData);
      }
    };
    window.addEventListener('app:back', onBack);
    return () => window.removeEventListener('app:back', onBack);
  }, [showViewModal, showAddModal]);

  useEffect(() => {
    if (!role) return;
    const q = query(collection(db, 'customers'), orderBy('accountNumberInt', 'asc'));
    const unsub = onSnapshot(q, (snap) => {
      setCustomers(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'customers');
    });
    return unsub;
  }, [role]);

  useEffect(() => {
    if (successMessage) {
      const timer = setTimeout(() => setSuccessMessage(''), 3000);
      return () => clearTimeout(timer);
    }
  }, [successMessage]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (role !== 'super_admin' && role !== 'admin') return;
    setIsSubmitting(true);

    try {
      if (editingId) {
        await updateDoc(doc(db, 'customers', editingId), {
          ...formData,
          photoUrl: getDirectDriveUrl(formData.photoUrl),
          updatedAt: serverTimestamp()
        });
      } else {
        // Generate unique account number (1, 2, 3...)
        const q = query(collection(db, 'customers'), orderBy('accountNumberInt', 'desc'), limit(1));
        const querySnapshot = await getDocs(q);
        let nextAccNum = 1;
        if (!querySnapshot.empty) {
          const lastCustomer = querySnapshot.docs[0].data();
          nextAccNum = (lastCustomer.accountNumberInt || 0) + 1;
        }

        await addDoc(collection(db, 'customers'), {
          ...formData,
          photoUrl: getDirectDriveUrl(formData.photoUrl),
          accountNumber: nextAccNum.toString(),
          accountNumberInt: nextAccNum,
          createdAt: serverTimestamp()
        });
      }
      
      const msg = editingId ? 'গ্রাহকের তথ্য আপডেট করা হয়েছে' : 'নতুন গ্রাহক সফলভাবে নিবন্ধিত হয়েছে';
      setShowAddModal(false);
      setEditingId(null);
      setFormData(initialFormData);
      setSameAsPresent(false);
      setSuccessMessage(msg);
    } catch (error) {
      console.error("Error saving customer:", error);
      setErrorModal("গ্রাহকের তথ্য সংরক্ষণ করতে সমস্যা হয়েছে");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEdit = (customer: any) => {
    setFormData({
      ...initialFormData,
      ...customer,
      presentAddress: customer.presentAddress || initialFormData.presentAddress,
      permanentAddress: customer.permanentAddress || initialFormData.permanentAddress,
    });
    setEditingId(customer.id);
    setShowAddModal(true);
    setActiveActionMenu(null);
  };

  const handleDelete = async (id: string) => {
    if (!id) return;
    setIsDeleting(true);
    try {
      // Check if customer has any ongoing investments
      const q = query(collection(db, 'investments'), where('customerId', '==', id), where('status', '==', 'চলমান'));
      const snap = await getDocs(q);
      
      if (!snap.empty) {
        setErrorModal('গ্রাহকের বকেয়া বা চলমান বিনিয়োগ থাকলে ডিলিট করা যাবে না।');
        setShowDeleteConfirm(null);
        return;
      }

      await deleteDoc(doc(db, 'customers', id));
      setShowDeleteConfirm(null);
      setActiveActionMenu(null);
      setSuccessMessage('গ্রাহক সফলভাবে মুছে ফেলা হয়েছে');
    } catch (error) {
      console.error("Error deleting customer:", error);
      setErrorModal("গ্রাহক ডিলিট করতে সমস্যা হয়েছে");
    } finally {
      setIsDeleting(false);
    }
  };

  const handleSameAsPresent = (checked: boolean) => {
    setSameAsPresent(checked);
    if (checked) {
      setFormData({
        ...formData,
        permanentAddress: { ...formData.presentAddress }
      });
    }
  };

  const filtered = customers.filter(c => {
    const matchesSearch = (c.name?.toLowerCase() || '').includes(searchTerm.toLowerCase()) || 
                         (c.accountNumber?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
                         (c.mobile?.toLowerCase() || '').includes(searchTerm.toLowerCase());
    return matchesSearch;
  });

  const columns = [
    {
      header: 'একশন',
      render: (customer: any) => (
        <div className="flex items-center justify-center gap-2">
          <button 
            onClick={() => setShowViewModal(customer)}
            className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors border border-blue-100"
            title="বিস্তারিত দেখুন"
          >
            <Eye size={18} />
          </button>
          {role === 'super_admin' && (
            <div className="relative">
              <button 
                onClick={(e) => {
                  e.stopPropagation();
                  const rect = e.currentTarget.getBoundingClientRect();
                  setMenuPosition({
                    top: rect.bottom + window.scrollY + 4,
                    left: rect.right + window.scrollX - 128
                  });
                  setActiveActionMenu(activeActionMenu === customer.id ? null : customer.id);
                }}
                className="flex items-center gap-1 px-3 py-1.5 bg-slate-100 border border-slate-200 rounded-lg hover:bg-slate-200 transition-colors text-slate-700"
              >
                <List size={18} />
                <ChevronDown size={14} className={cn("transition-transform", activeActionMenu === customer.id && "rotate-180")} />
              </button>
            </div>
          )}
        </div>
      ),
      headerClassName: "text-center"
    },
    {
      header: 'ছবি',
      render: (customer: any) => (
        <div className="w-10 h-10 rounded-full overflow-hidden bg-slate-100 border border-slate-200">
          {customer.photoUrl ? (
            <img 
              src={getDirectDriveUrl(customer.photoUrl)} 
              alt="" 
              className="w-full h-full object-cover" 
              referrerPolicy="no-referrer" 
              loading="lazy" 
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-slate-400 text-xs">No Pic</div>
          )}
        </div>
      )
    },
    { header: 'হিসাব নং', accessor: 'accountNumber', className: "font-mono font-bold text-emerald-700" },
    { header: 'সদস্যের নাম', accessor: 'name', className: "font-bold text-slate-800" },
    { 
      header: 'মোবাইল নং', 
      render: (customer: any) => (
        <a 
          href={`tel:${customer.mobile}`}
          className="font-mono text-emerald-600 hover:text-emerald-700 hover:underline transition-colors"
        >
          {customer.mobile}
        </a>
      )
    },
    { 
      header: 'যোগদানের তারিখ', 
      render: (c: any) => c.joiningDate ? toBengaliNumber(c.joiningDate.split('-').reverse().join('-')) : '-' 
    },
    { header: 'রক্তের গ্রুপ', accessor: 'bloodGroup' },
    { header: 'সদস্যের পেশা', accessor: 'profession' }
  ];

  return (
    <div className="space-y-6">
      {/* Success Message */}
      <AnimatePresence>
        {successMessage && (
          <motion.div 
            initial={{ opacity: 0, y: -20, x: 20 }}
            animate={{ opacity: 1, y: 0, x: 0 }}
            exit={{ opacity: 0, y: -20, x: 20 }}
            className="fixed top-6 right-6 z-[100] bg-emerald-600 text-white px-6 py-4 rounded-2xl shadow-2xl flex items-center gap-3 font-bold border border-white/20 backdrop-blur-sm"
          >
            <div className="bg-white/20 p-1 rounded-full">
              <CheckCircle2 size={20} />
            </div>
            <span>{successMessage}</span>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-slate-800">সকল গ্রাহক</h2>
        {role === 'super_admin' && (
          <button 
            onClick={() => setShowAddModal(true)}
            className="bg-emerald-600 text-white flex items-center gap-2 px-4 py-2 rounded-xl shadow-lg hover:bg-emerald-700 transition-colors font-bold"
          >
            <Plus size={20} />
            <span>নতুন গ্রাহক</span>
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input 
            type="text" 
            placeholder="নাম / একাউন্ট / মোবাইল নম্বর দিয়ে খুঁজুন..."
            className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      {/* Table */}
      <div className="relative">
        <DataTable 
          columns={columns} 
          data={filtered} 
          keyExtractor={(c) => c.id} 
        />
      </div>

      {/* Action Menu Portal */}
      <AnimatePresence>
        {activeActionMenu && (
          <>
            <div className="fixed inset-0 z-[1000]" onClick={() => setActiveActionMenu(null)}></div>
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: -10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: -10 }}
              style={{ 
                position: 'absolute',
                top: menuPosition.top,
                left: menuPosition.left,
              }}
              className="w-32 bg-white rounded-xl shadow-2xl border border-slate-100 z-[1001] py-2 overflow-hidden"
            >
              <button 
                onClick={() => {
                  const customer = customers.find(c => c.id === activeActionMenu);
                  handleEdit(customer);
                  setActiveActionMenu(null);
                }}
                className="w-full flex items-center gap-2 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50 transition-colors"
              >
                <Edit2 size={14} />
                <span>এডিট</span>
              </button>
              <button 
                onClick={() => {
                  setShowDeleteConfirm(activeActionMenu);
                  setActiveActionMenu(null);
                }}
                className="w-full flex items-center gap-2 px-4 py-2 text-sm text-rose-600 hover:bg-rose-50 transition-colors"
              >
                <Trash2 size={14} />
                <span>ডিলিট</span>
              </button>
            </motion.div>
          </>
        )}
      </AnimatePresence>

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

      {/* Add Modal */}
      <AnimatePresence>
        {showAddModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white w-full max-w-4xl rounded-3xl p-8 max-h-[90vh] overflow-y-auto"
            >
              <div className="flex justify-between items-center mb-8">
                <h3 className="text-2xl font-bold text-slate-800">
                  {editingId ? 'গ্রাহকের তথ্য এডিট করুন' : 'নতুন গ্রাহক নিবন্ধন ফরম'}
                </h3>
                <button 
                  onClick={() => {
                    setShowAddModal(false);
                    setEditingId(null);
                    setFormData(initialFormData);
                  }} 
                  className="p-2 hover:bg-slate-100 rounded-full"
                >
                  <X size={24} />
                </button>
              </div>
              
              <form onSubmit={handleSubmit} className="space-y-8">
                {/* Personal Information */}
                <section className="space-y-4">
                  <h4 className="text-lg font-bold text-emerald-700 border-b pb-2">ব্যক্তিগত তথ্য</h4>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-slate-500 uppercase">সদস্যের নাম (বাংলা)</label>
                      <input required className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-slate-500 uppercase">সদস্যের নাম (English)</label>
                      <input className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none" value={formData.nameEnglish} onChange={e => setFormData({...formData, nameEnglish: e.target.value})} />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-slate-500 uppercase">মোবাইল নম্বর</label>
                      <input required className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none" value={formData.mobile} onChange={e => setFormData({...formData, mobile: e.target.value})} />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-slate-500 uppercase">বিকল্প মোবাইল নম্বর</label>
                      <input className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none" value={formData.altMobile} onChange={e => setFormData({...formData, altMobile: e.target.value})} />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-slate-500 uppercase">পিতার নাম</label>
                      <input className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none" value={formData.fatherName} onChange={e => setFormData({...formData, fatherName: e.target.value})} />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-slate-500 uppercase">মাতার নাম</label>
                      <input className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none" value={formData.motherName} onChange={e => setFormData({...formData, motherName: e.target.value})} />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-slate-500 uppercase">পরিচয়পত্র নম্বর (NID)</label>
                      <input className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none" value={formData.nid} onChange={e => setFormData({...formData, nid: e.target.value})} />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-slate-500 uppercase">লিঙ্গ</label>
                      <select className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none" value={formData.gender} onChange={e => setFormData({...formData, gender: e.target.value})}>
                        <option value="Male">পুরুষ</option>
                        <option value="Female">মহিলা</option>
                        <option value="Other">অন্যান্য</option>
                      </select>
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-slate-500 uppercase">জন্ম তারিখ</label>
                      <input type="date" className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none" value={formData.dob} onChange={e => setFormData({...formData, dob: e.target.value})} />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-slate-500 uppercase">রক্তের গ্রুপ</label>
                      <select className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none" value={formData.bloodGroup} onChange={e => setFormData({...formData, bloodGroup: e.target.value})}>
                        <option value="A+">A+</option>
                        <option value="A-">A-</option>
                        <option value="B+">B+</option>
                        <option value="B-">B-</option>
                        <option value="O+">O+</option>
                        <option value="O-">O-</option>
                        <option value="AB+">AB+</option>
                        <option value="AB-">AB-</option>
                      </select>
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-slate-500 uppercase">ধর্ম</label>
                      <select className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none" value={formData.religion} onChange={e => setFormData({...formData, religion: e.target.value})}>
                        <option value="Islam">ইসলাম</option>
                        <option value="Hindu">হিন্দু</option>
                        <option value="Christian">খ্রিস্টান</option>
                        <option value="Buddhist">বৌদ্ধ</option>
                        <option value="Other">অন্যান্য</option>
                      </select>
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-slate-500 uppercase">শিক্ষা</label>
                      <input className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none" value={formData.education} onChange={e => setFormData({...formData, education: e.target.value})} />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-slate-500 uppercase">গ্রাহকের ছবি (URL)</label>
                      <input placeholder="Google Drive বা অন্য URL দিন" className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none" value={formData.photoUrl} onChange={e => setFormData({...formData, photoUrl: e.target.value})} />
                    </div>
                  </div>
                </section>

                {/* Professional & Other */}
                <section className="space-y-4">
                  <h4 className="text-lg font-bold text-emerald-700 border-b pb-2">পেশাগত ও অন্যান্য</h4>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-slate-500 uppercase">সদস্যের পেশা</label>
                      <input className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none" value={formData.profession} onChange={e => setFormData({...formData, profession: e.target.value})} />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-slate-500 uppercase">ব্যবসায়ের নাম</label>
                      <input className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none" value={formData.businessName} onChange={e => setFormData({...formData, businessName: e.target.value})} />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-slate-500 uppercase">ই-মেইল</label>
                      <input type="email" className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-slate-500 uppercase">বৈবাহিক অবস্থা</label>
                      <select className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none" value={formData.maritalStatus} onChange={e => setFormData({...formData, maritalStatus: e.target.value})}>
                        <option value="No">না</option>
                        <option value="Yes">হ্যাঁ</option>
                      </select>
                    </div>
                    {formData.maritalStatus === 'Yes' && (
                      <>
                        <div className="space-y-1">
                          <label className="text-xs font-bold text-slate-500 uppercase">স্বামী/স্ত্রীর নাম</label>
                          <input className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none" value={formData.spouseName} onChange={e => setFormData({...formData, spouseName: e.target.value})} />
                        </div>
                        <div className="space-y-1">
                          <label className="text-xs font-bold text-slate-500 uppercase">শ্বশুরের নাম</label>
                          <input className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none" value={formData.spouseFatherName} onChange={e => setFormData({...formData, spouseFatherName: e.target.value})} />
                        </div>
                        <div className="space-y-1">
                          <label className="text-xs font-bold text-slate-500 uppercase">শাশুড়ির নাম</label>
                          <input className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none" value={formData.spouseMotherName} onChange={e => setFormData({...formData, spouseMotherName: e.target.value})} />
                        </div>
                        <div className="space-y-1">
                          <label className="text-xs font-bold text-slate-500 uppercase">স্বামী/স্ত্রীর NID</label>
                          <input className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none" value={formData.spouseNid} onChange={e => setFormData({...formData, spouseNid: e.target.value})} />
                        </div>
                        <div className="space-y-1">
                          <label className="text-xs font-bold text-slate-500 uppercase">স্বামী/স্ত্রীর জন্ম তারিখ</label>
                          <input type="date" className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none" value={formData.spouseDob} onChange={e => setFormData({...formData, spouseDob: e.target.value})} />
                        </div>
                        <div className="space-y-1">
                          <label className="text-xs font-bold text-slate-500 uppercase">স্বামী/স্ত্রীর ঠিকানা</label>
                          <input className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none" value={formData.spouseAddress} onChange={e => setFormData({...formData, spouseAddress: e.target.value})} />
                        </div>
                      </>
                    )}
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-slate-500 uppercase">যোগদানের তারিখ</label>
                      <input type="date" className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none" value={formData.joiningDate} onChange={e => setFormData({...formData, joiningDate: e.target.value})} />
                    </div>
                  </div>
                </section>

                {/* Address */}
                <section className="space-y-4">
                  <h4 className="text-lg font-bold text-emerald-700 border-b pb-2">ঠিকানা</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    {/* Present Address */}
                    <div className="space-y-3">
                      <h5 className="font-bold text-slate-700">বর্তমান ঠিকানা</h5>
                      <div className="grid grid-cols-2 gap-3">
                        <input placeholder="গ্রাম" className="p-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none" value={formData.presentAddress.village} onChange={e => setFormData({...formData, presentAddress: {...formData.presentAddress, village: e.target.value}})} />
                        <input placeholder="ডাকঘর" className="p-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none" value={formData.presentAddress.postOffice} onChange={e => setFormData({...formData, presentAddress: {...formData.presentAddress, postOffice: e.target.value}})} />
                        <input placeholder="থানা" className="p-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none" value={formData.presentAddress.thana} onChange={e => setFormData({...formData, presentAddress: {...formData.presentAddress, thana: e.target.value}})} />
                        <input placeholder="জেলা" className="p-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none" value={formData.presentAddress.district} onChange={e => setFormData({...formData, presentAddress: {...formData.presentAddress, district: e.target.value}})} />
                      </div>
                    </div>
                    {/* Permanent Address */}
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <h5 className="font-bold text-slate-700">স্থায়ী ঠিকানা</h5>
                        <label className="flex items-center gap-2 text-xs font-bold text-emerald-600 cursor-pointer">
                          <input type="checkbox" checked={sameAsPresent} onChange={e => handleSameAsPresent(e.target.checked)} />
                          বর্তমান ঠিকানার মতই
                        </label>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <input disabled={sameAsPresent} placeholder="গ্রাম" className="p-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none disabled:opacity-50" value={formData.permanentAddress.village} onChange={e => setFormData({...formData, permanentAddress: {...formData.permanentAddress, village: e.target.value}})} />
                        <input disabled={sameAsPresent} placeholder="ডাকঘর" className="p-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none disabled:opacity-50" value={formData.permanentAddress.postOffice} onChange={e => setFormData({...formData, permanentAddress: {...formData.permanentAddress, postOffice: e.target.value}})} />
                        <input disabled={sameAsPresent} placeholder="থানা" className="p-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none disabled:opacity-50" value={formData.permanentAddress.thana} onChange={e => setFormData({...formData, permanentAddress: {...formData.permanentAddress, thana: e.target.value}})} />
                        <input disabled={sameAsPresent} placeholder="জেলা" className="p-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none disabled:opacity-50" value={formData.permanentAddress.district} onChange={e => setFormData({...formData, permanentAddress: {...formData.permanentAddress, district: e.target.value}})} />
                      </div>
                    </div>
                  </div>
                </section>

                <div className="flex gap-4 pt-6">
                  <button 
                    disabled={isSubmitting}
                    type="button" 
                    onClick={() => {
                      setShowAddModal(false);
                      setEditingId(null);
                      setFormData(initialFormData);
                    }} 
                    className="flex-1 py-4 text-slate-500 font-bold hover:bg-slate-50 rounded-2xl transition-colors border border-slate-200 disabled:opacity-50"
                  >
                    বাতিল
                  </button>
                  <button 
                    disabled={isSubmitting}
                    type="submit" 
                    className="flex-1 py-4 bg-emerald-600 text-white font-bold rounded-2xl shadow-xl shadow-emerald-100 hover:bg-emerald-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {isSubmitting ? (
                      <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                    ) : (
                      editingId ? 'আপডেট করুন' : 'সংরক্ষণ করুন'
                    )}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* View Modal */}
      <AnimatePresence>
        {showViewModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="bg-white w-full max-w-4xl rounded-[40px] shadow-2xl overflow-hidden max-h-[95vh] flex flex-col"
            >
              {/* Header with Photo */}
              <div className="relative h-48 bg-gradient-to-r from-[#003366] to-[#0055aa] p-8 flex items-end">
                <button 
                  onClick={() => setShowViewModal(null)} 
                  className="absolute top-6 right-6 p-2 bg-white/10 hover:bg-white/20 text-white rounded-full transition-colors backdrop-blur-md"
                >
                  <X size={24} />
                </button>
                
                <div className="flex items-center gap-6 translate-y-12">
                  <div className="w-32 h-32 rounded-3xl border-4 border-white shadow-xl overflow-hidden bg-slate-100">
                    {showViewModal.photoUrl ? (
                      <img 
                        src={getDirectDriveUrl(showViewModal.photoUrl)} 
                        alt="" 
                        className="w-full h-full object-cover" 
                        referrerPolicy="no-referrer" 
                        loading="lazy" 
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-slate-400 bg-slate-50">
                        <Eye size={40} className="opacity-20" />
                      </div>
                    )}
                  </div>
                  <div className="pb-4">
                    <h3 className="text-3xl font-black text-white drop-shadow-md">{showViewModal.name}</h3>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="px-3 py-1 bg-emerald-500 text-white text-xs font-bold rounded-full shadow-lg shadow-emerald-500/20">
                        একাউন্ট নং: {showViewModal.accountNumber}
                      </span>
                      <span className="px-3 py-1 bg-white/20 text-white text-xs font-bold rounded-full backdrop-blur-md">
                        {showViewModal.status === 'active' ? 'সক্রিয় সদস্য' : 'নিষ্ক্রিয় সদস্য'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Content Area */}
              <div className="flex-1 overflow-y-auto pt-20 p-8">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                  {/* Column 1: Personal */}
                  <div className="space-y-6">
                    <section>
                      <h4 className="text-lg font-black text-emerald-700 mb-6 flex items-center gap-3">
                        <div className="w-2 h-8 bg-emerald-500 rounded-full shadow-lg shadow-emerald-200"></div>
                        ব্যক্তিগত তথ্য
                      </h4>
                      <div className="bg-white rounded-[32px] border border-slate-100 shadow-sm overflow-hidden">
                        <DetailItem label="নাম (English)" value={showViewModal.nameEnglish} />
                        <DetailItem label="পিতার নাম" value={showViewModal.fatherName} />
                        <DetailItem label="মাতার নাম" value={showViewModal.motherName} />
                        <DetailItem label="এনআইডি" value={showViewModal.nid} />
                        <DetailItem label="জন্ম তারিখ" value={showViewModal.dob ? toBengaliNumber(showViewModal.dob.split('-').reverse().join('-')) : '---'} />
                        <DetailItem label="লিঙ্গ" value={showViewModal.gender === 'Male' ? 'পুরুষ' : showViewModal.gender === 'Female' ? 'মহিলা' : 'অন্যান্য'} />
                        <DetailItem label="রক্তের গ্রুপ" value={showViewModal.bloodGroup} />
                        <DetailItem label="ধর্ম" value={showViewModal.religion} />
                      </div>
                    </section>
                  </div>

                  {/* Column 2: Contact & Professional */}
                  <div className="space-y-8">
                    <section>
                      <h4 className="text-lg font-black text-emerald-700 mb-6 flex items-center gap-3">
                        <div className="w-2 h-8 bg-emerald-500 rounded-full shadow-lg shadow-emerald-200"></div>
                        যোগাযোগ ও পেশা
                      </h4>
                      <div className="bg-white rounded-[32px] border border-slate-100 shadow-sm overflow-hidden">
                        <DetailItem label="মোবাইল" value={showViewModal.mobile} />
                        <DetailItem label="বিকল্প মোবাইল" value={showViewModal.altMobile} />
                        <DetailItem label="ই-মেইল" value={showViewModal.email} />
                        <DetailItem label="পেশা" value={showViewModal.profession} />
                        <DetailItem label="ব্যবসায়ের নাম" value={showViewModal.businessName} />
                        <DetailItem label="শিক্ষা" value={showViewModal.education} />
                        <DetailItem label="যোগদানের তারিখ" value={showViewModal.joiningDate ? toBengaliNumber(showViewModal.joiningDate.split('-').reverse().join('-')) : '---'} />
                      </div>
                    </section>

                    <section>
                      <h4 className="text-lg font-black text-emerald-700 mb-6 flex items-center gap-3">
                        <div className="w-2 h-8 bg-emerald-500 rounded-full shadow-lg shadow-emerald-200"></div>
                        ঠিকানা
                      </h4>
                      <div className="space-y-4">
                        <div className="bg-white p-6 rounded-[32px] border border-slate-100 shadow-sm">
                          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">বর্তমান ঠিকানা</p>
                          <p className="text-sm text-slate-800 leading-relaxed font-bold">
                            {showViewModal.presentAddress?.village || '---'}, {showViewModal.presentAddress?.postOffice || '---'}, {showViewModal.presentAddress?.thana || '---'}, {showViewModal.presentAddress?.district || '---'}
                          </p>
                        </div>
                        <div className="bg-white p-6 rounded-[32px] border border-slate-100 shadow-sm">
                          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">স্থায়ী ঠিকানা</p>
                          <p className="text-sm text-slate-800 leading-relaxed font-bold">
                            {showViewModal.permanentAddress?.village || '---'}, {showViewModal.permanentAddress?.postOffice || '---'}, {showViewModal.permanentAddress?.thana || '---'}, {showViewModal.permanentAddress?.district || '---'}
                          </p>
                        </div>
                      </div>
                    </section>
                  </div>

                  {/* Column 3: Family */}
                  <div className="space-y-8">
                    <section>
                      <h4 className="text-lg font-black text-emerald-700 mb-6 flex items-center gap-3">
                        <div className="w-2 h-8 bg-emerald-500 rounded-full shadow-lg shadow-emerald-200"></div>
                        পারিবারিক তথ্য
                      </h4>
                      <div className="bg-white rounded-[32px] border border-slate-100 shadow-sm overflow-hidden">
                        <DetailItem label="বৈবাহিক অবস্থা" value={showViewModal.maritalStatus === 'Yes' ? 'বিবাহিত' : 'অবিবাহিত'} />
                        {showViewModal.maritalStatus === 'Yes' && (
                          <>
                            <DetailItem label="স্বামী/স্ত্রীর নাম" value={showViewModal.spouseName} />
                            <DetailItem label="শ্বশুরের নাম" value={showViewModal.spouseFatherName} />
                            <DetailItem label="শাশুড়ির নাম" value={showViewModal.spouseMotherName} />
                            <DetailItem label="স্বামী/স্ত্রীর NID" value={showViewModal.spouseNid} />
                            <DetailItem label="স্বামী/স্ত্রীর জন্ম তারিখ" value={showViewModal.spouseDob ? toBengaliNumber(showViewModal.spouseDob.split('-').reverse().join('-')) : '---'} />
                            <div className="p-4 bg-slate-50/50">
                              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">স্বামী/স্ত্রীর ঠিকানা</p>
                              <p className="text-sm text-slate-800 font-bold leading-relaxed">{showViewModal.spouseAddress || '---'}</p>
                            </div>
                          </>
                        )}
                      </div>
                    </section>
                  </div>
                </div>
              </div>
              
              {/* Footer Actions */}
              <div className="p-6 bg-slate-50 border-t border-slate-100 flex justify-end gap-3">
                <button 
                  onClick={() => setShowViewModal(null)}
                  className="px-6 py-2 text-slate-500 font-bold hover:bg-slate-100 rounded-xl transition-colors"
                >
                  বন্ধ করুন
                </button>
                {role === 'super_admin' && (
                  <button 
                    onClick={() => {
                      handleEdit(showViewModal);
                      setShowViewModal(null);
                    }}
                    className="px-6 py-2 bg-[#003366] text-white font-bold rounded-xl shadow-lg hover:bg-[#002244] transition-colors flex items-center gap-2"
                  >
                    <Edit2 size={16} />
                    এডিট করুন
                  </button>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {showDeleteConfirm && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white w-full max-w-sm rounded-3xl p-8 text-center space-y-6"
            >
              <div className="w-20 h-20 bg-rose-50 text-rose-600 rounded-full flex items-center justify-center mx-auto">
                <Trash2 size={40} />
              </div>
              <div className="space-y-2">
                <h3 className="text-xl font-bold text-slate-800">আপনি কি নিশ্চিত?</h3>
                <p className="text-slate-500">এই গ্রাহকের তথ্য স্থায়ীভাবে মুছে ফেলা হবে। এই কাজটি আর ফিরিয়ে আনা যাবে না।</p>
              </div>
              <div className="flex gap-3">
                <button 
                  disabled={isDeleting}
                  onClick={() => setShowDeleteConfirm(null)}
                  className="flex-1 py-3 text-slate-500 font-bold hover:bg-slate-50 rounded-xl transition-colors disabled:opacity-50"
                >
                  বাতিল
                </button>
                <button 
                  disabled={isDeleting}
                  onClick={() => handleDelete(showDeleteConfirm)}
                  className="flex-1 py-3 bg-rose-600 text-white font-bold rounded-xl shadow-lg shadow-rose-200 hover:bg-rose-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {isDeleting ? (
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                  ) : (
                    'হ্যাঁ, ডিলিট করুন'
                  )}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

const DetailItem = ({ label, value }: { label: string, value: string }) => (
  <div className="flex flex-col border-b border-slate-50 py-3 group hover:bg-emerald-50/30 transition-all px-3 rounded-xl">
    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{label}</span>
    <span className="text-sm font-bold text-slate-800">{value || '---'}</span>
  </div>
);

function cn(...classes: any[]) {
  return classes.filter(Boolean).join(' ');
}
