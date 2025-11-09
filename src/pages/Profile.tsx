// src/pages/Profile.tsx

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { User, Scale, Target, LogOut, Save, Loader2 } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { StravaConnect } from '../components/StravaConnect';
import { useNavigate } from 'react-router-dom';

export const Profile = () => {
  const { user, updateUser, logout } = useAuth();
  const navigate = useNavigate();
  
  // États locaux pour le formulaire, initialisés à vide par défaut
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  
  // Infos physiques
  const [height, setHeight] = useState('');
  const [weight, setWeight] = useState('');
  
  // Objectifs
  const [targetWeight, setTargetWeight] = useState('');
  const [caloriesTarget, setCaloriesTarget] = useState('');
  const [proteinTarget, setProteinTarget] = useState('');

  const [isLoading, setIsLoading] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      setFirstName(user.firstName || '');
      setLastName(user.lastName || '');
      
      // --- DÉBUT DE LA CORRECTION (TypeScript) ---
      // On convertit les 'number' en 'string' avant de les setter
      setHeight(String(user.height || ''));
      setWeight(String(user.weight || ''));
      setTargetWeight(String((user as any)?.daily?.targetWeight || user.targetWeight || ''));
      setCaloriesTarget(String((user as any)?.daily?.caloriesTarget || ''));
      setProteinTarget(String((user as any)?.daily?.proteinTarget || ''));
      // --- FIN DE LA CORRECTION ---
    }
  }, [user]); // Se synchronise quand l'objet 'user' du contexte change


  const handleSaveProfile = async () => {
    setIsLoading(true);
    setSaveMessage(null);
    try {
      
      // On récupère l'objet 'daily' existant
      const existingDaily = (user as any)?.daily || {};
      
      const updatedData = {
        firstName,
        lastName,
        height: Number(height) || undefined,
        weight: Number(weight) || undefined,
        
        // On fusionne avec les nouvelles valeurs
        daily: { 
          ...existingDaily, // Préserve caloriesConsumed, strava, etc.
          targetWeight: Number(targetWeight) || undefined,
          caloriesTarget: Number(caloriesTarget) || undefined,
          proteinTarget: Number(proteinTarget) || undefined,
        },
        // On met aussi à jour le 'targetWeight' racine
        targetWeight: Number(targetWeight) || undefined,
      };
      
      await updateUser(updatedData); //
      setSaveMessage('Profil sauvegardé avec succès !');
    } catch (error) {
      console.error('Erreur sauvegarde profil:', error);
      setSaveMessage('Erreur lors de la sauvegarde.');
    } finally {
      setIsLoading(false);
      setTimeout(() => setSaveMessage(null), 3000);
    }
  };

  const handleLogout = async () => {
    setIsLoggingOut(true);
    try {
      await logout(); //
      navigate('/'); 
    } catch (error) {
      console.error('Erreur déconnexion:', error);
      setIsLoggingOut(false);
    }
  };

  if (!user) {
    return (
      <div className="p-6 pt-12 flex items-center justify-center">
        <Loader2 className="animate-spin text-primary-400" size={32} />
      </div>
    );
  }
  
  // Composant réutilisable pour les champs de formulaire
  const InputField = ({ label, icon: Icon, ...props }: any) => (
    <div>
      <label className="text-sm text-gray-400 mb-2 block">{label}</label>
      <div className="relative">
        <span className="absolute inset-y-0 left-0 flex items-center pl-3">
          <Icon size={18} className="text-gray-500" />
        </span>
        <input
          className="w-full bg-dark-700/50 border border-gray-700 rounded-xl py-3 pl-10 pr-4 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-primary-500"
          {...props}
        />
      </div>
    </div>
  );


  return (
    <div className="p-6 pt-12 pb-24">
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-8"
      >
        <h1 className="text-3xl font-bold text-white mb-2">
          Mon Profil
        </h1>
        <p className="text-gray-400">
          Gère tes informations et tes objectifs.
        </p>
      </motion.div>

      <div className="space-y-6">
        {/* Section Infos Personnelles */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-dark-800/50 backdrop-blur-sm rounded-2xl p-6 border border-gray-700/50"
        >
          <h3 className="text-xl font-bold text-white mb-4">Informations</h3>
          <div className="space-y-4">
            <InputField
              label="Prénom"
              icon={User}
              type="text"
              value={firstName}
              onChange={(e: any) => setFirstName(e.target.value)}
              placeholder="Ton prénom"
            />
            <InputField
              label="Nom"
              icon={User}
              type="text"
              value={lastName}
              onChange={(e: any) => setLastName(e.target.value)}
              placeholder="Ton nom"
            />
            <InputField
              label="Email"
              icon={User}
              type="email"
              value={user.email} // Toujours lire l'email direct du 'user'
              disabled
              readOnly
              className="w-full bg-dark-900/50 border border-gray-700 rounded-xl py-3 pl-10 pr-4 text-gray-400 cursor-not-allowed"
            />
          </div>
        </motion.div>

        {/* Section Objectifs et Métriques */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-dark-800/50 backdrop-blur-sm rounded-2xl p-6 border border-gray-700/50"
        >
          <h3 className="text-xl font-bold text-white mb-4">Objectifs & Métriques</h3>
          <div className="grid grid-cols-2 gap-4">
            <InputField
              label="Taille (cm)"
              icon={Scale}
              type="number"
              value={height}
              onChange={(e: any) => setHeight(e.target.value)}
              placeholder="180"
            />
            <InputField
              label="Poids (kg)"
              icon={Scale}
              type="number"
              value={weight}
              onChange={(e: any) => setWeight(e.target.value)}
              placeholder="75"
            />
            <InputField
              label="Poids Cible (kg)"
              icon={Target}
              type="number"
              value={targetWeight}
              onChange={(e: any) => setTargetWeight(e.target.value)}
              placeholder="70"
            />
            <InputField
              label="Calories (kcal)"
              icon={Target}
              type="number"
              value={caloriesTarget}
              onChange={(e: any) => setCaloriesTarget(e.target.value)}
              placeholder="2500"
            />
            <InputField
              label="Protéines (g)"
              icon={Target}
              type="number"
              value={proteinTarget}
              onChange={(e: any) => setProteinTarget(e.target.value)}
              placeholder="150"
            />
          </div>
        </motion.div>
        
        {/* Section Connexions */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.3 }}
          className="bg-dark-800/50 backdrop-blur-sm rounded-2xl p-6 border border-gray-700/50"
        >
          <h3 className="text-xl font-bold text-white mb-4">Connexions</h3>
          <StravaConnect />
        </motion.div>

        {/* Boutons d'action */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="space-y-4"
        >
          <button
            onClick={handleSaveProfile}
            disabled={isLoading}
            className="w-full bg-gradient-to-r from-primary-500 to-secondary-500 text-white font-bold py-3 px-4 rounded-2xl flex items-center justify-center space-x-2 transition-opacity duration-200 disabled:opacity-50"
          >
            {isLoading ? (
              <Loader2 size={20} className="animate-spin" />
            ) : (
              <Save size={20} />
            )}
            <span>Sauvegarder</span>
          </button>
          
          {saveMessage && (
            <p className="text-center text-sm text-green-400">{saveMessage}</p>
          )}

          <button
            onClick={handleLogout}
            disabled={isLoggingOut}
            className="w-full bg-dark-700/50 text-red-400 font-medium py-3 px-4 rounded-2xl flex items-center justify-center space-x-2 hover:bg-dark-700 transition-colors duration-200 disabled:opacity-50"
          >
            {isLoggingOut ? (
              <Loader2 size={20} className="animate-spin" />
            ) : (
              <LogOut size={20} />
            )}
            <span>Déconnexion</span>
          </button>
        </motion.div>
      </div>
    </div>
  );
};