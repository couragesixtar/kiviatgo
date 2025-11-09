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
  updateDoc,
  onSnapshot, // <-- 1. IMPORTATION AJOUTÉE
} from 'firebase/firestore';
import { auth, db } from '../lib/firebase';

// ... (Interfaces UserDaily, User, AuthContextType restent identiques) ...
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
  targetWeight?: number;
  daily?: UserDaily;
}

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (userData: Partial<User> & { password?: string }) => Promise<void>;
  updateUser: (userData: Partial<User>) => Promise<void>;
  completeOnboarding: () => Promise<void>;
  logout: () => Promise<void>;
  createProgress: (data: { weight: number; bodyFat?: number; muscleMass?: number; date?: any }) => Promise<void>;
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
    // ... (code inchangé) ...
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
    // --- 2. DÉBUT DE LA CORRECTION MAJEURE ---
    
    let unsubscribeFromSnapshot: (() => void) | null = null; // Pour arrêter l'écoute

    const unsubscribeFromAuth = onAuthStateChanged(auth, (fbUser: FirebaseUser | null) => {
      
      // Si on se déconnecte, on arrête d'écouter le snapshot précédent
      if (unsubscribeFromSnapshot) {
        unsubscribeFromSnapshot();
        unsubscribeFromSnapshot = null;
      }

      if (fbUser) {
        const uid = fbUser.uid;
        const userRef = doc(db, 'users', uid);

        // On remplace le getDoc par un onSnapshot
        unsubscribeFromSnapshot = onSnapshot(userRef, async (snap) => {
          try {
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
                  // On fait un updateDoc au lieu de setDoc pour être plus léger
                  // (Cela déclenchera onSnapshot une 2e fois, c'est normal et géré)
                  await updateDoc(userRef, { daily: resetDaily, updatedAt: serverTimestamp() });
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
                // setDoc (pas updateDoc) car le doc n'existe pas
                await setDoc(userRef, minimalUser, { merge: true });
              } catch (err) {
                console.warn('Impossible d\'écrire le doc user (permissions) — fallback local', err);
              }
              // onSnapshot se redéclenchera après le setDoc, 
              // donc pas besoin de setUser ici, mais on le laisse par sécurité.
              setUser(minimalUser as any);
              setIsAuthenticated(true);
            }
          } catch (err: any) {
            console.warn('Erreur dans onSnapshot (user)', err); // Message mis à jour
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
        }); // Fin du onSnapshot

      } else {
        setUser(null);
        setIsAuthenticated(false);
      }
    }); // Fin du onAuthStateChanged

    return () => {
      unsubscribeFromAuth();
      if (unsubscribeFromSnapshot) {
        unsubscribeFromSnapshot();
      }
    };
    // --- 2. FIN DE LA CORRECTION MAJEURE ---
  }, []);

  const login = async (email: string, password: string) => {
    try {
      // Le login ne change pas, car onAuthStateChanged s'occupe de charger les données
      await signInWithEmailAndPassword(auth, email, password);
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
      
      // --- CORRECTION : Utiliser updateDoc au lieu de setDoc(merge) ---
      // C'est plus propre pour les objets imbriqués comme 'daily'
      // setDoc(merge) peut écraser des sous-champs non spécifiés.
      await updateDoc(userRef, cleaned);

      // onSnapshot s'occupera de mettre à jour l'état local 'user'
      // On retire l'ancien 'setUser' manuel
      
      return;
    } catch (err) {
      console.warn('updateUser failed', err);
      throw err;
    }
  };

  const register = async (userData: Partial<User> & { password?: string }) => {
    // ... (Logique de register inchangée) ...
    // Note: onAuthStateChanged et onSnapshot géreront le setUser
    // (le code existant est OK)
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

      // (onSnapshot va maintenant gérer la mise à jour de l'état user)
      // setUser(newUser as any); // (Optionnel, car onSnapshot le fera)
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
          // (onAuthStateChanged gérera le setUser)
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
    // ... (code inchangé, updateDoc va déclencher onSnapshot) ...
    if (!auth.currentUser) return;
    const uid = auth.currentUser.uid;
    const userRef = doc(db, 'users', uid);
    try {
      await updateDoc(userRef, { isOnboardingComplete: true, updatedAt: serverTimestamp() } as any);
      // setUser(prev => prev ? ({ ...prev, isOnboardingComplete: true }) : prev); // (Retiré, onSnapshot gère)
    } catch (err: any) {
      console.warn('Impossible de mettre à jour onboarding sur Firestore (permissions) — update local seulement', err);
      setUser(prev => prev ? ({ ...prev, isOnboardingComplete: true }) : prev); // (On garde le fallback local)
    }
  };const logout = async () => {
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