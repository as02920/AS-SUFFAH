import React, { createContext, useContext, useEffect, useState } from 'react';
import { collection, query, where, onSnapshot, getDocs } from 'firebase/firestore';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { db, auth, handleFirestoreError, OperationType } from './firebase';
import { doc } from 'firebase/firestore';

interface AuthContextType {
  user: any | null;
  role: 'super_admin' | 'admin' | 'director' | null;
  directorId: string | null;
  userId: string | null;
  loading: boolean;
  logout: () => void;
  appSettings: {
    loadingLogoUrl: string;
    loadingTitle: string;
    loadingSubtitle: string;
    appName?: string;
    logoText?: string;
    logoUrl?: string;
  };
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  role: null,
  directorId: null,
  userId: null,
  loading: true,
  logout: () => {},
  appSettings: {
    loadingLogoUrl: '',
    loadingTitle: 'আস-সুফফা',
    loadingSubtitle: 'হালাল আয়ে, সুন্দর আগামীর পথে',
    appName: 'আস-সুফফা',
    logoText: 'আস-সুফফা'
  }
});

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<any | null>(() => {
    const saved = localStorage.getItem('auth_user');
    return saved ? JSON.parse(saved) : null;
  });
  const [role, setRole] = useState<'super_admin' | 'admin' | 'director' | null>(() => {
    return localStorage.getItem('auth_role') as any || null;
  });
  const [directorId, setDirectorId] = useState<string | null>(() => {
    return localStorage.getItem('auth_directorId');
  });
  const [userId, setUserId] = useState<string | null>(() => {
    return localStorage.getItem('auth_userId');
  });
  const [appSettings, setAppSettings] = useState({
    loadingLogoUrl: '',
    loadingTitle: 'আস-সুফফা',
    loadingSubtitle: 'হালাল আয়ে, সুন্দর আগামীর পথে'
  });
  const [loading, setLoading] = useState(true);
  const [minLoadingTimePassed, setMinLoadingTimePassed] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setMinLoadingTimePassed(true);
    }, 2000); // ২ সেকেন্ড মিনিমাম লোডিং টাইম
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    let unsubDoc: (() => void) | null = null;
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      if (unsubDoc) {
        unsubDoc();
        unsubDoc = null;
      }

      if (firebaseUser) {
        // Even if we have cached data, we still want to refresh it from Firestore
        const q = query(collection(db, 'users'), where('email', '==', firebaseUser.email));
        unsubDoc = onSnapshot(q, (snap) => {
          if (!snap.empty) {
            const userData = snap.docs[0].data();
            const fullUser = { ...firebaseUser, ...userData };
            setUser(fullUser);
            localStorage.setItem('auth_user', JSON.stringify(fullUser));
            
            let userRole: any = userData.role;
            if (firebaseUser.email === "shanubegumts@gmail.com") {
              userRole = 'super_admin';
            }
            setRole(userRole);
            localStorage.setItem('auth_role', userRole || '');
            
            setDirectorId(userData.directorId || null);
            localStorage.setItem('auth_directorId', userData.directorId || '');
            
            setUserId(userData.userId || null);
            localStorage.setItem('auth_userId', userData.userId || '');
          } else {
            setUser(firebaseUser);
            localStorage.setItem('auth_user', JSON.stringify(firebaseUser));
            if (firebaseUser.email === "shanubegumts@gmail.com") {
              setRole('super_admin');
              localStorage.setItem('auth_role', 'super_admin');
            } else {
              setRole(null);
              localStorage.setItem('auth_role', '');
            }
          }
          setLoading(false);
        }, (error) => {
          console.error("Auth Firestore error:", error);
          if (firebaseUser.email === "shanubegumts@gmail.com") {
            setRole('super_admin');
            setUser(firebaseUser);
          }
          setLoading(false);
        });
      } else {
        setUser(null);
        setRole(null);
        setDirectorId(null);
        setUserId(null);
        setLoading(false);
        localStorage.removeItem('auth_user');
        localStorage.removeItem('auth_role');
        localStorage.removeItem('auth_directorId');
        localStorage.removeItem('auth_userId');
      }
    });

    return () => {
      unsubscribe();
      if (unsubDoc) unsubDoc();
    };
  }, []);

  useEffect(() => {
    const unsubSettings = onSnapshot(doc(db, 'app_settings', 'loading_screen'), (docSnap) => {
      if (docSnap.exists()) {
        setAppSettings(docSnap.data() as any);
      }
    }, (error) => {
      console.warn("App settings snapshot error (likely permissions):", error);
      // Fallback to default settings is already handled by state initialization
    });
    return () => unsubSettings();
  }, []);

  const logout = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error("Logout error:", error);
    }
  };

  return (
    <AuthContext.Provider value={{ user, role, directorId, userId, loading: loading || !minLoadingTimePassed, logout, appSettings }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
