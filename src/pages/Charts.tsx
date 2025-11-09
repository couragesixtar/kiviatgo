import { motion } from 'framer-motion';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { TrendingDown, Target, Calendar } from 'lucide-react';
import { CoachTip } from '../components/CoachTip';
import { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../lib/firebase';

export const Charts = () => {
  const { user } = useAuth();
  const [progressData, setProgressData] = useState<Array<any>>([]);

  useEffect(() => {
    if (!user) return;
    const fetchProgress = async () => {
      try {
        // MODIFIÉ: On enlève orderBy('date', 'asc') pour éviter le bug d'index Firestore
        const q = query(
          collection(db, 'progress'),
          where('userId', '==', user.id)
        );
        const snap = await getDocs(q);

        // MODIFIÉ: On trie les résultats manuellement dans le code
        const docs = snap.docs.map(d => d.data() as any);
        docs.sort((a: any, b: any) => {
          const dateA = a.date?.toDate ? a.date.toDate().getTime() : (a.date || 0);
          const dateB = b.date?.toDate ? b.date.toDate().getTime() : (b.date || 0);
          return dateA - dateB; // Tri ascendant
        });

        const entries = docs.map(data => {
          // MODIFICATION: Gérer tous les types de dates (Timestamp, String, ou Nul)
          let dateObj: Date | null = null;
          if (data.date) {
            if (data.date.toDate) { // Cas 1: C'est un Timestamp Firestore
              dateObj = data.date.toDate();
            } else { // Cas 2: C'est une chaîne de texte ou un nombre
              dateObj = new Date(data.date);
            }
          }

          // Vérifier que la date est valide avant d'appeler .getDate()
          const formattedDate = (dateObj && !isNaN(dateObj.getTime()))
            ? `${String(dateObj.getDate()).padStart(2, '0')}/${String(dateObj.getMonth() + 1).padStart(2, '0')}`
            : '';
          return {
            date: formattedDate,
            weight: data.weight,
            bodyFat: data.bodyFat,
            muscle: data.muscleMass || data.muscle
          };
        });
        setProgressData(entries);
      } catch (err) {
        console.warn('Erreur fetch progress', err);
      }
    };
    fetchProgress();
  }, [user]);

  // --- CHANGED: compute target and current with fallbacks to '--' ---
  const targetWeight = (user as any)?.targetWeight ?? undefined;
  // use last progress entry as "actuel" if available (progressData ordered asc)
  const lastEntry = progressData.length ? progressData[progressData.length - 1] : undefined;
  const currentWeightVal = lastEntry?.weight ?? user?.weight ?? undefined;

  const displayTarget = targetWeight !== undefined ? `${targetWeight} kg` : '--';
  const displayCurrent = currentWeightVal !== undefined ? `${currentWeightVal} kg` : '--';
  // --- end changes ---

  // fallback mock if no data (but we still use displayTarget/displayCurrent for cards)
  const displayData = progressData.length ? progressData : [
    { date: '29/12', weight: user?.weight ?? undefined, bodyFat: user?.bodyFat ?? undefined, muscle: user?.muscleMass ?? undefined }
  ];

  return (
    <div className="p-6 pt-12">
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-8"
      >
        <h1 className="text-3xl font-bold text-white mb-2">
          Graphiques 📈
        </h1>
        <p className="text-gray-400">
          Visualise ton évolution physique
        </p>
      </motion.div>

      <CoachTip />

      {/* Progress Cards */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-gradient-to-r from-primary-600 to-primary-700 rounded-2xl p-4 border border-primary-500/30"
        >
          <div className="flex items-center space-x-2 mb-2">
            <Target size={20} className="text-white" />
            <span className="text-white/80 text-sm">Objectif</span>
          </div>
          <p className="text-white text-lg font-bold">{displayTarget}</p>
          <p className="text-white/70 text-xs">Actuel: {displayCurrent} 👀</p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="bg-gradient-to-r from-secondary-600 to-secondary-700 rounded-2xl p-4 border border-secondary-500/30"
        >
          <div className="flex items-center space-x-2 mb-2">
            <TrendingDown size={20} className="text-white" />
            <span className="text-white/80 text-sm">Progrès</span>
          </div>
          <p className="text-white text-lg font-bold">
            {displayCurrent}
          </p>
          <p className="text-white/70 text-xs">Dernière entrée</p>
        </motion.div>
      </div>

      {/* Main Chart */}
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.4 }}
        className="bg-dark-800/50 backdrop-blur-sm rounded-2xl p-6 border border-primary-500/30 mb-6"
      >
        <h3 className="text-xl font-bold text-white mb-4">Évolution Physique</h3>

        <div className="h-80">
          <ResponsiveContainer width="100%" height={320}>
            <LineChart data={displayData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis
                dataKey="date"
                stroke="#9ca3af"
                fontSize={12}
              />
              <YAxis
                stroke="#9ca3af"
                fontSize={12}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#1f2937',
                  border: '1px solid #374151',
                  borderRadius: '12px',
                  color: '#fff'
                }}
              />
              <Line
                type="monotone"
                dataKey="weight"
                stroke="#10b981"
                strokeWidth={3}
                dot={{ fill: '#10b981', strokeWidth: 2, r: 6 }}
                name="Poids (kg)"
              />
              <Line
                type="monotone"
                dataKey="bodyFat"
                stroke="#f97316"
                strokeWidth={3}
                dot={{ fill: '#f97316', strokeWidth: 2, r: 6 }}
                name="Masse grasse (%)"
              />
              <Line
                type="monotone"
                dataKey="muscle"
                stroke="#3b82f6"
                strokeWidth={3}
                dot={{ fill: '#3b82f6', strokeWidth: 2, r: 6 }}
                name="Masse musculaire (kg)"
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </motion.div>

      {/* Weight History */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.6 }}
        className="bg-dark-800/50 backdrop-blur-sm rounded-2xl p-6 border border-gray-600/30"
      >
        <h3 className="text-lg font-bold text-white mb-4">Historique des Pesées</h3>

        <div className="space-y-3">
          {(displayData as any[]).slice(-5).reverse().map((entry, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.1 * (index + 7) }}
              className="flex items-center justify-between p-3 bg-dark-700/50 rounded-lg"
            >
              <div className="flex items-center space-x-3">
                <Calendar size={16} className="text-gray-400" />
                <div>
                  <p className="text-white font-medium">{entry.weight} kg</p>
                  <p className="text-gray-400 text-sm">{entry.date}</p>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </motion.div>
    </div>
  );
};