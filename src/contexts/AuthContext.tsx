import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  User as FirebaseUser,
  updateProfile,
} from 'firebase/auth';
import {
  doc,
  getDoc,
  setDoc,
  serverTimestamp,
  addDoc,
  collection,
  updateDoc, // <-- AJOUTE-LE ICI
} from 'firebase/firestore';
import { auth, db } from '../lib/firebase';

interface UserDaily {
  caloriesConsumed?: number;
  proteinConsumed?: number;
  photosCount?: number;
  photosDate?: string;
  lastResetDate?: string;
  caloriesTarget?: number;
  proteinTarget?: number;
  targetWeight?: number;
  stravaRecentCalories?: number;
  stravaLastSync?: string | Date;
}

interface User {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  age?: number;
  height?: number;
  weight?: number;
  bodyFat?: number;
  muscleMass?: number;
  boneMass?: number;
  calibrationPhoto?: string;
  isOnboardingComplete: boolean;
  createdAt?: any;
  updatedAt?: any;
  
  // --- AJOUTS REQUIS ---
  targetWeight?: number; // Pour corriger l'erreur de Profile.tsx
  daily?: UserDaily;     // Pour corriger l'erreur de StravaAuth.tsx (et AuthContext lui-même)
  // --- FIN DES AJOUTS ---
}

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (userData: Partial<User> & { password?: string }) => Promise<void>;
  updateUser: (userData: Partial<User>) => Promise<void>;
  completeOnboarding: () => Promise<void>;
  logout: () => Promise<void>;
  createProgress: (data: { weight: number; bodyFat?: number; muscleMass?: number; date?: any }) => Promise<void>; // ajouté
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider = ({ children }: AuthProviderProps) => {
  const [user, setUser] = useState<User | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  // helper pour retirer undefined (préserve objets imbriqués)
  const removeUndefined = (obj: any) => {
    if (!obj || typeof obj !== 'object') return obj;
    const out: any = Array.isArray(obj) ? [] : {};
    Object.keys(obj).forEach(k => {
      const v = obj[k];
      if (v !== undefined) {
        out[k] = (typeof v === 'object' && v !== null) ? removeUndefined(v) : v;
      }
    });
    return out;
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (fbUser: FirebaseUser | null) => {
      if (fbUser) {
        const uid = fbUser.uid;
        const userRef = doc(db, 'users', uid);

        try {
          const snap = await getDoc(userRef);
          if (snap.exists()) {
            const data = snap.data() as any;

            // Normalisation et reset quotidien côté serveur si nécessaire
            const today = new Date().toISOString().slice(0, 10);
            const daily = data.daily ?? {};
            const lastReset = daily.lastResetDate ?? null;

            if (lastReset !== today) {
              const resetDaily = {
                caloriesConsumed: 0,
                proteinConsumed: 0,
                photosCount: 0,
                photosDate: today,
                lastResetDate: today
              };
              try {
                // Persist reset (merge)
                await setDoc(userRef, { daily: resetDaily, updatedAt: serverTimestamp() }, { merge: true });
                data.daily = { ...(data.daily || {}), ...resetDaily };
              } catch (err) {
                console.warn('Impossible d\'appliquer reset daily', err);
              }
            } else {
              // s'assurer que fields existent
              data.daily = {
                photosCount: daily.photosCount ?? 0,
                photosDate: daily.photosDate ?? today,
                caloriesConsumed: daily.caloriesConsumed ?? 0,
                proteinConsumed: daily.proteinConsumed ?? 0,
                caloriesTarget: daily.caloriesTarget ?? undefined,
                proteinTarget: daily.proteinTarget ?? undefined,
                lastResetDate: daily.lastResetDate ?? today,
                ...daily
              };
            }

            setUser({
              id: data.id || uid,
              firstName: data.firstName || '',
              lastName: data.lastName || '',
              email: data.email || fbUser.email || '',
              age: data.age,
              height: data.height,
              weight: data.weight,
              bodyFat: data.bodyFat,
              muscleMass: data.muscleMass,
              boneMass: data.boneMass,
              calibrationPhoto: data.calibrationPhoto,
              targetWeight: data.targetWeight,
              daily: data.daily ?? {},
              isOnboardingComplete: data.isOnboardingComplete || false,
              createdAt: data.createdAt,
              updatedAt: data.updatedAt
            });
            setIsAuthenticated(true);
          } else {
            // Pas de doc Firestore : créer minimal avec daily normalisé
            const minimalUser = {
              id: uid,
              firstName: fbUser.displayName?.split(' ')[0] || '',
              lastName: fbUser.displayName?.split(' ')[1] || '',
              email: fbUser.email || '',
              daily: {
                caloriesConsumed: 0,
                proteinConsumed: 0,
                photosCount: 0,
                photosDate: new Date().toISOString().slice(0,10),
                lastResetDate: new Date().toISOString().slice(0,10)
              },
              isOnboardingComplete: false,
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp()
            };
            try {
              await setDoc(userRef, minimalUser, { merge: true });
            } catch (err) {
              console.warn('Impossible d\'écrire le doc user (permissions) — fallback local', err);
            }
            setUser(minimalUser as any);
            setIsAuthenticated(true);
          }
        } catch (err: any) {
          console.warn('Erreur lecture utilisateur firestore', err);
          // fallback local minimal user
          const fallbackUser = {
            id: uid,
            firstName: fbUser.displayName?.split(' ')[0] || '',
            lastName: fbUser.displayName?.split(' ')[1] || '',
            email: fbUser.email || '',
            daily: { caloriesConsumed: 0, proteinConsumed: 0, photosCount: 0, photosDate: new Date().toISOString().slice(0,10), lastResetDate: new Date().toISOString().slice(0,10) },
            isOnboardingComplete: false
          };
          setUser(fallbackUser as any);
          setIsAuthenticated(true);
        }
      } else {
        setUser(null);
        setIsAuthenticated(false);
      }
    });

    return () => unsubscribe();
  }, []);

  const login = async (email: string, password: string) => {
    try {
      const cred = await signInWithEmailAndPassword(auth, email, password);
      const uid = cred.user.uid;
      const userRef = doc(db, 'users', uid);
      try {
        const snap = await getDoc(userRef);
        if (snap.exists()) {
          const data = snap.data() as any;
          setUser({
            id: data.id || uid,
            firstName: data.firstName || '',
            lastName: data.lastName || '',
            email: data.email || email,
            age: data.age,
            height: data.height,
            weight: data.weight,
            bodyFat: data.bodyFat,
            muscleMass: data.muscleMass,
            boneMass: data.boneMass,
            calibrationPhoto: data.calibrationPhoto,
            isOnboardingComplete: data.isOnboardingComplete || false,
            createdAt: data.createdAt,
            updatedAt: data.updatedAt
          });
          setIsAuthenticated(true);
          return;
        } else {
          // Pas de doc Firestore : fallback minimal pour lancer onboarding
          const minimalUser = {
            id: uid,
            firstName: cred.user.displayName?.split(' ')[0] || '',
            lastName: cred.user.displayName?.split(' ')[1] || '',
            email,
            age: undefined,
            isOnboardingComplete: false
          };
          setUser(minimalUser as any);
          setIsAuthenticated(true);
          return;
        }
      } catch (err: any) {
        // Erreur lecture Firestore -> fallback sur info Auth
        console.warn('Erreur lecture firestore après login, fallback local', err);
        const minimalUser = {
          id: uid,
          firstName: cred.user.displayName?.split(' ')[0] || '',
          lastName: cred.user.displayName?.split(' ')[1] || '',
          email,
          age: undefined,
          isOnboardingComplete: false
        };
        setUser(minimalUser as any);
        setIsAuthenticated(true);
        return;
      }
    } catch (error: any) {
      // Propager erreur pour UI si besoin
      throw error;
    }
  };

  // UNIQUE implémentation de updateUser — remplace toute autre définition du même nom
  const updateUser = async (patch: any) => {
    if (!auth.currentUser) {
      throw new Error('Utilisateur non authentifié');
    }
    const uid = auth.currentUser.uid;
    const userRef = doc(db, 'users', uid);
    try {
      const cleaned = removeUndefined(patch);
      // ajouter updatedAt
      cleaned.updatedAt = serverTimestamp();
      // setDoc avec merge pour garder les champs existants (supporte nested objects comme daily)
      await setDoc(userRef, cleaned, { merge: true });

      // Mettre à jour le user local si présent
      setUser(prev => {
        if (!prev) return prev;
        // shallow merge + deep merge pour daily si besoin
        const merged = { ...prev, ...cleaned };
        if (prev.daily && cleaned.daily) {
          merged.daily = { ...prev.daily, ...cleaned.daily };
        }
        // s'assurer que targetWeight est pris en compte
        if (cleaned.targetWeight !== undefined) merged.targetWeight = cleaned.targetWeight;
        return merged;
      });
      return;
    } catch (err) {
      console.warn('updateUser failed', err);
      throw err;
    }
  };

  const register = async (userData: Partial<User> & { password?: string }) => {
    const { email, password, firstName = '', lastName = '', age } = userData as any;
    if (!email || !password) {
      throw new Error('Email et mot de passe requis.');
    }

    try {
      const cred = await createUserWithEmailAndPassword(auth, email, password);
      const uid = cred.user.uid;
      const userRef = doc(db, 'users', uid);

      // Mettre à jour displayName sur l'utilisateur Firebase (utile si Firestore échoue)
      try {
        await updateProfile(cred.user, { displayName: `${firstName} ${lastName}`.trim() });
      } catch (err) {
        console.warn('updateProfile échoué', err);
      }

      const newUserRaw = {
        id: uid,
        firstName,
        lastName,
        email,
        age: age !== undefined ? age : undefined,
        height: userData.height,
        weight: userData.weight,
        bodyFat: userData.bodyFat,
        muscleMass: userData.muscleMass,
        boneMass: userData.boneMass,
        calibrationPhoto: userData.calibrationPhoto,
        isOnboardingComplete: false,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      };

      const newUser = removeUndefined(newUserRaw);

      try {
        await setDoc(userRef, newUser, { merge: true });
      } catch (err) {
        console.warn('Impossible d\'écrire le doc user (permissions) — fallback local', err);
      }

      setUser(newUser as any);
      setIsAuthenticated(true);
    } catch (error: any) {
      const code = error?.code || '';

      if (code === 'auth/email-already-in-use') {
        // Si l'email existe déjà : tenter connexion (comportement antérieur),
        // puis mettre à jour le doc Firestore si nécessaire (prénom/nom fournis).
        try {
          await signInWithEmailAndPassword(auth, email, password);
          // after sign-in, ensure Firestore doc has firstName/lastName
          const currentUid = auth.currentUser?.uid;
          if (currentUid) {
            const userRef = doc(db, 'users', currentUid);
            try {
              const snap = await getDoc(userRef);
              if (snap.exists()) {
                const data = snap.data() as any;
                const needsUpdate = (!data.firstName || !data.firstName.trim()) || (!data.lastName || !data.lastName.trim());
                if (needsUpdate) {
                  try {
                    await updateDoc(userRef, {
                      firstName: firstName || data.firstName || '',
                      lastName: lastName || data.lastName || '',
                      updatedAt: serverTimestamp()
                    } as any);
                  } catch (err) {
                    console.warn('Impossible de mettre à jour le doc user après sign-in (permissions)', err);
                  }
                }
              } else {
                // pas de doc -> créer (merge pour sécurité)
                const docData = {
                  id: currentUid,
                  firstName,
                  lastName,
                  email,
                  isOnboardingComplete: false,
                  createdAt: serverTimestamp(),
                  updatedAt: serverTimestamp()
                };
                try {
                  await setDoc(userRef, docData, { merge: true });
                } catch (err) {
                  console.warn('Impossible de créer le doc user après sign-in (permissions)', err);
                }
              }
            } catch (err) {
              console.warn('Erreur lecture userRef après sign-in', err);
            }
          }
          // enfin, recharger l'état utilisateur via login helper
          await login(email, password);
          return;
        } catch (err) {
          throw new Error('Cet e‑mail est déjà utilisé. Mot de passe incorrect ?');
        }
      }

      if (code === 'auth/weak-password') {
        throw new Error('Mot de passe trop faible. Utilise au moins 6 caractères.');
      }
      if (code === 'auth/invalid-email') {
        throw new Error('Adresse e‑mail invalide.');
      }
      throw new Error(error?.message || 'Erreur lors de la création du compte.');
    }
  };

  const completeOnboarding = async () => {
    if (!auth.currentUser) return;
    const uid = auth.currentUser.uid;
    const userRef = doc(db, 'users', uid);
    try {
      await updateDoc(userRef, { isOnboardingComplete: true, updatedAt: serverTimestamp() } as any);
      setUser(prev => prev ? ({ ...prev, isOnboardingComplete: true }) : prev);
    } catch (err: any) {
      console.warn('Impossible de mettre à jour onboarding sur Firestore (permissions) — update local seulement', err);
      setUser(prev => prev ? ({ ...prev, isOnboardingComplete: true }) : prev);
    }
  };

  const logout = async () => {
    try {
      await signOut(auth);
      setUser(null);
      setIsAuthenticated(false);
    } catch (err) {
      console.error('Erreur logout', err);
      throw err;
    }
  };

  const createProgress = async (data: { weight: number; bodyFat?: number; muscleMass?: number; date?: any }) => {
    if (!auth.currentUser) throw new Error('Non authentifié');
    try {
      const docRaw = {
        userId: auth.currentUser.uid,
        weight: data.weight,
        bodyFat: data.bodyFat,
        muscleMass: data.muscleMass,
        date: data.date || serverTimestamp()
      } as any;
      const docData = removeUndefined(docRaw);
      await addDoc(collection(db, 'progress'), docData as any);
    } catch (err) {
      console.warn('Erreur création progress', err);
      throw err;
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated,
        login,
        register,
        updateUser,
        completeOnboarding,
        logout,
        createProgress, // exposé
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};