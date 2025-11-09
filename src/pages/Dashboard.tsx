// src/pages/Dashboard.tsx

import { motion } from 'framer-motion';
import { Scale, Target, Utensils, Activity } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { CoachTip } from '../components/CoachTip';
import { StatsCard } from '../components/StatsCard';
import { KiviatChart } from '../components/KiviatChart';
import { useEffect, useState } from 'react';
import { collection, query, where, orderBy, getDocs } from 'firebase/firestore';
import { db } from '../lib/firebase';

export const Dashboard = () => {
  const { user } = useAuth();

  const [progressEntries, setProgressEntries] = useState<Array<any>>([]);

  useEffect(() => {
    if (!user) return;
    const fetchProgress = async () => {
      try {
        const q = query(
          collection(db, 'progress'),
          where('userId', '==', user.id),
          orderBy('date', 'desc')
        );
        const snap = await getDocs(q);
        const entries = snap.docs.map(d => {
          const data = d.data() as any;
          const date = data.date && data.date.toDate ? data.date.toDate() : data.date || null;
          return { id: d.id, ...data, date };
        });
        setProgressEntries(entries);
      } catch (err) {
        console.warn('Erreur fetch progress', err);
      }
    };
    fetchProgress();
  }, [user]);

  if (!user) return null;

  const latest = progressEntries[0] || {};
  const targetWeight = (user as any).targetWeight ?? undefined; // si non défini -> undefined
  const currentWeight = latest.weight ?? user.weight ?? undefined;
  const height = user.height ?? undefined;

// D'abord, on calcule l'IMC en tant que nombre (ou null)
const bmiNum = (currentWeight && height)
  ? (currentWeight / ((height / 100) ** 2))
  : null;

// Ensuite, on le formate pour l'affichage
const bmi = bmiNum ? bmiNum.toFixed(1) : '--';

const getBMIStatus = (bmiNum: number) => {
  if (bmiNum < 18.5) return { text: "sous-poids", emoji: "😴" };
  if (bmiNum < 25) return { text: "dans la zone athlète", emoji: "😎" };
  if (bmiNum < 30) return { text: "en surpoids", emoji: "💪" };
  return { text: "obèse", emoji: "🔥" };
};

// On utilise le 'bmiNum' (le nombre) pour obtenir le statut
const bmiStatus = bmiNum ? getBMIStatus(bmiNum) : { text: '', emoji: '' };

  // préparation des affichages avec fallback "--"
  const displayTarget = targetWeight !== undefined ? `${targetWeight} kg` : '--';
  const displayCurrent = currentWeight !== undefined ? `${currentWeight}` : '--';
  const diffText = (targetWeight !== undefined && currentWeight !== undefined)
    ? `Encore ${(currentWeight - targetWeight).toFixed(1)} kg 🎯`
    : '--';

  
  // --- DÉBUT DES MODIFICATIONS (Kiviat Dynamique) ---

  // Données 'daily'
  const daily = (user as any)?.daily ?? {};

  // Cibles
  const kcalTarget = daily.caloriesTarget ?? 0;
  const protTarget = daily.proteinTarget ?? 0;
  // On fixe un objectif "standard" de 400 kcal brûlées pour avoir 100%
  const activityTarget = 400; 

  // Données consommées
  const kcalConsumed = daily.caloriesConsumed ?? 0;
  const protConsumed = daily.proteinConsumed ?? 0;
  const activityConsumed = daily.stravaRecentCalories ?? 0;

  /**
   * Calcule un score de 0 à 100.
   * proximity = true (pour calories/protéines) : 100 = pile sur la cible. 
   * Plus on s'éloigne (au-dessus ou en-dessous), plus le score baisse.
   * proximity = false (pour activité) : 0 = 0 kcal, 100 = 400 kcal ou plus (plafonné).
   */
  const calculateScore = (consumed: number, target: number, proximity = true) => {
    if (target === 0) return 0; // Évite la division par zéro

    if (proximity) {
      // Logique de proximité (pour calories et protéines)
      const difference = Math.abs(target - consumed);
      const score = 100 - (difference / target) * 100;
      return Math.max(0, Math.round(score)); // Ne pas aller en dessous de 0
    } else {
      // Logique "d'atteinte" (pour l'activité)
      const score = (consumed / target) * 100;
      return Math.min(100, Math.round(score)); // Plafonner à 100
    }
  };

  // Calcul des scores
  const scoreCalories = calculateScore(kcalConsumed, kcalTarget, true);
  const scoreProteines = calculateScore(protConsumed, protTarget, true);
  const scoreActivite = calculateScore(activityConsumed, activityTarget, false);

  // Remplacer les données mockées par nos scores
  const kiviatData = [
    { subject: 'Calories', A: scoreCalories, fullMark: 100 },
    { subject: 'Protéines', A: scoreProteines, fullMark: 100 },
    { subject: 'Activité', A: scoreActivite, fullMark: 100 },
  ];

  // --- FIN DES MODIFICATIONS ---


  // Valeurs de repli si pas de données réelles -> maintenant '--' si absent
  const kcalTodayVal = daily.caloriesConsumed !== undefined ? daily.caloriesConsumed : undefined;
  const kcalTodayTarget = daily.caloriesTarget !== undefined ? daily.caloriesTarget : undefined;
  const kcalTodayDisplay = (kcalTodayVal !== undefined && kcalTodayTarget !== undefined)
    ? `${kcalTodayVal.toLocaleString('fr-FR')} / ${kcalTodayTarget.toLocaleString('fr-FR')} kcal`
    : (kcalTodayVal !== undefined ? `${kcalTodayVal.toLocaleString('fr-FR')} kcal` : '--');

  const kcalPercent = (kcalTodayVal !== undefined && kcalTodayTarget !== undefined)
    ? Math.round((kcalTodayVal / kcalTodayTarget) * 100)
    : null;
  const kcalBarWidth = kcalPercent !== null ? `${Math.min(Math.max(kcalPercent, 0), 100)}%` : '0%';
  const kcalSubtitle = kcalPercent !== null ? `${kcalPercent}% de l'objectif atteint` : '--';

  // MODIFIÉ: Lire les calories depuis Strava
  const activityVal = daily.stravaRecentCalories !== undefined ? daily.stravaRecentCalories : undefined;
  const activityDisplay = activityVal !== undefined ? `${activityVal.toLocaleString('fr-FR')} kcal` : '--';
  
  // MODIFIÉ: Afficher la date de synchro Strava si elle existe
  let activitySubtitle = 'Aucune synchro';
  if (daily.stravaLastSync) {
    try {
      // Formater la date en "JJ/MM"
      activitySubtitle = `Synchro: ${new Date(daily.stravaLastSync).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' })}`;
    } catch (e) {
      activitySubtitle = 'Synchro Strava'; // Fallback
    }
  }

  return (
    <div className="p-6 pt-12">
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-8"
      >
        <h1 className="text-3xl font-bold text-white mb-2">
          Salut {user.firstName || '!' } 👋
        </h1>
        <p className="text-gray-400">
          Voici ton tableau de bord du jour
        </p>
      </motion.div>

      <CoachTip />

      <div className="grid grid-cols-2 gap-4 mb-6">
        <StatsCard
          title="IMC Actuel"
          value={bmi}
          subtitle={bmi === '--' ? '--' : `t'es ${bmiStatus.text} ${bmiStatus.emoji}`}
          icon={<Scale size={24} className="text-white" />}
          gradient="from-primary-600 to-primary-700"
          delay={0.1}
        />
        
        <StatsCard
          title="Objectif"
          value={displayTarget}
          subtitle={diffText}
          icon={<Target size={24} className="text-white" />}
          gradient="from-secondary-600 to-secondary-700"
          delay={0.2}
        />
        
        <StatsCard
          title="Kcal Aujourd'hui"
          value={kcalTodayVal !== undefined ? (typeof kcalTodayVal === 'number' ? kcalTodayVal.toLocaleString('fr-FR') : kcalTodayVal) : '--'}
          subtitle={kcalSubtitle}
          icon={<Utensils size={24} className="text-white" />}
          gradient="from-accent-orange to-red-500"
          delay={0.3}
        />
        
        <StatsCard
          title="Activité"
          value={activityDisplay}
          subtitle={activityVal !== undefined ? (activitySubtitle || '--') : '--'}
          icon={<Activity size={24} className="text-white" />}
          gradient="from-accent-purple to-purple-600"
          delay={0.4}
        />
      </div>

      {/* Ce composant utilisera les 'kiviatData' dynamiques */}
      <KiviatChart data={kiviatData} />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.8, duration: 0.5 }}
        className="mt-6 bg-dark-800/50 backdrop-blur-sm rounded-2xl p-6 border border-green-500/30"
      >
        <h3 className="text-lg font-bold text-white mb-3">Statut du Jour</h3>
        <div className="space-y-3">
          <div className="flex justify-between items-center">
            <span className="text-gray-400">Calories consommées</span>
            <span className="text-primary-400 font-medium">{kcalTodayDisplay}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-gray-400">Protéines</span>
            <span className="text-primary-400 font-medium">
              {(daily.proteinConsumed !== undefined && daily.proteinTarget !== undefined)
                ? `${daily.proteinConsumed} / ${daily.proteinTarget}g`
                : '--'}
            </span>
          </div>
          <div className="bg-dark-700 rounded-full h-2 overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: kcalBarWidth }}
              transition={{ delay: 1, duration: 1 }}
              className="bg-gradient-to-r from-primary-500 to-secondary-500 h-full rounded-full"
            />
          </div>
          <p className="text-sm text-gray-400 mt-2">
            {kcalPercent !== null ? `T'es à ${kcalPercent}% de ton objectif — encore un yaourt grec et c'est plié 🍶` : "Données d'activité manquantes — commence à tracker pour voir tes progrès."}
          </p>
        </div>
      </motion.div>
    </div>
  );
};