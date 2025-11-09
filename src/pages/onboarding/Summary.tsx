import { motion } from 'framer-motion';
import { Rocket, User, Scale, Target } from 'lucide-react';

// CORRECTION: Interface mise à jour pour inclure 'daily' et les champs d'objectifs
interface SummaryProps {
  userData: {
    firstName: string;
    lastName: string;
    email: string;
    height?: number;
    weight?: number;
    bodyFat?: number;
    muscleMass?: number;
    boneMass?: number;
    // Ajout des champs d'objectifs (y compris l'objet 'daily')
    targetWeight?: number;
    caloriesTarget?: number;
    proteinTarget?: number;
    daily?: {
      caloriesTarget?: number;
      proteinTarget?: number;
      targetWeight?: number;
    };
  };
  onComplete: () => void;
}

export const Summary = ({ userData, onComplete }: SummaryProps) => {
  const bmi = userData.height && userData.weight
    ? (userData.weight / ((userData.height / 100) ** 2)).toFixed(1)
    : null;

  // CORRECTION: Logique mise à jour pour chercher 'targetWeight' dans 'daily' en premier
  const goalsTargetWeight = userData?.daily?.targetWeight ?? userData?.targetWeight ?? '--';
  const goalsCalories = userData?.daily?.caloriesTarget ?? userData?.caloriesTarget ?? '--';
  const goalsProtein = userData?.daily?.proteinTarget ?? userData?.proteinTarget ?? '--';

  return (
    <div className="min-h-screen bg-gradient-to-br from-dark-900 via-dark-800 to-dark-700 flex items-center justify-center p-6">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-md"
      >
        <div className="text-center mb-8">
          <motion.div
            initial={{ scale: 0, rotate: -180 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ delay: 0.2, type: "spring", bounce: 0.6 }}
            className="text-6xl mb-4"
          >
            🎉
          </motion.div>
          <h1 className="text-3xl font-bold text-white mb-2">
            Parfait ! Tout est prêt
          </h1>
          <p className="text-gray-400">
            On commence ton parcours ?
          </p>
        </div>

        {/* --- NOUVEAU: Goals summary card (au-dessus des autres résumés) --- */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.25 }}
          className="bg-dark-800/50 backdrop-blur-sm rounded-2xl p-4 border border-primary-500/20 mb-4"
        >
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center space-x-3">
              <Target size={20} className="text-primary-400" />
              <div>
                <p className="text-white font-medium">Objectifs définis</p>
                <p className="text-gray-400 text-sm">Pré‑rempli en fonction de tes infos (modifiable)</p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3 mt-3">
            <div className="bg-dark-700/50 rounded-xl p-3 text-center">
              <p className="text-gray-400 text-xs">Poids cible</p>
              {/* CORRECTION: Vérification de la valeur '--' plutôt que 'undefined' */}
              <p className="text-white font-bold">{goalsTargetWeight !== '--' ? `${goalsTargetWeight} kg` : '--'}</p>
            </div>
            <div className="bg-dark-700/50 rounded-xl p-3 text-center">
              <p className="text-gray-400 text-xs">Calories / jour</p>
              <p className="text-white font-bold">{goalsCalories !== '--' ? `${goalsCalories} kcal` : '--'}</p>
            </div>
            <div className="bg-dark-700/50 rounded-xl p-3 text-center">
              <p className="text-gray-400 text-xs">Protéines</p>
              <p className="text-white font-bold">{goalsProtein !== '--' ? `${goalsProtein} g` : '--'}</p>
            </div>
          </div>
        </motion.div>

        {/* Summary Cards */}
        <div className="space-y-4 mb-8">
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.3 }}
            className="bg-dark-800/50 backdrop-blur-sm rounded-2xl p-4 border border-primary-500/30"
          >
            <div className="flex items-center space-x-3">
              <User size={20} className="text-primary-400" />
              <div>
                <p className="text-white font-medium">
                  {userData.firstName} {userData.lastName}
                </p>
                <p className="text-gray-400 text-sm">{userData.email}</p>
              </div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.4 }}
            className="bg-dark-800/50 backdrop-blur-sm rounded-2xl p-4 border border-secondary-500/30"
          >
            <div className="flex items-center space-x-3">
              <Scale size={20} className="text-secondary-400" />
              <div>
                <p className="text-white font-medium">
                  {userData.height} cm • {userData.weight} kg
                </p>
                <p className="text-gray-400 text-sm">
                  {bmi && `IMC: ${bmi}`}
                  {userData.bodyFat && ` • ${userData.bodyFat}% masse grasse`}
                </p>
              </div>
            </div>
          </motion.div>

          {/* --- CALIBRATION CARD : removed --- */}

        </div>

        {/* Motivational Message */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
          className="bg-gradient-to-r from-primary-500/20 to-secondary-500/20 backdrop-blur-sm rounded-2xl p-6 mb-8 border border-primary-500/30"
        >
          <div className="text-center">
            <h3 className="text-white font-bold text-lg mb-2">
              Prêt pour l'aventure ! 🦋
            </h3>
            <p className="text-gray-300 text-sm">
              Ton profil est configuré. Il est temps de commencer à tracker tes repas et voir tes progrès !
            </p>
          </div>
        </motion.div>

        <motion.button
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.7 }}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={onComplete}
          className="w-full bg-gradient-to-r from-primary-500 to-secondary-500 text-white font-bold py-4 rounded-2xl flex items-center justify-center space-x-2"
        >
          <span>C'est parti</span>
          <Rocket size={20} />
        </motion.button>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.8 }}
          className="text-center mt-6"
        >
          <div className="flex justify-center space-x-2">
            <div className="w-3 h-3 bg-gray-600 rounded-full"></div>
            <div className="w-3 h-3 bg-gray-600 rounded-full"></div>
            <div className="w-3 h-3 bg-gray-600 rounded-full"></div>
            <div className="w-3 h-3 bg-gray-600 rounded-full"></div>
            <div className="w-3 h-3 bg-primary-500 rounded-full"></div>
          </div>
        </motion.div>

      </motion.div>
    </div>
  );
};