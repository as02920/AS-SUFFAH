import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, query, orderBy, limit, doc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from './firebase';
import { useAuth } from './AuthContext';
import { formatCurrency, cn, getDirectDriveUrl, toBengaliNumber } from './lib/utils';
import { Wallet, Users, TrendingUp, AlertCircle, Landmark, BookOpen } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { LoadingScreen } from './components/LoadingScreen';

// StatCard Component for the Grid
const StatCard = ({ title, value, icon: Icon, color, subValue }: any) => (
  <motion.div 
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 flex flex-col gap-2"
  >
    <div className="flex justify-between items-start">
      <div className={cn("p-2 rounded-xl", color)}>
        <Icon size={20} className="text-white" />
      </div>
    </div>
    <div>
      <p className="text-xs text-slate-500 font-medium uppercase tracking-wider">{title}</p>
      <h3 className="text-xl font-bold text-slate-800 mt-1">{formatCurrency(value)}</h3>
      {subValue && <p className="text-[10px] text-slate-400 mt-1">{subValue}</p>}
    </div>
  </motion.div>
);

export const Dashboard = () => {
  const { role, appSettings } = useAuth();
  const [loading, setLoading] = useState(true);
  const [minLoadingTimePassed, setMinLoadingTimePassed] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setMinLoadingTimePassed(true);
    }, 1000); // ১ সেকেন্ড মিনিমাম লোডিং টাইম ড্যাশবোর্ডের জন্য
    return () => clearTimeout(timer);
  }, []);

  const [recentInvestments, setRecentInvestments] = useState<any[]>([]);
  const [data, setData] = useState<any>({
    investments: [] as any[],
    transactions: [] as any[],
    directorTransactions: [] as any[],
    bankTransactions: [] as any[],
  });

  useEffect(() => {
    if (!role) return;

    let loadedCount = 0;
    const totalToLoad = 5;

    const checkLoaded = () => {
      loadedCount++;
      if (loadedCount >= totalToLoad) {
        setLoading(false);
      }
    };

    // ১. পরিচালক ও ব্যাংক লেনদেন (সাধারণত কম ডাটা থাকে, তাই আগে লোড হবে)
    const unsubDir = onSnapshot(collection(db, 'director_transactions'), (snap) => {
      setData(prev => ({ ...prev, directorTransactions: snap.docs.map(doc => ({ id: doc.id, ...doc.data() })) }));
      checkLoaded();
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'director_transactions');
      setLoading(false);
    });

    const unsubBank = onSnapshot(collection(db, 'bank_transactions'), (snap) => {
      setData(prev => ({ ...prev, bankTransactions: snap.docs.map(doc => ({ id: doc.id, ...doc.data() })) }));
      checkLoaded();
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'bank_transactions');
      setLoading(false);
    });

    // ২. ইনভেস্টমেন্টস ও ট্রানজ্যাকশন (বেশি ডাটা, তাই ধাপে ধাপে)
    const unsubInv = onSnapshot(collection(db, 'investments'), (snap) => {
      setData(prev => ({ ...prev, investments: snap.docs.map(doc => ({ id: doc.id, ...doc.data() })) }));
      checkLoaded();
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'investments');
      setLoading(false);
    });

    const unsubTrs = onSnapshot(collection(db, 'transactions'), (snap) => {
      setData(prev => ({ ...prev, transactions: snap.docs.map(doc => ({ id: doc.id, ...doc.data() })) }));
      checkLoaded();
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'transactions');
      setLoading(false);
    });

    // ৩. সর্বশেষ ৩টি বিনিয়োগ (ড্যাশবোর্ড লিস্টের জন্য - এটি আলাদা কুয়েরি)
    const q = query(collection(db, 'investments'), orderBy('createdAt', 'desc'), limit(3));
    const unsubRecent = onSnapshot(q, (snap) => {
      setRecentInvestments(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      checkLoaded();
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'investments');
      setLoading(false);
    });

    return () => {
      unsubDir(); unsubBank(); unsubInv(); unsubTrs(); unsubRecent();
    };
  }, [role]);

  // --- গাণিতিক লজিক (রিপোর্ট পেজের মতো নিখুঁত ক্যালকুলেশন) ---
  // ... (rest of the logic remains same)
  
  // ১. ডিরেক্টর হিসাব
  let totalDirDep = 0, totalDirWit = 0, totalProfWit = 0;
  data.directorTransactions.forEach((t: any) => {
    if (t.type === 'deposit') totalDirDep += (t.amount || 0);
    if (t.type === 'withdrawal') totalDirWit += (t.amount || 0);
    if (t.type === 'profit_withdraw') totalProfWit += (t.amount || 0);
  });

  // ২. ব্যাংক হিসাব
  let totalBankDep = 0, totalBankWit = 0;
  data.bankTransactions.forEach((t: any) => {
    if (t.type === 'deposit') totalBankDep += (t.amount || 0);
    if (t.type === 'withdrawal') totalBankWit += (t.amount || 0);
  });
  const currentBankBalance = totalBankDep - totalBankWit;

  // ৩. বিনিয়োগ ও কিস্তি আদায় (আসল ও মুনাফা আলাদা করা)
  let totalInvGiven = 0, currentDue = 0;
  data.investments.forEach((inv: any) => {
    totalInvGiven += parseFloat(inv.amount) || 0;
    if (inv.status === 'চলমান') currentDue += (inv.dueAmount || 0);
  });

  let totalPrincipalColl = 0, totalProfitColl = 0, totalFineColl = 0, totalExp = 0;
  data.transactions.forEach((t: any) => {
    if (t.type === 'payment' || t.type === 'settlement') {
      totalFineColl += (t.fine || 0);
      const inv = data.investments.find((i: any) => i.id === t.investmentId);
      if (inv && inv.totalAmount > 0) {
        const profitPortion = t.amount * (inv.profitAmount / inv.totalAmount);
        totalProfitColl += profitPortion;
        totalPrincipalColl += (t.amount - profitPortion);
      }
    } else if (t.type === 'expense') {
      totalExp += (t.amount || 0);
    }
  });

  // ৪. ফাইনাল নগদ টাকা (রিপোর্ট পেজের বর্তমান ক্যাশ ফর্মুলা)
  const currentCash = (totalDirDep - totalDirWit) 
                    - totalInvGiven 
                    + (totalPrincipalColl + totalProfitColl + totalFineColl) 
                    - totalExp 
                    - totalBankDep 
                    + totalBankWit 
                    - totalProfWit;

  if (loading || !minLoadingTimePassed) return <LoadingScreen />;

  return (
    <div className="space-y-6">
      <div className="flex flex-col items-center justify-center gap-1 text-center">
        <h2 className="text-2xl font-black text-slate-800">আসসালামু আলাইকুম</h2>
      </div>

      {/* Main Stats Grid */}
      <div className="grid grid-cols-2 gap-4">
        <StatCard 
          title="নগদ টাকা" 
          value={currentCash} 
          icon={Wallet} 
          color="bg-emerald-500" 
        />
        <StatCard 
          title="ব্যাংক ব্যালেন্স" 
          value={currentBankBalance} 
          icon={Landmark} 
          color="bg-blue-600" 
        />
        <StatCard 
          title="পরিচালকের আমানত" 
          value={totalDirDep - totalDirWit} 
          icon={Users} 
          color="bg-indigo-500" 
          subValue="বর্তমান মোট মূলধন"
        />
        <StatCard 
          title="মোট বকেয়া" 
          value={currentDue} 
          icon={AlertCircle} 
          color="bg-amber-500" 
          subValue="চলমান বিনিয়োগের কিস্তি"
        />
      </div>

      {/* Recent Investments List */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
            <TrendingUp size={20} className="text-emerald-600" />
            সর্বশেষ বিনিয়োগ
          </h3>
        </div>
        
        <div className="grid grid-cols-1 gap-3">
          {recentInvestments.length > 0 ? (
            recentInvestments.map((inv) => (
              <motion.div 
                key={inv.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex justify-between items-center"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-600">
                    <TrendingUp size={20} />
                  </div>
                  <div>
                    <h4 className="font-bold text-slate-800 text-sm">{inv.customerName}</h4>
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">
                      একাউন্ট: {toBengaliNumber(inv.customerAccountNumber)} • {toBengaliNumber(inv.startDate?.split('-').reverse().join('-'))}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm font-black text-slate-800">{formatCurrency(inv.amount)}</p>
                  <p className={cn(
                    "text-[10px] font-bold px-2 py-0.5 rounded-full inline-block",
                    inv.status === 'চলমান' ? "bg-emerald-100 text-emerald-600" : "bg-slate-100 text-slate-600"
                  )}>
                    {inv.status}
                  </p>
                </div>
              </motion.div>
            ))
          ) : (
            <div className="bg-slate-50 p-8 rounded-2xl border border-dashed border-slate-200 text-center">
              <p className="text-slate-400 text-sm font-bold">কোন বিনিয়োগ পাওয়া যায়নি</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};