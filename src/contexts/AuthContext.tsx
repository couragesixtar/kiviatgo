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
  onSnapshot,
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
  stravaRefreshToken?: string; // <-- CHAMP AJOUTÉ
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
  syncStrava: () => Promise<void>; // <-- AJOUTÉ
  isSyncingStrava: boolean; // <-- AJOUTÉ
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
  const [isSyncingStrava, setIsSyncingStrava] = useState(false); // <-- ÉTAT AJOUTÉ

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

  // UNIQUE implémentation de updateUser
  const updateUser = async (patch: any) => {
    if (!auth.currentUser) {
      throw new Error('Utilisateur non authentifié');
    }
    const uid = auth.currentUser.uid;
    const userRef = doc(db, 'users', uid);
    try {
      const cleaned = removeUndefined(patch);
      cleaned.updatedAt = serverTimestamp();
      
      // Utiliser updateDoc pour fusionner correctement les objets imbriqués
      await updateDoc(userRef, cleaned);
      // onSnapshot s'occupera de mettre à jour l'état local 'user'

    } catch (err) {
      console.warn('updateUser failed', err);
      throw err;
    }
  };

  // --- NOUVELLE FONCTION DE SYNCHRO ---
  // On lui passe 'existingUser' pour la synchro auto au démarrage,
  // sinon elle utilise le 'user' de l'état (pour le bouton manuel)
  const syncStrava = async (existingUser?: User | null) => {
    const currentUser = existingUser || user;
    if (isSyncingStrava || !currentUser) return;

    const currentRefreshToken = (currentUser as any)?.daily?.stravaRefreshToken;
    if (!currentRefreshToken) {
      console.log('Sync Strava: Pas de refresh token. Arrêt.');
      return;
    }

    console.log('Sync Strava: Démarrage de la synchronisation...');
    setIsSyncingStrava(true);
    try {
      const response = await fetch('/.netlify/functions/strava-token-exchange', {
        method: 'POST',
        body: JSON.stringify({ refreshToken: currentRefreshToken }), // On envoie le refresh token
      });

      if (!response.ok) {
        const errorData = await response.json();
        // Si le refresh token est invalide (ex: révoqué par l'utilisateur), on le supprime
        if (response.status === 400 && errorData.error.includes('refresh token')) {
          console.warn('Refresh token Strava invalide. Suppression du token.');
          await updateUser({ daily: { stravaRefreshToken: undefined } } as any);
        }
        throw new Error(`Échec du rafraîchissement du token Strava: ${errorData.error}`);
      }

      const data = await response.json();
      const { totalCalories, lastSync, refreshToken: newRefreshToken } = data;

      // On met à jour le profil avec les nouvelles données ET le nouveau token
      await updateUser({
        daily: {
          stravaRecentCalories: totalCalories,
          stravaLastSync: lastSync,
          stravaRefreshToken: newRefreshToken, // IMPORTANT: On sauvegarde le nouveau token
        },
      } as any);
      console.log('Sync Strava: Synchronisation réussie.');

    } catch (err) {
      console.error('Erreur syncStrava:', err);
    } finally {
      setIsSyncingStrava(false);
    }
  };

  useEffect(() => {
    let unsubscribeFromSnapshot: (() => void) | null = null;

    const unsubscribeFromAuth = onAuthStateChanged(auth, (fbUser: FirebaseUser | null) => {
      
      if (unsubscribeFromSnapshot) {
        unsubscribeFromSnapshot();
        unsubscribeFromSnapshot = null;
      }

      if (fbUser) {
        const uid = fbUser.uid;
        const userRef = doc(db, 'users', uid);

        unsubscribeFromSnapshot = onSnapshot(userRef, async (snap) => {
          try {
            if (snap.exists()) {
              const data = snap.data() as any;
              const today = new Date().toISOString().slice(0, 10);
              const daily = data.daily ?? {};
              const lastReset = daily.lastResetDate ?? null;

              if (lastReset !== today) {
                // --- CORRECTION DU BUG DE RESET ---
                const existingDaily = data.daily ?? {}; // Récupère l'existant
                
                const mergedDaily = {
                  ...existingDaily, // Garde (caloriesTarget, proteinTarget, strava...)
                  caloriesConsumed: 0, // Réinitialise seulement ce qui est nécessaire
                  proteinConsumed: 0,
                  photosCount: 0,
                  photosDate: today,
                  lastResetDate: today
                };
                // --- FIN CORRECTION ---

                try {
                  await updateDoc(userRef, { daily: mergedDaily, updatedAt: serverTimestamp() });
                  data.daily = mergedDaily; 
                } catch (err) {
                  console.warn('Impossible d\'appliquer reset daily', err);
                  data.daily = daily; // Fallback
                }
              } else {
                // s'assurer que fields existent
                data.daily = {
                  photosCount: daily.photosCount ?? 0,
                  photosDate: daily.photosDate ?? today,
                  caloriesConsumed: daily.caloriesConsumed ?? 0,
                  proteinConsumed: daily.proteinConsumed ?? 0,
                  lastResetDate: daily.lastResetDate ?? today,
                  ...daily // Garde le reste (targets, token strava...)
                };
              }

              // --- LOGIQUE DE SYNCHRO AUTOMATIQUE (1x par jour) ---
              const stravaToken = data.daily?.stravaRefreshToken;
              
              if (stravaToken && !isSyncingStrava) { // Ne pas lancer si déjà en cours
                const lastSync = data.daily?.stravaLastSync;
                let lastSyncDate = '1970-01-01'; 
                if (lastSync) {
                  try {
                    lastSyncDate = new Date(lastSync).toISOString().slice(0, 10);
                  } catch(e) { /* ignore invalid date */ }
                }

                // Si la dernière synchro n'est pas d'aujourd'hui
                if (lastSyncDate !== today) {
                  console.log('Synchro Strava automatique (quotidienne) démarrée...');
                  // On passe 'data' pour que syncStrava ait le token le plus récent
                  const userForSync = { ...data, id: uid } as User;
                  syncStrava(userForSync); // Ne pas "await"
                }
              }
              // --- FIN DE LA LOGIQUE DE SYNCHRO AUTO ---

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
              // ... (Logique "Pas de doc Firestore" inchangée)
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
            console.warn('Erreur dans onSnapshot (user)', err);
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
  }, []); // <-- Le tableau de dépendances vide est crucial

  const login = async (email: string, password: string) => {
    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch (error: any) {
      throw error;
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

      setIsAuthenticated(true);
    } catch (error: any) {
      const code = error?.code || '';

      if (code === 'auth/email-already-in-use') {
        try {
          await signInWithEmailAndPassword(auth, email, password);
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
        createProgress,
        syncStrava, // <-- EXPOSÉ
        isSyncingStrava, // <-- EXPOSÉ
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};