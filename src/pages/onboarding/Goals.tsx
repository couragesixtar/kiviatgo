import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { ArrowRight, ArrowLeft, Target, MessageCircle, Info } from 'lucide-react';

interface GoalsProps {
  onNext: (data: { targetWeight?: number; caloriesTarget?: number; proteinTarget?: number }) => void;
  onBack: () => void;
  initialData?: any;
  onUpdate?: (data: any) => void;
}

export const Goals = ({ onNext, onBack, initialData, onUpdate }: GoalsProps) => {
  const [form, setForm] = useState({ targetWeight: '', caloriesTarget: '', proteinTarget: '' });
  const [isLoading, setIsLoading] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [aiSuggested, setAiSuggested] = useState(false);

  useEffect(() => {
    if (!initialData) return;
    setForm({
      targetWeight: initialData.targetWeight !== undefined ? String(initialData.targetWeight) : (initialData.targetWeight ? String(initialData.targetWeight) : ''),
      caloriesTarget: (initialData.daily && initialData.daily.caloriesTarget) !== undefined ? String(initialData.daily.caloriesTarget) : (initialData.caloriesTarget ? String(initialData.caloriesTarget) : ''),
      proteinTarget: (initialData.daily && initialData.daily.proteinTarget) !== undefined ? String(initialData.daily.proteinTarget) : (initialData.proteinTarget ? String(initialData.proteinTarget) : '')
    });
  }, [initialData]);

  const handleChange = (k: string, v: string) => {
    const next = { ...form, [k]: v };
    setForm(next);
    setAiSuggested(false);
    if (onUpdate) {
      const payload = {
        targetWeight: next.targetWeight ? parseFloat(next.targetWeight) : undefined,
        caloriesTarget: next.caloriesTarget ? parseFloat(next.caloriesTarget) : undefined,
        proteinTarget: next.proteinTarget ? parseFloat(next.proteinTarget) : undefined
      };
      onUpdate(payload);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    const payload = {
      targetWeight: form.targetWeight ? parseFloat(form.targetWeight) : undefined,
      caloriesTarget: form.caloriesTarget ? parseFloat(form.caloriesTarget) : undefined,
      proteinTarget: form.proteinTarget ? parseFloat(form.proteinTarget) : undefined,
    };
    setTimeout(() => {
      onNext(payload);
      setIsLoading(false);
    }, 300);
  };

  // heuristique de secours (simple, lisible)
  const fallbackSuggest = () => {
    const age = initialData?.age;
    const weight = initialData?.weight;
    const height = initialData?.height;
    const bodyFat = initialData?.bodyFat;
    // target weight: léger objectif en -2kg si surpoids, sinon +1 kg si maigre (très simple)
    let targetWeight: number | undefined = undefined;
    if (weight) {
      targetWeight = Math.round(weight - (bodyFat && bodyFat > 25 ? 2 : (bodyFat && bodyFat < 12 ? -1 : 0)));
    }
    // calories: estimation BMR * activité faible (1.2)
    let calories = undefined as number | undefined;
    if (weight && height && age) {
      const bmr = 10 * weight + 6.25 * height - 5 * age + 5; // approximatif, homme by défaut
      calories = Math.round(bmr * 1.2);
    } else if (weight) {
      calories = Math.round(weight * 30); // fallback
    }
    const protein = weight ? Math.round(weight * 1.6) : undefined;
    return { targetWeight, caloriesTarget: calories, proteinTarget: protein };
  };

  const extractNumbers = (text: string) => {
    const res: any = {};
    const n = (regex: RegExp) => {
      const m = text.match(regex);
      return m ? parseFloat(m[1].replace(',', '.')) : undefined;
    };
    res.targetWeight = n(/(?:poids cible|poids|target weight|goal weight)[^\d\-]*([0-9]+(?:[.,][0-9]+)?)/i) ?? n(/([0-9]+(?:[.,][0-9]+)?)\s?kg/i);
    res.caloriesTarget = n(/(?:calori(?:es|e)|kcal)[^\d\-]*([0-9]+(?:[.,][0-9]+)?)/i) ?? n(/([0-9]+(?:[.,][0-9]+)?)\s?kcal/i);
    res.proteinTarget = n(/(?:prot[eé]ines|protein)[^\d\-]*([0-9]+(?:[.,][0-9]+)?)/i);
    return res;
  };

  const handleAIGenerate = async () => {
    setAiError(null);
    setAiLoading(true);
    setAiSuggested(false);

    // build prompt from initialData
    const age = initialData?.age ?? 'inconnu';
    const weight = initialData?.weight ?? 'inconnu';
    const height = initialData?.height ?? 'inconnu';
    const bodyFat = initialData?.bodyFat ?? 'inconnu';
    const muscleMass = initialData?.muscleMass ?? 'inconnu';
    const boneMass = initialData?.boneMass ?? 'inconnu';

    const prompt = `En te basant sur ces données utilisateur: âge=${age} ans, poids=${weight} kg, taille=${height} cm, masse grasse=${bodyFat} %, masse musculaire=${muscleMass} kg, masse osseuse=${boneMass} kg. Propose trois valeurs: poids cible (kg), calories/jour (kcal), protéines cibles (g). Donne la réponse de façon concise: "Poids cible: XX kg\nCalories: YYYY kcal\nProtéines: ZZ g".`;

    try {
      // import dynamique pour ne pas casser le bundler si la lib n'est pas installée
      const mod = await import('@google/genai').catch(() => null);
      if (mod && (mod as any).GoogleGenAI) {
        const { GoogleGenAI } = mod as any;
        // read key depuis env si défini (préférable) — l'utilisateur peut définir VITE_GENAI_KEY
        const apiKey = (import.meta as any).env?.VITE_GENAI_KEY ?? undefined;
        const ai = new GoogleGenAI(apiKey ? { apiKey } : {});
        const response = await ai.models.generateContent({
          model: 'gemini-2.0-flash',
          contents: prompt,
        });
        // attempt to get text
        const text = response?.text ?? response?.output?.[0]?.content ?? String(response);
        const extracted = extractNumbers(text);
        const suggested = {
          targetWeight: extracted.targetWeight ?? undefined,
          caloriesTarget: extracted.caloriesTarget ?? undefined,
          proteinTarget: extracted.proteinTarget ?? undefined,
        };
        // if no useful extraction, fallback
        if (!suggested.targetWeight && !suggested.caloriesTarget && !suggested.proteinTarget) {
          const fb = fallbackSuggest();
          suggested.targetWeight = fb.targetWeight;
          suggested.caloriesTarget = fb.caloriesTarget;
          suggested.proteinTarget = fb.proteinTarget;
        }
        // apply suggestions to form
        const next = {
          targetWeight: suggested.targetWeight ? String(suggested.targetWeight) : form.targetWeight,
          caloriesTarget: suggested.caloriesTarget ? String(suggested.caloriesTarget) : form.caloriesTarget,
          proteinTarget: suggested.proteinTarget ? String(suggested.proteinTarget) : form.proteinTarget
        };
        setForm(next);
        setAiSuggested(true);
        if (onUpdate) {
          onUpdate({
            targetWeight: suggested.targetWeight,
            caloriesTarget: suggested.caloriesTarget,
            proteinTarget: suggested.proteinTarget
          });
        }
      } else {
        // lib non dispo -> fallback heuristique
        const fb = fallbackSuggest();
        const next = {
          targetWeight: fb.targetWeight ? String(fb.targetWeight) : form.targetWeight,
          caloriesTarget: fb.caloriesTarget ? String(fb.caloriesTarget) : form.caloriesTarget,
          proteinTarget: fb.proteinTarget ? String(fb.proteinTarget) : form.proteinTarget
        };
        setForm(next);
        setAiSuggested(true);
        if (onUpdate) onUpdate({ targetWeight: fb.targetWeight, caloriesTarget: fb.caloriesTarget, proteinTarget: fb.proteinTarget });
      }
    } catch (err: any) {
      console.warn('AI suggestion failed', err);
      setAiError('Impossible de générer un objectif conseillé — utilisation d\'une estimation locale.');
      const fb = fallbackSuggest();
      const next = {
        targetWeight: fb.targetWeight ? String(fb.targetWeight) : form.targetWeight,
        caloriesTarget: fb.caloriesTarget ? String(fb.caloriesTarget) : form.caloriesTarget,
        proteinTarget: fb.proteinTarget ? String(fb.proteinTarget) : form.proteinTarget
      };
      setForm(next);
      setAiSuggested(true);
      if (onUpdate) onUpdate({ targetWeight: fb.targetWeight, caloriesTarget: fb.caloriesTarget, proteinTarget: fb.proteinTarget });
    } finally {
      setAiLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-dark-900 via-dark-800 to-dark-700 flex items-center justify-center p-6">
      <motion.div initial={{ opacity: 0, x: 100 }} animate={{ opacity: 1, x: 0 }} className="w-full max-w-md">
        <div className="text-center mb-4">
          <div className="text-6xl mb-4">🎯</div>
          <h1 className="text-3xl font-bold text-white mb-2">Fixe tes objectifs</h1>
          <p className="text-gray-400">Poids cible, calories journalières et protéines</p>
        </div>

        {/* AI action row */}
        <div className="flex items-center justify-between mb-4 space-x-3">
          <div className="text-sm text-gray-300 flex items-center space-x-2">
            <Info size={16} className="text-gray-400" />
            <span>Besoin d'aide ? Génère un objectif conseillé automatiquement.</span>
          </div>

          <div className="flex items-center space-x-2">
            <button
              type="button"
              onClick={handleAIGenerate}
              disabled={aiLoading}
              className="px-3 py-2 bg-dark-700/60 hover:bg-dark-700 rounded-xl text-sm text-white flex items-center space-x-2"
            >
              <Target size={16} />
              <span>{aiLoading ? 'Génération...' : 'Objectif conseillé'}</span>
            </button>
          </div>
        </div>

        {aiSuggested && (
          <div className="mb-4 text-xs text-gray-300 flex items-center space-x-2">
            <Info size={14} className="text-primary-400" />
            <span>Pré‑rempli automatiquement (modifiable). Ces valeurs sont une estimation basée sur tes informations.</span>
          </div>
        )}

        {aiError && (
          <div className="mb-4 text-xs text-yellow-300">
            {aiError}
          </div>
        )}

        <motion.form onSubmit={handleSubmit} className="space-y-4">
          <div className="relative">
            <input
              type="number"
              step="0.1"
              value={form.targetWeight}
              onChange={(e) => handleChange('targetWeight', e.target.value)}
              placeholder="Poids cible (kg)"
              className="w-full bg-dark-800/50 border border-gray-600/30 rounded-2xl pl-4 pr-4 py-4 text-white placeholder-gray-400 focus:border-primary-500 focus:outline-none transition-colors"
            />
          </div>

          <div className="relative">
            <input
              type="number"
              value={form.caloriesTarget}
              onChange={(e) => handleChange('caloriesTarget', e.target.value)}
              placeholder="Objectif calories/jour (kcal)"
              className="w-full bg-dark-800/50 border border-gray-600/30 rounded-2xl pl-4 pr-4 py-4 text-white placeholder-gray-400 focus:border-primary-500 focus:outline-none transition-colors"
            />
          </div>

          <div className="relative">
            <input
              type="number"
              value={form.proteinTarget}
              onChange={(e) => handleChange('proteinTarget', e.target.value)}
              placeholder="Protéines cible (g)"
              className="w-full bg-dark-800/50 border border-gray-600/30 rounded-2xl pl-4 pr-4 py-4 text-white placeholder-gray-400 focus:border-primary-500 focus:outline-none transition-colors"
            />
          </div>

          <div className="flex space-x-4 mt-4">
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              type="button"
              onClick={onBack}
              className="flex-1 bg-dark-700 text-white font-bold py-4 rounded-2xl flex items-center justify-center space-x-2"
            >
              <ArrowLeft size={20} />
              <span>Retour</span>
            </motion.button>

            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              type="submit"
              className="flex-1 bg-gradient-to-r from-primary-500 to-secondary-500 text-white font-bold py-4 rounded-2xl flex items-center justify-center space-x-2"
              disabled={isLoading}
            >
              <span>{isLoading ? 'Enregistrement...' : 'Suivant'}</span>
              <ArrowRight size={20} />
            </motion.button>
          </div>
        </motion.form>

        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.6 }} className="text-center mt-6">
          <div className="flex justify-center space-x-2">
            <div className="w-3 h-3 bg-gray-600 rounded-full"></div>
            <div className="w-3 h-3 bg-gray-600 rounded-full"></div>
            <div className="w-3 h-3 bg-primary-500 rounded-full"></div>
            <div className="w-3 h-3 bg-gray-600 rounded-full"></div>
            <div className="w-3 h-3 bg-gray-600 rounded-full"></div>
          </div>
        </motion.div>
      </motion.div>
    </div>
  );
};