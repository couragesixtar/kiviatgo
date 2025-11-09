import { motion } from 'framer-motion';
// MODIFIÉ (Req 5): Ajout de 'MessageCircle'
import { Camera, Plus, Clock, Trash2, List, Zap, MessageCircle } from 'lucide-react';
import { CoachTip } from '../components/CoachTip';
import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { db } from '../lib/firebase';
import { 
  collection, 
  addDoc, 
  serverTimestamp, 
  getDoc, 
  deleteDoc, 
  doc, 
  query, 
  where, 
  orderBy, 
  onSnapshot,
  updateDoc // <--- Assure-toi que c'est bien importé
} from 'firebase/firestore';

// util: fetch image URL and return base64 (browser-safe)
async function fetchUrlAsBase64(url: string): Promise<{ mimeType: string; base64: string }> {
  // ... (code inchangé)
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Impossible de télécharger l'image (${res.status})`);
  const contentType = res.headers.get('content-type') || 'image/jpeg';
  const arrayBuffer = await res.arrayBuffer();
  let binary = '';
  const bytes = new Uint8Array(arrayBuffer);
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const sub = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode.apply(null, Array.from(sub));
  }
  const base64 = btoa(binary);
  return { mimeType: contentType, base64 };
}

export const Meals = () => {
  const { user, updateUser } = useAuth();
  if (!user) return null;

  // --- NOUVEAU: identifiant utilisateur résilient (id ou uid)
  const userId = (user as any)?.id ?? (user as any)?.uid ?? null;

  const DAILY_LIMIT = 15;

  // helper: get today's photos count from user.daily (persisted in Firestore)
  const getTodayCount = () => {
    // ... (code inchangé)
    const daily = (user as any)?.daily ?? {};
    const today = new Date().toISOString().slice(0, 10);
    if (daily.photosDate !== today) return 0;
    return Number(daily.photosCount ?? 0);
  };

  // --- UNIQ : openAnalyzeModal (une seule définition, plus d'erreur duplicate) ---
  const [detectedFoods, setDetectedFoods] = useState<Array<any> | null>(null);
  const [mealSaving, setMealSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  // --- NOUVEAUX: meals depuis Firestore + pagination simple (3 par défaut) ---
  const [meals, setMeals] = useState<Array<any>>([]);
  const [showAll, setShowAll] = useState(false);

  // --- NOUVEAUX états pour heure & type du repas détecté ---
  const [analysisTime, setAnalysisTime] = useState<string | null>(null);
  const [detectedMealType, setDetectedMealType] = useState<string | null>(null);

  // --- NOUVEAU: création manuelle de plateau ---
  const [createPlateOpen, setCreatePlateOpen] = useState(false);
  const [plateItems, setPlateItems] = useState<Array<{ id: number; name: string }>>([]);
  const [plateSuggestions, setPlateSuggestions] = useState<Array<any> | null>(null);
  const [isSuggesting, setIsSuggesting] = useState(false);
  const [plateError, setPlateError] = useState<string | null>(null);

  // --- NOUVEAU (Req 5): états pour le chat coach ---
  const [coachChatOpen, setCoachChatOpen] = useState(false);
  const [chatMessages, setChatMessages] = useState<Array<{ sender: 'user' | 'ai', text: string }>>([]);
  const [chatInput, setChatInput] = useState('');
  const [isChatting, setIsChatting] = useState(false);
  const [suggestedMeal, setSuggestedMeal] = useState<any | null>(null); // Pour stocker le repas suggéré

  // --- MODAL STATES ---
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [uploadUrl, setUploadUrl] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [aiResult, setAiResult] = useState<string | null>(null);
  const [modalError, setModalError] = useState<string | null>(null);
  
  // --- NOUVEAUX ÉTATS POUR LE MODAL D'ÉDITION ---
  const [editModalOpen, setEditModalOpen] = useState<any | null>(null);
  const [editedFoods, setEditedFoods] = useState<Array<any>>([]);
  const [editTotals, setEditTotals] = useState({ calories: 0, protein: 0 });

  const openAnalyzeModal = () => {
    // ... (code inchangé)
    setModalError(null);
    const cnt = getTodayCount();
    if (cnt >= DAILY_LIMIT) {
      setModalError(`Limite de ${DAILY_LIMIT} photos atteinte aujourd'hui.`);
      return;
    }
    setUploadUrl(null);
    setAiResult(null);
    setDetectedFoods(null);
    setIsModalOpen(true);
  };

  const closeModal = () => {
    // ... (code inchangé)
    setIsModalOpen(false);
    setUploadUrl(null);
    setAiResult(null);
    setModalError(null);
  };

  const handleUploadToUploadcare = async (e: React.ChangeEvent<HTMLInputElement>) => {
    // ... (code inchangé)
    const file = e.target.files?.[0];
    if (!file) return;
    setModalError(null);
    setIsUploading(true);
    try {
      const apiKey = (import.meta as any).env?.VITE_IMGBB_KEY ?? '7d609caa0a6667338f1bcbb8bcc5df90';
      const formData = new FormData();
      formData.append('image', file);

      const res = await fetch(`https://api.imgbb.com/1/upload?key=${encodeURIComponent(apiKey)}`, {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) {
        const bodyText = await res.text().catch(() => '');
        throw new Error(`ImgBB error ${res.status}. Vérifie VITE_IMGBB_KEY. Réponse: ${bodyText.slice(0, 300)}`);
      }

      const json = await res.json().catch(async () => {
        const bodyText = await res.text().catch(() => '');
        throw new Error(`Réponse inattendue d'ImgBB (non JSON). ${bodyText.slice(0,300)}`);
      });

      if (!json || !json.success) {
        throw new Error(`ImgBB réponse invalide. Vérifie la clé API et la taille du fichier.`);
      }

      const url = json?.data?.url || json?.data?.display_url || json?.data?.image?.url;
      if (!url) throw new Error('Impossible d\'extraire le lien image depuis la réponse ImgBB.');

      setUploadUrl(url);
    } catch (err: any) {
      console.warn('Upload failed', err);
      setModalError(
        err?.message ??
        'Échec de l\'upload. Vérifie la clé API ImgBB (VITE_IMGBB_KEY) et réessaie.'
      );
    } finally {
      setIsUploading(false);
    }
  };

  const computeTotals = (foods: any[]) => {
    // ... (code inchangé)
    let calories = 0, protein = 0, carbs = 0, fat = 0;
    foods.forEach(f => {
      calories += Number(f.calories ?? 0);
      protein += Number(f.protein ?? 0);
      carbs += Number(f.carbs ?? 0);
      fat += Number(f.fat ?? 0);
    });
    return { calories: Math.round(calories), protein: Math.round(protein), carbs: Math.round(carbs), fat: Math.round(fat) };
  };

  // helper: detect meal type by hour
  const detectMealTypeFromHour = (hour: number) => {
    // ... (code inchangé)
    if (hour >= 5 && hour < 10) return 'Petit-déjeuner';
    if (hour >= 10 && hour < 15) return 'Déjeuner';
    if (hour >= 15 && hour < 18) return 'Collation';
    if (hour >= 18 && hour < 23) return 'Dîner';
    return 'Collation';
  };

  // --- NOUVEAUX helpers pour persistance & quotas côté serveur ---
  const getTodayStr = () => new Date().toISOString().slice(0, 10);

  // incrémente photosCount dans user.daily (persisté via updateUser) et retourne la nouvelle valeur
  const incrementPhotoCountOnUser = async () => {
    // ... (code inchangé)
    try {
      const today = getTodayStr();
      const daily = (user as any)?.daily ?? {};
      const current = daily.photosDate === today ? Number(daily.photosCount ?? 0) : 0;
      const next = current + 1;
      await updateUser({ daily: { photosCount: next, photosDate: today } } as any);
      return next;
    } catch (err) {
      console.warn('Impossible d\'incrémenter photosCount', err);
      return Number((user as any)?.daily?.photosCount ?? 0);
    }
  };

  // Sauvegarde des detected foods dans Firestore + mise à jour des totaux user.daily
  const saveDetectedFoods = async (foods: any[], opts?: { time?: string; type?: string; beforePhoto?: string }) => {
    // ... (code inchangé)
    if (!foods || !foods.length) return;
    try {
      const totals = computeTotals(foods);
      const time = opts?.time ?? new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      const type = opts?.type ?? null;
      // create meal doc
      await addDoc(collection(db, 'meals'), {
        userId: userId,
        beforePhoto: opts?.beforePhoto ?? uploadUrl ?? null,
        foods,
        totalCalories: totals.calories,
        totalProtein: totals.protein,
        time,
        type,
        createdAt: serverTimestamp()
      } as any);

      // update user.daily: caloriesConsumed, proteinConsumed AND increment photosCount (safety)
      const daily = (user as any)?.daily ?? {};
      const prevCals = Number(daily.caloriesConsumed ?? 0);
      const prevProt = Number(daily.proteinConsumed ?? 0);
      const today = getTodayStr();
      const prevPhotos = daily.photosDate === today ? Number(daily.photosCount ?? 0) : 0;
      const nextPhotos = prevPhotos + 1;

      await updateUser({
        daily: {
          caloriesConsumed: prevCals + totals.calories,
          proteinConsumed: prevProt + totals.protein,
          photosCount: nextPhotos,
          photosDate: today,
          lastResetDate: today
        }
      } as any);

      setSaveMessage('Repas sauvegardé ✅');
      // clear local detected foods / upload preview if desired
      setDetectedFoods(null);
      setUploadUrl(null);
      setIsModalOpen(false);
    } catch (err) {
      console.warn('Erreur lors de la sauvegarde du repas détecté', err);
      setSaveMessage('Impossible de sauvegarder automatiquement le repas.');
    }
  };

  // Ensure handleAnalyzeWithAI uses incrementPhotoCountOnUser() and auto-saves to Firestore
  const handleAnalyzeWithAI = async () => {
    // ... (code inchangé)
    setModalError(null);
    setAiResult(null);
    setDetectedFoods(null);
    setSaveMessage(null);
    setAnalysisTime(null);
    setDetectedMealType(null);

    const cnt = getTodayCount();
    if (cnt >= DAILY_LIMIT) {
      setModalError(`Limite de ${DAILY_LIMIT} photos atteinte aujourd'hui.`);
      return;
    }
    if (!uploadUrl) {
      setModalError('Aucune image uploadée.');
      return;
    }

    setIsAnalyzing(true);
    try {
      const mod = await import('@google/genai').catch(() => null);
      if (!mod || !(mod as any).GoogleGenAI) {
        throw new Error('IA indisponible');
      }
      const { GoogleGenAI } = mod as any;
      const apiKey = (import.meta as any).env?.VITE_GENAI_KEY ?? undefined;
      const model = (import.meta as any).env?.VITE_GENAI_MODEL ?? 'gemini-2.0-flash';
      const ai = new GoogleGenAI({ apiKey });

      // convert image URL -> base64 inlineData
      let inlineDataPart: any = null;
      try {
        const { mimeType, base64 } = await fetchUrlAsBase64(uploadUrl);
        inlineDataPart = { inlineData: { mimeType, data: base64 } };
      } catch (err) {
        console.warn('Impossible de lire l\'image en base64, tentative fallback via URL', err);
      }

      // build prompt text (FRANÇAIS, exiger du JSON pur en français)
      const jsonPromptText = `Analyse cette photo d'assiette et renvoie un objet JSON strict (UNIQUEMENT du JSON) en français avec le schéma suivant :
{
  "isMeal": true|false,
  "foods": [ { "name": "string", "quantity": number, "unit": "g"|"louche"|"piece"|"serving", "calories": number, "protein": number, "carbs": number, "fat": number } ],
  "notes": "string (optionnel)"
}
Si ce n'est pas un repas (objets aléatoires, etc.), renvoie {"isMeal": false, "notes": "raison"}.
Réponds seulement par l'objet JSON demandé, en français.`;

      // primary call: include inlineData if available, otherwise send prompt with URL
      let response: any;
      try {
        if (inlineDataPart) {
          // envoie inlineData puis le prompt en français
          response = await ai.models.generateContent({
            model,
            contents: [
              inlineDataPart,
              { text: jsonPromptText }
            ],
          });
        } else {
          // fallback : prompt texte en français avec l'URL
          const simple = `Analyse l'image à l'adresse ${uploadUrl} et renvoie un seul objet JSON (UNIQUEMENT du JSON) conforme au schéma décrit ci‑dessus. Réponse en français.`;
          response = await ai.models.generateContent({
            model,
            contents: simple,
          });
        }
      } catch (primaryErr) {
        // fallback : si échec, retenter en texte FR
        try {
          const simple = `Analyse l'image à l'adresse ${uploadUrl} et renvoie un seul objet JSON (UNIQUEMENT du JSON) conforme au schéma décrit ci‑dessus. Réponse en français.`;
          response = await ai.models.generateContent({
            model,
            contents: simple,
          });
        } catch (fallbackErr) {
          throw fallbackErr;
        }
      }

      const text = response?.text ?? response?.output?.[0]?.content ?? String(response);
      let parsed: any = null;
      try {
        parsed = JSON.parse(text);
      } catch (e) {
        // try to extract JSON substring
        const m = String(text).match(/\{[\s\S]*\}/);
        if (m) {
          try { parsed = JSON.parse(m[0]); } catch {}
        }
      }

      // Persist photo quota on user (server)
      await incrementPhotoCountOnUser();

      if (!parsed) {
        setModalError("Le coach n'a pas renvoyé de JSON valide. Vérifie manuellement. (Photo comptée)");
        setAiResult(text);
        return;
      }

      if (parsed.isMeal === false) {
        setModalError(`Le coach indique que ce n'est pas un repas : ${parsed.notes ?? 'aucune précision'}`);
        return;
      }

      if (Array.isArray(parsed.foods) && parsed.foods.length) {
        const foods = parsed.foods.map((f: any, idx: number) => ({
          id: idx,
          name: f.name ?? 'Inconnu',
          quantity: Number(f.quantity ?? 0),
          unit: f.unit ?? 'g',
          calories: Number(f.calories ?? 0),
          protein: Number(f.protein ?? 0),
          carbs: Number(f.carbs ?? 0),
          fat: Number(f.fat ?? 0),
          edited: false
        }));

        const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        const type = detectMealTypeFromHour(new Date().getHours());
        setAnalysisTime(time);
        setDetectedMealType(type);

        setDetectedFoods(foods);
        setAiResult('Détection automatique réalisée — enregistrement en cours...');

        // AUTO-SAVE : save to Firestore with all fields (beforePhoto, totals, time, type)
        await saveDetectedFoods(foods, {
          time: time,
          type: type,
          beforePhoto: uploadUrl ?? null
        });
      } else {
        setModalError('Pas d\'aliments détectés par le coach (photo comptée).');
      }
    } catch (err: any) {
      console.warn('Analyse AI failed', err);
      // ensure photo counted even on failure
      await incrementPhotoCountOnUser().catch(() => {});
      setModalError("Erreur durant l'analyse — notre coach personnel n'est pas disponible actuellement, remplis les infos manuellement. (Photo comptée)");
    } finally {
      setIsAnalyzing(false);
    }
  };

  // --- DÉBUT DES FONCTIONS D'ÉDITION DE REPAS ---

  // (MODAL D'ANALYSE) allow edits of detectedFoods
  const updateFood = (idx: number, patch: Partial<any>) => {
    // ... (code inchangé)
    if (!detectedFoods) return;
    const next = detectedFoods.map(f => f.id === idx ? { ...f, ...patch, edited: true } : f);
    setDetectedFoods(next);
  };

  // (MODAL DE MODIFICATION) Permet de modifier les champs
  const updateEditedFood = (index: number, patch: Partial<any>) => {
    setEditedFoods(prev => 
      prev.map((f, i) => i === index ? { ...f, ...patch } : f)
    );
  };

  // (MODAL DE MODIFICATION) Ajouter un aliment vide au modal d'édition
  const addEditedFood = () => {
    setEditedFoods(prev => [
      ...prev,
      { name: '', quantity: 0, unit: 'g', calories: 0, protein: 0 }
    ]);
  };

  // (MODAL DE MODIFICATION) Supprimer un aliment du modal d'édition
  const removeEditedFood = (indexToRemove: number) => {
    setEditedFoods(prev => prev.filter((_, index) => index !== indexToRemove));
  };
  
  // (MODAL DE MODIFICATION) Sauvegarde les modifications du repas
  const handleSaveEdit = async () => {
    if (!editModalOpen || !editedFoods) return;

    setMealSaving(true);
    try {
      // 1. Calculer les nouveaux totaux
      const newTotals = computeTotals(editedFoods);

      // 2. Calculer la différence par rapport aux anciens totaux
      const oldTotals = {
        calories: Number(editModalOpen.totalCalories ?? 0),
        protein: Number(editModalOpen.totalProtein ?? 0),
      };
      const calDiff = newTotals.calories - oldTotals.calories;
      const protDiff = newTotals.protein - oldTotals.protein;

      // 3. Mettre à jour le document 'meal' dans Firestore
      const mealRef = doc(db, 'meals', editModalOpen.id);
      await updateDoc(mealRef, {
        foods: editedFoods,
        totalCalories: newTotals.calories,
        totalProtein: newTotals.protein,
        updatedAt: serverTimestamp() // Ajout d'un timestamp de modif
      });

      // 4. Mettre à jour le 'daily' de l'utilisateur avec la différence
      if (calDiff !== 0 || protDiff !== 0) {
        const existingDaily = (user as any)?.daily ?? {};
        const prevCals = Number(existingDaily.caloriesConsumed ?? 0);
        const prevProt = Number(existingDaily.proteinConsumed ?? 0);
        
        await updateUser({
          daily: {
            caloriesConsumed: Math.max(0, prevCals + calDiff),
            proteinConsumed: Math.max(0, prevProt + protDiff)
          }
        } as any);
      }

      // 5. Fermer le modal
      setEditModalOpen(null);
      setEditedFoods([]);

    } catch (err) {
      console.warn('handleSaveEdit failed', err);
    } finally {
      setMealSaving(false);
    }
  };

  // --- FIN DES FONCTIONS D'ÉDITION DE REPAS ---


  // ask Gemini to convert a single item to grams and provide macros
  const handleConvertItem = async (idx: number) => {
    // ... (code inchangé)
    if (!detectedFoods) return;
    const item = detectedFoods.find(f => f.id === idx);
    if (!item) return;
    try {
      setIsAnalyzing(true);
      const mod = await import('@google/genai').catch(() => null);
      if (!mod || !(mod as any).GoogleGenAI) throw new Error('IA indisponible');
      const { GoogleGenAI } = mod as any;
      const apiKeyConv = (import.meta as any).env?.VITE_GENAI_KEY ?? undefined;
      const ai = new GoogleGenAI({ apiKey: apiKeyConv });

      const prompt = `Convert the following food quantity to grams and estimate macros.\nFood: ${item.name}\nQuantity: ${item.quantity} ${item.unit}\nReturn JSON: { "quantity_g": NUMBER, "calories": NUMBER, "protein": NUMBER, "carbs": NUMBER, "fat": NUMBER } only.`;
      const response = await ai.models.generateContent({
        model: (import.meta as any).env?.VITE_GENAI_MODEL ?? 'gemini-2.0-flash',
        contents: prompt,
      });
      const text = response?.text ?? response?.output?.[0]?.content ?? String(response);
      let parsed: any = null;
      try { parsed = JSON.parse(text); } catch {
        const m = String(text).match(/\{[\s\S]*\}/);
        if (m) {
          try { parsed = JSON.parse(m[0]); } catch {}
        }
      }
      if (!parsed) throw new Error('Réponse non-JSON du coach pour conversion');
      // apply conversion
      updateFood(idx, {
        quantity: Number(parsed.quantity_g ?? item.quantity),
        unit: 'g',
        calories: Number(parsed.calories ?? item.calories),
        protein: Number(parsed.protein ?? item.protein),
        carbs: Number(parsed.carbs ?? item.carbs),
        fat: Number(parsed.fat ?? item.fat),
      });
    } catch (err) {
      console.warn('Convert item failed', err);
      setModalError('Conversion via coach impossible pour le moment.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const saveMeal = async () => {
    // ... (code inchangé)
    if (!detectedFoods || !detectedFoods.length) {
      setSaveMessage('Aucun aliment détecté à sauvegarder.');
      return;
    }
    setMealSaving(true);
    setSaveMessage(null);
    try {
      const totals = computeTotals(detectedFoods);

      // 1) Mettre à jour les compteurs journaliers de l'utilisateur (daily.caloriesConsumed / proteinConsumed)
      try {
        const existingDaily = (user as any)?.daily ?? {};
        const prevCalories = existingDaily.caloriesConsumed !== undefined ? Number(existingDaily.caloriesConsumed) : 0;
        const prevProtein = existingDaily.proteinConsumed !== undefined ? Number(existingDaily.proteinConsumed) : 0;
        const newCalories = prevCalories + (totals.calories || 0);
        const newProtein = prevProtein + (totals.protein || 0);

        await updateUser({
          daily: {
            caloriesConsumed: newCalories,
            proteinConsumed: newProtein
          }
        } as any);
      } catch (userErr) {
        console.warn('Impossible de mettre à jour daily sur user', userErr);
      }

      // 2) Sauvegarder le repas
      await addDoc(collection(db, 'meals'), {
        userId: userId,
        beforePhoto: uploadUrl,
        foods: detectedFoods,
        totalCalories: totals.calories,
        totalProtein: totals.protein,
        time: analysisTime ?? new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        type: detectedMealType ?? null,
        createdAt: serverTimestamp()
      } as any);

      setSaveMessage('Repas sauvegardé ✅');
      setDetectedFoods(null);
      setUploadUrl(null);
      setIsModalOpen(false);
    } catch (err) {
      console.warn('Save meal failed', err);
      setSaveMessage('Impossible de sauvegarder le repas.');
    } finally {
      setMealSaving(false);
    }
  };

  // Firestore subscription for meals (utilise userId)
  useEffect(() => {
    // ... (code inchangé)
    if (!user || !userId) return;

    const qPrimary = query(
      collection(db, 'meals'),
      where('userId', '==', userId),
      orderBy('createdAt', 'desc')
    );

    let unsubPrimary: (() => void) | null = null;
    let unsubFallback: (() => void) | null = null;

    const subscribePrimary = () => {
      unsubPrimary = onSnapshot(qPrimary, (snap) => {
        const allDocs = snap.docs.map(d => ({ id: d.id, ...(d.data() as any) }));

        // --- DÉBUT DE LA CORRECTION (On charge TOUS les repas) ---
        // On remet allDocs dans setMeals, le tri se fera dans le JSX
        setMeals(allDocs as any);
        // --- FIN DE LA CORRECTION ---

        // --- MODIFIÉ : calculer totaux des repas POUR AUJOURD'HUI et synchroniser user.daily ---
        try {
          const today = new Date().toISOString().slice(0, 10);
          let sumCals = 0;
          let sumProt = 0;
          
          // On filtre 'allDocs' ici juste pour le calcul des totaux
          for (const docItem of allDocs) { 
            const ts = docItem.createdAt;
            let dateStr = null;
            if (ts?.seconds) {
              dateStr = new Date(ts.seconds * 1000).toISOString().slice(0, 10);
            } else if (ts) {
              try { dateStr = new Date(ts).toISOString().slice(0, 10); } catch(e){}
            }
            
            if (dateStr === today) { // Le filtre est ici
              const c = Number(docItem.totalCalories ?? 0);
              const p = Number(docItem.totalProtein ?? 0);
              sumCals += c;
              sumProt += p;
            }
          }

          const currentDaily = (user as any)?.daily ?? {};
          const currCals = Number(currentDaily.caloriesConsumed ?? 0);
          const currProt = Number(currentDaily.proteinConsumed ?? 0);
          const lastReset = currentDaily.lastResetDate ?? null;

          if (currCals !== sumCals || currProt !== sumProt || lastReset !== today) {
            updateUser({
              daily: {
                caloriesConsumed: sumCals,
                proteinConsumed: sumProt,
                lastResetDate: today
              }
            } as any).catch(err => console.warn('Impossible de synchroniser daily depuis meals:', err));
          }
        } catch (syncErr) {
          console.warn('Erreur lors du calcul/sync des totaux journaliers', syncErr);
        }
      }, (err) => {
        console.warn('Erreur subscription meals', err);
        const msg = String(err?.message ?? '');
        if (msg.includes('requires an index') || msg.includes('requires index')) {
          if (unsubPrimary) { try { unsubPrimary(); } catch {} }
          const qFallback = query(collection(db, 'meals'), where('userId', '==', userId));
          unsubFallback = onSnapshot(qFallback, (snap2) => {
            const docs2 = snap2.docs.map(d => ({ id: d.id, ...(d.data() as any) }));
            docs2.sort((a: any, b: any) => {
              const ta = a.createdAt?.seconds ? a.createdAt.seconds * 1000 : (a.createdAt ? new Date(a.createdAt).getTime() : 0);
              const tb = b.createdAt?.seconds ? b.createdAt.seconds * 1000 : (b.createdAt ? new Date(b.createdAt).getTime() : 0);
              return tb - ta;
            });
            
            // --- DÉBUT DE LA CORRECTION (Fallback) ---
            // On charge TOUS les repas (docs2)
            setMeals(docs2 as any);
            // --- FIN DE LA CORRECTION (Fallback) ---
            
            try {
              const today = new Date().toISOString().slice(0, 10);
              let sumCals = 0;
              let sumProt = 0;
              // On filtre 'docs2' ici juste pour le calcul des totaux
              for (const docItem of docs2) {
                const ts = docItem.createdAt;
                let dateStr: string | null = null;
                if (ts?.seconds) dateStr = new Date(ts.seconds * 1000).toISOString().slice(0, 10);
                else if (ts) try { dateStr = new Date(ts).toISOString().slice(0, 10); } catch(e){}
                
                if (dateStr === today) { // Le filtre est ici
                  sumCals += Number(docItem.totalCalories ?? 0);
                  sumProt += Number(docItem.totalProtein ?? 0);
                }
              }
              const currentDaily = (user as any)?.daily ?? {};
              const currCals = Number(currentDaily.caloriesConsumed ?? 0);
              const currProt = Number(currentDaily.proteinConsumed ?? 0);
              const lastReset = currentDaily.lastResetDate ?? null;
              if (currCals !== sumCals || currProt !== sumProt || lastReset !== today) {
                updateUser({
                  daily: {
                    caloriesConsumed: sumCals,
                    proteinConsumed: sumProt,
                    lastResetDate: today
                  }
                } as any).catch(err => console.warn('Impossible de synchroniser daily depuis meals (fallback):', err));
              }
            } catch (syncErr) {
              console.warn('Erreur lors du calcul/sync des totaux journaliers (fallback)', syncErr);
            }
          }, (err2) => {
            console.warn('Erreur subscription meals (fallback)', err2);
          });
        }
      });
    };

    subscribePrimary();

    return () => {
      try { if (unsubPrimary) unsubPrimary(); } catch {}
      try { if (unsubFallback) unsubFallback(); } catch {}
    };
  }, [user, updateUser, userId]);
  
  // (MODAL DE MODIFICATION) Recalculer les totaux quand 'editedFoods' change
  useEffect(() => {
    if (!editModalOpen) return;
    const totals = computeTotals(editedFoods); // computeTotals existe déjà
    setEditTotals(totals);
  }, [editedFoods, editModalOpen]);


  // --- NOUVEAU: bouton "Créer mon plateau" et modal ---
  const addPlateItem = (name = '') => {
    // ... (code inchangé)
    setPlateItems(prev => [...prev, { id: Date.now() + Math.random(), name }]);
  };
  const updatePlateItem = (id: number, name: string) => {
    // ... (code inchangé)
    setPlateItems(prev => prev.map(i => i.id === id ? { ...i, name } : i));
  };
  const removePlateItem = (id: number) => {
    // ... (code inchangé)
    setPlateItems(prev => prev.filter(i => i.id !== id));
  };

  // Appelle Gemini pour convertir calories ciblées en grammes + estimer macros (FR, JSON)
  const suggestPlateGrams = async () => {
    // ... (code inchangé)
    setPlateError(null);
    setPlateSuggestions(null);
    if (!plateItems.length) {
      setPlateError('Ajoute au moins un aliment.');
      return;
    }

    const remainingCals = Math.max(0, Number((user as any)?.daily?.caloriesTarget ?? 0) - Number((user as any)?.daily?.caloriesConsumed ?? 0));
    const mealType = detectMealTypeFromHour(new Date().getHours());
    
    let mealTargetKcal = 0;
    if (remainingCals <= 0) {
      mealTargetKcal = 100;
      setPlateError("Tu as déjà atteint ton objectif de calories. Le coach te suggérera une petite collation.");
    } else if (mealType === 'Petit-déjeuner') mealTargetKcal = remainingCals * 0.3;
    else if (mealType === 'Déjeuner') mealTargetKcal = remainingCals * 0.4;
    else if (mealType === 'Dîner') mealTargetKcal = remainingCals * 0.3;
    else mealTargetKcal = remainingCals * 0.2; // Collation
    
    mealTargetKcal = Math.max(50, Math.round(mealTargetKcal)); 

    if (plateItems.length === 0) return; // Sécurité

    const perItemKcal = Math.round(mealTargetKcal / plateItems.length);

    setIsSuggesting(true);
    try {
      const mod = await import('@google/genai').catch(() => null);
      if (!mod || !(mod as any).GoogleGenAI) throw new Error('IA indisponible');

      const { GoogleGenAI } = mod as any;
      const ai = new GoogleGenAI({ apiKey: (import.meta as any).env?.VITE_GENAI_KEY });

      const suggestions: Array<any> = [];
      for (const item of plateItems) {
        const prompt = `Pour l'aliment "${item.name}" : quelle quantité en grammes correspond approximativement à ${perItemKcal} kcal (partie d'un ${mealType} totalisant ${mealTargetKcal} kcal) ? Donne aussi une estimation des macros pour cette quantité. Réponds uniquement en JSON (FR) : { "quantity_g": NUMBER, "calories": NUMBER, "protein": NUMBER, "carbs": NUMBER, "fat": NUMBER }`;
        const response = await ai.models.generateContent({
          model: (import.meta as any).env?.VITE_GENAI_MODEL ?? 'gemini-2.0-flash',
          contents: prompt,
        });
        const text = response?.text ?? response?.output?.[0]?.content ?? String(response);
        let parsed: any = null;
        try { parsed = JSON.parse(text); } catch {
          const m = String(text).match(/\{[\s\S]*\}/);
          if (m) {
            try { parsed = JSON.parse(m[0]); } catch {}
          }
        }
        if (!parsed) {
          suggestions.push({ id: item.id, name: item.name, quantity_g: null, calories: perItemKcal, protein: null, carbs: null, fat: null, raw: text });
        } else {
          suggestions.push({ id: item.id, name: item.name, quantity_g: Number(parsed.quantity_g ?? null), calories: Number(parsed.calories ?? perItemKcal), protein: Number(parsed.protein ?? 0), carbs: Number(parsed.carbs ?? 0), fat: Number(parsed.fat ?? 0) });
        }
      }
      setPlateSuggestions(suggestions);
    } catch (err: any) {
      console.warn('suggestPlateGrams failed', err);
      setPlateError('Impossible d\'obtenir des suggestions pour le moment.');
    } finally {
      setIsSuggesting(false);
    }
  };

  // Sauvegarde du plateau proposé (création meal + updateUser.daily)
  const savePlate = async () => {
    // ... (code inchangé)
    if (!plateSuggestions || !plateSuggestions.length) {
      setPlateError('Pas de suggestions à sauvegarder.');
      return;
    }
    setMealSaving(true);
    try {
      const foods = plateSuggestions.map((s: any, idx: number) => ({
        id: idx,
        name: s.name,
        quantity: s.quantity_g ?? 0,
        unit: 'g',
        calories: s.calories ?? 0,
        protein: s.protein ?? 0,
        carbs: s.carbs ?? 0,
        fat: s.fat ?? 0,
      }));
      const totals = computeTotals(foods);
      try {
        const existingDaily = (user as any)?.daily ?? {};
        const prevCals = existingDaily.caloriesConsumed !== undefined ? Number(existingDaily.caloriesConsumed) : 0;
        const prevProt = existingDaily.proteinConsumed !== undefined ? Number(existingDaily.proteinConsumed) : 0;
        await updateUser({
          daily: {
            caloriesConsumed: prevCals + totals.calories,
            proteinConsumed: prevProt + totals.protein
          }
        } as any);
      } catch (uerr) {
        console.warn('updateUser daily failed', uerr);
      }
      await addDoc(collection(db, 'meals'), {
        userId: userId,
        beforePhoto: null,
        foods,
        totalCalories: totals.calories,
        totalProtein: totals.protein,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        type: detectMealTypeFromHour(new Date().getHours()),
        createdAt: serverTimestamp()
      } as any);
      setPlateItems([]);
      setPlateSuggestions(null);
      setCreatePlateOpen(false);
    } catch (err) {
      console.warn('savePlate failed', err);
      setPlateError('Impossible de sauvegarder ton plateau.');
    } finally {
      setMealSaving(false);
    }
  };

  // --- NOUVEAU: suppression d'un meal et mise à jour des totals dans user.daily ---
  const deleteMeal = async (mealId: string) => {
    // ... (code inchangé)
    try {
      const mealRef = doc(db, 'meals', mealId);
      const snap = await getDoc(mealRef);
      let cals = 0;
      let prot = 0;
      if (snap.exists()) {
        const data = snap.data() as any;
        cals = Number(data.totalCalories ?? 0);
        prot = Number(data.totalProtein ?? 0);
      }
      await deleteDoc(mealRef);

      try {
        const existingDaily = (user as any)?.daily ?? {};
        const prevCals = existingDaily.caloriesConsumed !== undefined ? Number(existingDaily.caloriesConsumed) : 0;
        const prevProt = existingDaily.proteinConsumed !== undefined ? Number(existingDaily.proteinConsumed) : 0;
        const newCals = Math.max(0, prevCals - cals);
        const newProt = Math.max(0, prevProt - prot);
        await updateUser({
          daily: {
            caloriesConsumed: newCals,
            proteinConsumed: newProt
          }
        } as any);
      } catch (uerr) {
        console.warn('updateUser daily failed after meal deletion', uerr);
      }
    } catch (err) {
      console.warn('Erreur suppression meal', err);
    }
  };

  // state for confirmation modal
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [confirmLoading, setConfirmLoading] = useState(false);

  // confirm delete handler
  const confirmDelete = async () => {
    // ... (code inchangé)
    if (!confirmDeleteId) return;
    setConfirmLoading(true);
    try {
      await deleteMeal(confirmDeleteId);
      setConfirmDeleteId(null);
    } catch (err) {
      console.warn('Erreur lors de la confirmation de suppression', err);
    } finally {
      setConfirmLoading(false);
    }
  };

  // --- NOUVEAU: états pour FAB animé + prédiction Gemini
  const [fabOpen, setFabOpen] = useState(false);
  const [predictOpen, setPredictOpen] = useState(false);
  const [predictInput, setPredictInput] = useState('');
  const [predictResult, setPredictResult] = useState<any>(null);
  const [isPredicting, setIsPredicting] = useState(false);

  // --- NOUVEAU: fonction util pour fermer FAB après action
  const handleFabAction = (fn?: () => void) => {
    // ... (code inchangé)
    setFabOpen(false);
    try { if (fn) fn(); } catch (err) { console.warn('Erreur dans handleFabAction', err); }
  };

  // --- NOUVEAU: handlePredictWithAI (appelé depuis le modal "Prédire mon plateau")
  const handlePredictWithAI = async () => {
    // ... (code inchangé)
    setPredictResult(null);
    setIsPredicting(true);
    try {
      const mod = await import('@google/genai').catch(() => null);
      if (!mod || !(mod as any).GoogleGenAI) throw new Error('IA indisponible');
      const { GoogleGenAI } = mod as any;
      const apiKey = (import.meta as any).env?.VITE_GENAI_KEY ?? undefined;
      const model = (import.meta as any).env?.VITE_GENAI_MODEL ?? 'gemini-2.0-flash';
      const ai = new GoogleGenAI({ apiKey });

      const remainingCals = Math.max(0, Number((user as any)?.daily?.caloriesTarget ?? 0) - Number((user as any)?.daily?.caloriesConsumed ?? 0));
      const remainingProt = Math.max(0, Number((user as any)?.daily?.proteinTarget ?? 0) - Number((user as any)?.daily?.proteinConsumed ?? 0));

      const mealType = detectMealTypeFromHour(new Date().getHours());
      let mealTargetKcal = 0;
      if (remainingCals <= 0) mealTargetKcal = 100; // Petite collation si déjà plein
      else if (mealType === 'Petit-déjeuner') mealTargetKcal = remainingCals * 0.3;
      else if (mealType === 'Déjeuner') mealTargetKcal = remainingCals * 0.4;
      else if (mealType === 'Dîner') mealTargetKcal = remainingCals * 0.3;
      else mealTargetKcal = remainingCals * 0.2; // Collation
      
      mealTargetKcal = Math.max(50, Math.round(mealTargetKcal));
      
      const prompt = `Tu es un assistant nutritionnel. Réponds STRICTEMENT par un tableau JSON (Rien d'autre) en français, respectant ce schéma :
[ { "name": "string", "quantity_g": number, "calories": number, "protein": number, "notes": "string (optionnel)" } ]

Contexte : Je veux manger mon "${mealType}". Mon objectif pour CE repas est d'environ ${mealTargetKcal} kcal (il me reste ${remainingCals} kcal au total pour la journée et ${remainingProt} g de protéines).
Instruction : pour la phrase suivante "${predictInput}", propose pour chaque aliment une quantité en grammes et une estimation des calories et protéines pour cette quantité. Arrondis les grammes à l'entier, calories et protéines à une décimale. Si tu ne peux pas estimer, renvoie [].
Réponds UNIQUEMENT par le JSON demandé, sans explication, sans texte avant ni après.`;

      const response = await ai.models.generateContent({ model, contents: prompt });
      const text = response?.text ?? response?.output?.[0]?.content ?? String(response);

      let parsed: any = null;
      try { parsed = JSON.parse(text); } catch {
        const m = String(text).match(/(\[.*\])/s);
        if (m) {
          try { parsed = JSON.parse(m[0]); } catch {}
        }
      }

      if (!parsed || !Array.isArray(parsed)) {
        setPredictResult({ error: 'Réponse non-JSON ou JSON invalide (attendu un tableau)', raw: text });
      } else {
        setPredictResult(parsed);
      }
    } catch (err: any) {
      console.warn('predict failed', err);
      setPredictResult({ error: 'Erreur lors de la prédiction', details: String(err?.message ?? err) });
    } finally {
      setIsPredicting(false);
    }
  };

  // --- NOUVEAU: Enregistrer la prédiction AI comme meal dans Firestore
  const savePredictedAsMeal = async () => {
    // ... (code inchangé)
    if (!Array.isArray(predictResult) || predictResult.length === 0) {
      setPredictResult({ error: 'Aucune prédiction valable à enregistrer.' });
      return;
    }
    setMealSaving(true);
    try {
      const foods = (predictResult as any[]).map((it, idx) => ({
        id: idx,
        name: it.name ?? 'Inconnu',
        quantity: Number(it.quantity_g ?? it.quantity ?? 0),
        unit: 'g',
        calories: Number(it.calories ?? 0),
        protein: Number(it.protein ?? 0),
        carbs: Number(it.carbs ?? 0),
        fat: Number(it.fat ?? 0),
        edited: false
      }));

      const totals = computeTotals(foods);

      try {
        const existingDaily = (user as any)?.daily ?? {};
        const prevCals = existingDaily.caloriesConsumed !== undefined ? Number(existingDaily.caloriesConsumed) : 0;
        const prevProt = existingDaily.proteinConsumed !== undefined ? Number(existingDaily.proteinConsumed) : 0;
        await updateUser({
          daily: {
            caloriesConsumed: prevCals + totals.calories,
            proteinConsumed: prevProt + totals.protein
          }
        } as any);
      } catch (uerr) {
        console.warn('updateUser daily failed (predict save)', uerr);
      }

      await addDoc(collection(db, 'meals'), {
        userId: userId,
        beforePhoto: null,
        foods,
        totalCalories: totals.calories,
        totalProtein: totals.protein,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        type: detectMealTypeFromHour(new Date().getHours()),
        createdAt: serverTimestamp()
      } as any);

      setPredictResult(null);
      setPredictInput('');
      setPredictOpen(false);
      if(setSaveMessage) setSaveMessage('Plateau enregistré ✅');
    } catch (err) {
      console.warn('savePredictedAsMeal failed', err);
      setPredictResult({ error: 'Impossible d\'enregistrer le plateau.' , details: String(err) });
    } finally {
      setMealSaving(false);
    }
  };

// --- NOUVEAU (Req 5): Gérer l'envoi de message au chat coach ---
  const handleChatSend = async () => {
    if (!chatInput.trim()) return;
    const newUserMessage = { sender: 'user' as 'user', text: chatInput };
    setChatMessages(prev => [...prev, newUserMessage]);
    setChatInput('');
    setIsChatting(true);
    setSuggestedMeal(null); // Reset old suggestion

    try {
      const mod = await import('@google/genai').catch(() => null);
      if (!mod || !(mod as any).GoogleGenAI) throw new Error('IA indisponible');
      const { GoogleGenAI } = mod as any;
      const ai = new GoogleGenAI({ apiKey: (import.meta as any).env?.VITE_GENAI_KEY });

      // --- DÉBUT DE LA MODIFICATION (Ajout de l'historique des repas) ---

      // 1. Récupérer les données caloriques (comme avant)
      const daily = (user as any)?.daily ?? {};
      const totalTargetCals = Number(daily.caloriesTarget ?? 0);
      const totalConsumedCals = Number(daily.caloriesConsumed ?? 0);
      const remainingCals = Math.max(0, totalTargetCals - totalConsumedCals);

      const totalTargetProt = Number(daily.proteinTarget ?? 0);
      const totalConsumedProt = Number(daily.proteinConsumed ?? 0);
      const remainingProt = Math.max(0, totalTargetProt - totalConsumedProt);

      const mealType = detectMealTypeFromHour(new Date().getHours());
      
      // 2. Récupérer les repas d'aujourd'hui depuis l'état 'meals' (qui est déjà chargé)
      // (Nous devons filtrer 'meals' ici pour le chat, car 'meals' contient TOUT)
      const todayStr = new Date().toISOString().slice(0, 10);
      const todaysMeals = meals.filter(meal => {
        const ts = meal.createdAt;
        let dateStr = null;
        if (ts?.seconds) {
          dateStr = new Date(ts.seconds * 1000).toISOString().slice(0, 10);
        } else if (ts) {
          try { dateStr = new Date(ts).toISOString().slice(0, 10); } catch(e){}
        }
        return dateStr === todayStr;
      })
      // Trier par ordre chronologique (le plus ancien en premier)
      .reverse(); 

      // 3. Formater ces repas pour l'IA
      let mealHistoryString = "Aucun repas n'a encore été enregistré aujourd'hui.";
      if (todaysMeals.length > 0) {
        mealHistoryString = "Voici les repas que j'ai déjà enregistrés aujourd'hui :\n";
        todaysMeals.forEach(meal => {
          const type = meal.type || 'Repas';
          const foods = (meal.foods || []).map((f: any) => `${f.name} (${f.quantity}${f.unit || 'g'})`).join(', ');
          mealHistoryString += `- ${type} (à ${meal.time}): ${foods}. (Total: ${meal.totalCalories} kcal, ${meal.totalProtein}g P)\n`;
        });
      }
      
      // --- FIN DE LA MODIFICATION ---


      // Historique de chat simple
      const history = chatMessages.map(msg => `${msg.sender === 'user' ? 'Utilisateur' : 'Coach'}: ${msg.text}`).join('\n');

      // --- MODIFICATION PROMPT (Ajout de mealHistoryString) ---
      const prompt = `Tu es un coach nutritionnel.
Contexte: 
Objectif Quotidien Total: ${totalTargetCals} kcal, ${totalTargetProt} g protéines.
Consommé Aujourd'hui: ${totalConsumedCals} kcal, ${totalConsumedProt} g protéines.
Restant Aujourd'hui: ${remainingCals} kcal, ${remainingProt} g protéines.
C'est l'heure du ${mealType}.

${mealHistoryString}

Historique de la discussion:
${history}
Utilisateur: ${newUserMessage.text}

Instructions:
1. Réponds en tant que coach (ton, conseils). Tiens compte de l'historique des repas d'aujourd'hui pour donner des conseils pertinents.
2. Si l'utilisateur demande une idée de repas (ex: "idée repas", "que manger"), inclus dans ta réponse un bloc JSON *strict* (et *seulement si* c'est une suggestion de repas) avec le format:
[ { "name": "string", "quantity_g": number, "calories": number, "protein": number } ]
3. Ne mets PAS le JSON si ce n'est pas une suggestion de repas (ex: simple conseil).
Coach:`;

      const response = await ai.models.generateContent({
        model: (import.meta as any).env?.VITE_GENAI_MODEL ?? 'gemini-2.0-flash',
        contents: prompt
      });
      const text = response?.text ?? response?.output?.[0]?.content ?? String(response);

      // Extraire le JSON s'il existe
      let mealJson: any = null;
      const m = String(text).match(/(\[[\s\S]*\])/);
      if (m) {
        try {
          mealJson = JSON.parse(m[0]);
          setSuggestedMeal(mealJson); // Stocker le repas suggéré
        } catch {}
      }
      
      // Nettoyer le JSON de la réponse textuelle
      const cleanText = text.replace(/(\[[\s\S]*\])/, '').trim();
      setChatMessages(prev => [...prev, { sender: 'ai', text: cleanText || (mealJson ? "Voici une suggestion de repas :" : "Désolé, je n'ai pas compris.") }]);

    } catch (err) {
      console.warn('Chat AI failed', err);
      setChatMessages(prev => [...prev, { sender: 'ai', text: "Désolé, je rencontre une erreur. Réessaie plus tard." }]);
    } finally {
      setIsChatting(false);
    }
  };

  // --- NOUVEAU (Req 5): Sauvegarder le repas suggéré par le chat ---
  const saveSuggestedMeal = async () => {
    // ... (code inchangé)
    if (!Array.isArray(suggestedMeal) || suggestedMeal.length === 0) return;
    setMealSaving(true);
    try {
      const foods = (suggestedMeal as any[]).map((it, idx) => ({
        id: idx, name: it.name ?? 'Inconnu', quantity: Number(it.quantity_g ?? 0), unit: 'g',
        calories: Number(it.calories ?? 0), protein: Number(it.protein ?? 0), 
        carbs: Number(it.carbs ?? 0), fat: Number(it.fat ?? 0),
      }));
      const totals = computeTotals(foods);
      
      try {
        const existingDaily = (user as any)?.daily ?? {};
        const prevCals = Number(existingDaily.caloriesConsumed ?? 0);
        const prevProt = Number(existingDaily.proteinConsumed ?? 0);
        await updateUser({ daily: { caloriesConsumed: prevCals + totals.calories, proteinConsumed: prevProt + totals.protein } } as any);
      } catch (uerr) { console.warn('updateUser daily failed (chat save)', uerr); }

      await addDoc(collection(db, 'meals'), {
        userId: userId, beforePhoto: null, foods,
        totalCalories: totals.calories, totalProtein: totals.protein,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        type: detectMealTypeFromHour(new Date().getHours()),
        createdAt: serverTimestamp()
      } as any);

      if(setSaveMessage) setSaveMessage('Repas du coach enregistré ✅');
      setSuggestedMeal(null);
      setCoachChatOpen(false);
    } catch (err) {
      console.warn('saveSuggestedMeal failed', err);
    } finally {
      setMealSaving(false);
    }
  };


  // --- NOUVEAU: Logique de groupement des repas (Aujourd'hui / Hier / Anciens) ---
  const todayStr = new Date().toISOString().slice(0, 10);
  const yesterdayDate = new Date();
  yesterdayDate.setDate(yesterdayDate.getDate() - 1);
  const yesterdayStr = yesterdayDate.toISOString().slice(0, 10);

  // Helper pour extraire la date
  const getMealDateStr = (meal: any) => {
    const ts = meal.createdAt;
    if (!ts) return null;
    if (ts.seconds) return new Date(ts.seconds * 1000).toISOString().slice(0, 10);
    // Gérer si ts est déjà une string (ex: auto-save) ou un objet Date
    try {
      return new Date(ts).toISOString().slice(0, 10);
    } catch (e) { return null; }
  };

  const todaysMeals: any[] = [];
  const yesterdaysMeals: any[] = [];
  const olderMeals: any[] = [];

  // 'meals' est déjà trié par 'createdAt: desc' grâce à la query Firestore
  for (const meal of meals) {
    const dateStr = getMealDateStr(meal);
    if (dateStr === todayStr) {
      todaysMeals.push(meal);
    } else if (dateStr === yesterdayStr) {
      yesterdaysMeals.push(meal);
    } else if (dateStr) { // S'assurer qu'il y a une date
      olderMeals.push(meal);
    }
  }

  // --- NOUVEAU: Fonction pour afficher une carte de repas (éviter la duplication) ---
  // (J'extrais le code de votre <motion.div> ici pour ne pas le répéter 3x)
  const renderMealCard = (meal: any, index: number) => (
    <motion.div
      key={meal.id ?? `${meal.time}-${index}`}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.1 * (index + 3) }}
      className="bg-dark-800/50 backdrop-blur-sm rounded-2xl p-4 border border-gray-600/30 relative cursor-pointer hover:border-primary-500/50"
      onClick={() => {
        setEditModalOpen(meal);
        setEditedFoods(JSON.parse(JSON.stringify(meal.foods || [])));
      }}
    >
      <button
        onClick={(e) => {
          e.stopPropagation();
          setConfirmDeleteId(meal.id);
        }}
        className="absolute top-3 right-3 p-1 rounded-full hover:bg-red-500/20 text-gray-500 hover:text-red-400"
        aria-label="Supprimer le repas"
      >
        <Trash2 size={16} />
      </button>
      <div className="flex items-center space-x-4">
        <img
          src={meal.beforePhoto ?? meal.image ?? undefined}
          alt={meal.type ?? meal.name ?? 'Repas'}
          className="w-16 h-16 rounded-xl object-cover bg-dark-700"
        />
        <div className="flex-1">
          <div className="flex items-center space-x-2 mb-1">
            <Clock size={14} className="text-gray-400" />
            <span className="text-gray-400 text-sm">
              {meal.time
                ?? (meal.createdAt?.seconds
                  ? new Date(meal.createdAt.seconds * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                  : (meal.createdAt ? new Date(meal.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--')
                )}
            </span>
          </div>
          <h4 className="text-white font-semibold text-lg">
            {meal.type || (meal.foods && meal.foods[0] ? meal.foods[0].name : 'Repas')}
          </h4>
          <p className="text-gray-400 text-sm">{meal.totalCalories ?? '--'} kcal • {meal.totalProtein ?? '--'}g P</p>
        </div>
      </div>
    </motion.div>
  );


  return (
    <>
      <div className="p-6 pt-12">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          {/* ... (code inchangé) ... */}
          <h1 className="text-3xl font-bold text-white mb-2">
            Mes Repas 🍽️
          </h1>
          <p className="text-gray-400">
            Historique et analyse de tes plateaux
          </p>
        </motion.div>

        <CoachTip />

        {/* Daily Limit Info */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-gradient-to-r from-accent-orange/20 to-accent-pink/20 backdrop-blur-sm rounded-2xl p-4 mb-6 border border-accent-orange/30"
        >
          {/* ... (code inchangé) ... */}
          <div className="flex items-center space-x-3">
            <Camera size={20} className="text-accent-orange" />
            <div>
              <p className="text-white font-medium text-sm">Photos restantes</p>
              <p className="text-gray-300 text-xs">{Math.max(0, DAILY_LIMIT - getTodayCount())}/{DAILY_LIMIT} analyses de plateaux disponibles aujourd'hui</p>
            </div>
          </div>
        </motion.div>

        {/* --- DÉBUT: NOUVEAU BLOC "Meals History" (AVEC GROUPEMENT) --- */}
        <div className="space-y-4 mb-24">
          {meals.length > 0 ? (
            <>
              {/* --- Section Aujourd'hui --- */}
              {todaysMeals.length > 0 && (
                <div className="space-y-4">
                  {/* (Pas de titre pour "Aujourd'hui", c'est implicite) */}
                  {todaysMeals.map(renderMealCard)}
                </div>
              )}

              {/* --- Section Hier --- */}
              {yesterdaysMeals.length > 0 && (
                <div className="space-y-4">
                  {/* Le séparateur que vous avez demandé */}
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.1 }}
                    className="flex items-center space-x-3 pt-4"
                  >
                    <span className="text-gray-400 font-semibold">Hier</span>
                    <hr className="flex-1 border-t-2 border-dashed border-gray-700" />
                  </motion.div>
                  {yesterdaysMeals.map(renderMealCard)}
                </div>
              )}
              
              {/* --- Section Plus Anciens --- */}
              {olderMeals.length > 0 && (
                <div className="space-y-4">
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.2 }}
                    className="flex items-center space-x-3 pt-4"
                  >
                    <span className="text-gray-400 font-semibold">Plus anciens</span>
                    <hr className="flex-1 border-t-2 border-dashed border-gray-700" />
                  </motion.div>
                  
                  {/* On applique la logique "showAll" uniquement aux anciens repas */}
                  {(() => {
                    const limit = showAll ? olderMeals.length : 3;
                    return olderMeals.slice(0, limit).map(renderMealCard);
                  })()}
                  
                  {olderMeals.length > 3 && (
                    <div className="flex items-center justify-center mt-4">
                      <button
                        onClick={() => setShowAll(prev => !prev)}
                        className="text-sm text-primary-400 hover:underline"
                      >
                        {showAll ? '◀︎ Réduire' : '---------- afficher plus -------- ▶︎'}
                      </button>
                    </div>
                  )}
                </div>
              )}
              
              {/* Si on n'a pas de repas aujourd'hui, mais qu'on en a d'hier/avant */}
              {todaysMeals.length === 0 && (yesterdaysMeals.length > 0 || olderMeals.length > 0) && (
                <p className="text-gray-400 text-center text-sm py-4">
                  Aucun repas enregistré aujourd'hui.
                </p>
              )}

            </>
          ) : (
            // --- Empty State (Si AUCUN repas n'existe) ---
            <div className="bg-dark-800/50 backdrop-blur-sm rounded-2xl p-6 border border-gray-600/30 text-center">
              <div className="text-4xl mb-3">🍽️</div>
              <h3 className="text-white font-semibold mb-2">Aucun repas enregistré</h3>
              <p className="text-gray-300 mb-0">Téléverse une photo ou crée ton plateau manuellement pour l'afficher ici.</p>
            </div>
          )}
        </div>
        {/* --- FIN: NOUVEAU BLOC "Meals History" --- */}


        {/* MODIFIÉ (Req 5): Floating Action Button -> remplace l'ancien FAB simple par FAB animé */}
        <div className="fixed bottom-24 right-6 z-50">
          {/* ... (code inchangé) ... */}
          <div className="relative">
            {/* bouton secondaire: gauche (photo) */}
            <motion.button
              initial={{ scale: 0, x: 0, y: 0, opacity: 0 }}
              animate={fabOpen ? { scale: 1, x: -72, y: 0, opacity: 1 } : { scale: 0, x: 0, y: 0, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 400, damping: 20 }}
              onClick={() => { if (fabOpen) handleFabAction(openAnalyzeModal); }}
              className={`${fabOpen ? 'pointer-events-auto z-40' : 'pointer-events-none z-0'} absolute bottom-2 right-2 bg-dark-700 p-3 rounded-full shadow-md`}
              aria-label="Importer une photo"
            >
              <Camera size={18} className="text-white" />
            </motion.button>

            {/* bouton secondaire: haut-gauche (créer plateau) -> MODIFIÉ (Req 5) -> haut-droite */}
            <motion.button
              initial={{ scale: 0, x: 0, y: 0, opacity: 0 }}
              animate={fabOpen ? { scale: 1, x: 52, y: -52, opacity: 1 } : { scale: 0, x: 0, y: 0, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 400, damping: 20, delay: 0.03 }}
              onClick={() => { if (fabOpen) handleFabAction(() => { setCreatePlateOpen(true); addPlateItem(); }); }}
              className={`${fabOpen ? 'pointer-events-auto z-40' : 'pointer-events-none z-0'} absolute bottom-2 right-2 bg-dark-700 p-3 rounded-full shadow-md`}
              aria-label="Créer un plateau"
            >
              <List size={18} className="text-white" />
            </motion.button>

            {/* bouton secondaire: haut (prédire plateau) -> MODIFIÉ (Req 5) -> haut-gauche */}
            <motion.button
              initial={{ scale: 0, x: 0, y: 0, opacity: 0 }}
              animate={fabOpen ? { scale: 1, x: -52, y: -52, opacity: 1 } : { scale: 0, x: 0, y: 0, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 400, damping: 20, delay: 0.06 }}
              onClick={() => { if (fabOpen) handleFabAction(() => setPredictOpen(true)); }}
              className={`${fabOpen ? 'pointer-events-auto z-40' : 'pointer-events-none z-0'} absolute bottom-2 right-2 bg-dark-700 p-3 rounded-full shadow-md`}
              aria-label="Prédire mon plateau"
            >
              <Zap size={18} className="text-white" />
            </motion.button>

            {/* NOUVEAU (Req 5): bouton secondaire: haut (Chat Coach) */}
            <motion.button
              initial={{ scale: 0, x: 0, y: 0, opacity: 0 }}
              animate={fabOpen ? { scale: 1, x: 0, y: -88, opacity: 1 } : { scale: 0, x: 0, y: 0, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 400, damping: 20, delay: 0.09 }}
              onClick={() => { if (fabOpen) handleFabAction(() => { setCoachChatOpen(true); setChatMessages([{ sender: 'ai', text: 'Bonjour ! Je suis ton coach nutritionnel. Pose-moi tes questions ou demande-moi des idées de repas.' }]); setSuggestedMeal(null); }); }}
              className={`${fabOpen ? 'pointer-events-auto z-40' : 'pointer-events-none z-0'} absolute bottom-2 right-2 bg-dark-700 p-3 rounded-full shadow-md`}
              aria-label="Discuter avec le coach"
            >
              <MessageCircle size={18} className="text-white" />
            </motion.button>


            {/* bouton principal */}
            <motion.button
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              transition={{ delay: 0.1, type: "spring", bounce: 0.3 }}
              onClick={() => setFabOpen(prev => !prev)}
              className="p-4 rounded-full bg-gradient-to-r from-primary-500 to-secondary-500 shadow-lg z-50"
              aria-label="Actions repas"
            >
              <Plus size={28} className="text-white" />
            </motion.button>
          </div>
        </div>

        {/* --- Modal (Analyse) --- */}
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            {/* ... (code inchangé) ... */}
            <div className="w-full max-w-lg max-h-[85vh] overflow-auto bg-dark-800 rounded-2xl p-6 border border-gray-600/30">
              <div className="flex items-start justify-between mb-4">
                <h3 className="text-white font-bold text-lg">Analyser un plateau 📸</h3>
                <button onClick={closeModal} className="text-gray-400 hover:text-white">Fermer</button>
              </div>

              {modalError && (
                <div className="mb-4 text-sm text-yellow-300">{modalError}</div>
              )}

              <div className="mb-4">
                <label htmlFor="file-upload" className="block text-sm text-gray-300 mb-2">Importer une image</label>
                <div className="flex items-center space-x-3">
                  <input id="file-upload" type="file" accept="image/*" onChange={handleUploadToUploadcare} className="text-sm text-gray-300" disabled={!!modalError || isUploading || isAnalyzing} />
                  {isUploading && <span className="text-gray-300 text-sm">Upload en cours...</span>}
                </div>
                {uploadUrl && (
                  <div className="mt-3">
                    <img src={uploadUrl} alt="preview" className="w-full rounded-lg object-cover" />
                  </div>
                )}
              </div>

              <div className="flex items-center justify-end space-x-3 mb-4">
                <button
                  type="button"
                  onClick={handleAnalyzeWithAI}
                  disabled={!uploadUrl || isAnalyzing}
                  className="px-4 py-2 bg-gradient-to-r from-primary-500 to-secondary-500 rounded-xl text-sm text-white"
                >
                  {isAnalyzing ? 'Analyse en cours...' : 'Analyser avec le coach IA'}
                </button>
              </div>

              {aiResult && <div className="mb-3 text-sm text-gray-300">{aiResult}</div>}

              {analysisTime && detectedMealType && (
                <div className="mb-3 text-sm text-gray-300">
                  <span className="text-white font-medium">Heure :</span> {analysisTime} — <span className="text-white font-medium">Type :</span> {detectedMealType}
                </div>
              )}

              {/* Detected foods editor */}
              {detectedFoods && detectedFoods.length > 0 && (
                <div className="space-y-3 mb-4">
                  <h4 className="text-white font-medium">Éléments détectés</h4>
                  {detectedFoods.map((f) => (
                    <div key={f.id} className="bg-dark-700/50 rounded-xl p-3">
                      <div className="flex items-center justify-between mb-2">
                        <strong className="text-white">{f.name}</strong>
                        <div className="text-xs text-gray-400">{f.calories} kcal • {f.protein} g P</div>
                      </div>
                      <div className="flex items-center space-x-2">
                        <input type="number" step="0.1" value={String(f.quantity)} onChange={(e) => updateFood(f.id, { quantity: Number(e.target.value) })} className="w-24 p-2 rounded-xl bg-dark-600 text-white" aria-label={`Quantité pour ${f.name}`} />
                        <select value={f.unit} onChange={(e) => updateFood(f.id, { unit: e.target.value })} className="p-2 rounded-xl bg-dark-600 text-white" aria-label={`Unité pour ${f.name}`}>
                          <option value="g">g</option>
                          <option value="louche">louche</option>
                          <option value="piece">piece</option>
                          <option value="serving">serving</option>
                        </select>
                        <button onClick={() => handleConvertItem(f.id)} className="ml-auto px-3 py-2 bg-dark-700 rounded-lg text-sm text-white">Convertir via coach</button>
                      </div>
                    </div>
                  ))}

                  {/* Bouton de sauvegarde manuelle (Corrigé) */}
                  <div className="flex justify-end mt-4">
                    <button
                      onClick={saveMeal}
                      disabled={mealSaving}
                      className="px-4 py-2 bg-green-600 rounded-xl text-sm text-white"
                    >
                      {mealSaving ? 'Sauvegarde...' : 'Sauvegarder les modifications'}
                    </button>
                  </div>
                </div>
              )}

              {!detectedFoods && aiResult && (
                <div className="mt-4 bg-dark-700/50 rounded-lg p-4 text-sm text-gray-200">
                  <pre className="whitespace-pre-wrap text-xs">{aiResult}</pre>
                  <h4 className="text-white font-medium mb-2">Réponse du coach</h4>
                </div>
              )}
            </div>
          </div>
        )}

        {/* --- NOUVEAU: modal pour prédiction Gemini --- */}
        {predictOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            {/* ... (code inchangé) ... */}
            <div className="w-full max-w-lg max-h-[85vh] overflow-auto bg-dark-800 rounded-2xl p-6 border border-gray-600/30">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-white font-bold">Prédire mon plateau (coach IA)</h3>
                <button onClick={() => setPredictOpen(false)} className="text-gray-400">Fermer</button>
              </div>

              <p className="text-gray-300 text-sm mb-3">Décris ce que tu prévois de manger (ex : "poulet crème et riz") et le coach te proposera des quantités en grammes selon ton reste de kcal/protéines.</p>

              <textarea value={predictInput} onChange={(e) => setPredictInput(e.target.value)} className="w-full p-3 rounded-xl bg-dark-700 text-white mb-3" rows={4} placeholder="Ex: Poulet crème et riz"></textarea>

              <div className="flex justify-end space-x-2 mb-3">
                <button onClick={() => { setPredictOpen(false); }} className="px-4 py-2 bg-dark-700 rounded-xl text-sm text-gray-300">Annuler</button>
                <button onClick={handlePredictWithAI} disabled={isPredicting || !predictInput.trim()} className="px-4 py-2 bg-gradient-to-r from-primary-500 to-secondary-500 rounded-xl text-sm text-white">
                  {isPredicting ? 'Prédiction...' : 'Demander au coach'}
                </button>
              </div>

              {predictResult && (
                <div>
                  {Array.isArray(predictResult) ? (
                    <div className="space-y-2">
                      {predictResult.map((item: any, idx: number) => (
                        <div key={idx} className="bg-dark-700/50 p-3 rounded-lg">
                          <div className="flex justify-between">
                            <span className="text-white font-medium">{item.name}</span>
                            <span className="text-gray-300">{item.quantity_g}g</span>
                          </div>
                          <div className="text-xs text-gray-400">{item.calories} kcal • {item.protein}g P</div>
                          {item.notes && <div className="text-xs text-gray-500 mt-1">{item.notes}</div>}
                        </div>
                      ))}
                      {/* Bouton Sauvegarder Prédiction (Corrigé) */}
                      <button
                        onClick={savePredictedAsMeal}
                        disabled={mealSaving}
                        className="w-full mt-3 px-4 py-2 bg-green-600 rounded-xl text-sm text-white"
                      >
                        {mealSaving ? 'Sauvegarde...' : 'Sauvegarder ce plateau'}
                      </button>
                    </div>
                  ) : (
                    <div className="text-yellow-300 text-sm">
                      <p>{predictResult.error}</p>
                      <pre className="text-xs whitespace-pre-wrap mt-2">{predictResult.raw ?? predictResult.details}</pre>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* --- modal créer plateau existant --- */}
        {createPlateOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            {/* ... (code inchangé) ... */}
            <div className="w-full max-w-lg max-h-[85vh] overflow-auto bg-dark-800 rounded-2xl p-6 border border-gray-600/30">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-white font-bold">Créer mon plateau (manuel)</h3>
                <button onClick={() => setCreatePlateOpen(false)} className="text-gray-400">Fermer</button>
              </div>
              <p className="text-gray-300 text-sm mb-3">Liste les aliments (ex: "Poulet", "Riz") et laisse le coach IA te proposer des grammes/macros basés sur tes calories restantes.</p>

              <div className="space-y-2 mb-3">
                {plateItems.map(item => (
                  <div key={item.id} className="flex items-center space-x-2">
                    <input
                      type="text"
                      value={item.name}
                      onChange={(e) => updatePlateItem(item.id, e.target.value)}
                      placeholder="Nom de l'aliment"
                      className="flex-1 p-3 rounded-xl bg-dark-700 text-white"
                    />
                    <button onClick={() => removePlateItem(item.id)} className="p-2 text-gray-500 hover:text-red-400">
                      <Trash2 size={18} />
                    </button>
                  </div>
                ))}
              </div>
              <button onClick={() => addPlateItem()} className="text-sm text-primary-400 mb-3">+ Ajouter un aliment</button>

              <div className="flex justify-end space-x-2 mb-3">
                <button onClick={() => setCreatePlateOpen(false)} className="px-4 py-2 bg-dark-700 rounded-xl text-sm text-gray-300">Annuler</button>
                <button onClick={suggestPlateGrams} disabled={isSuggesting || plateItems.every(i => !i.name.trim())} className="px-4 py-2 bg-gradient-to-r from-primary-500 to-secondary-500 rounded-xl text-sm text-white">
                  {isSuggesting ? 'Suggestion...' : 'Suggérer les quantités (IA)'}
                </button>
              </div>

              {plateError && <div className="text-yellow-300 text-sm mb-3">{plateError}</div>}

              {plateSuggestions && (
                <div>
                  <h4 className="text-white font-medium mb-2">Suggestions du coach :</h4>
                  <div className="space-y-2">
                    {plateSuggestions.map((item: any) => (
                      <div key={item.id} className="bg-dark-700/50 p-3 rounded-lg">
                        <div className="flex justify-between">
                          <span className="text-white font-medium">{item.name}</span>
                          <span className="text-gray-300">{item.quantity_g}g</span>
                        </div>
                        <div className="text-xs text-gray-400">{item.calories} kcal • {item.protein}g P</div>
                        {item.notes && <div className="text-xs text-gray-500 mt-1">{item.notes}</div>}
                      </div>
                    ))}
                    {/* Bouton Sauvegarder Plateau (Corrigé) */}
                    <button
                      onClick={savePlate}
                      disabled={mealSaving}
                      className="w-full mt-3 px-4 py-2 bg-green-600 rounded-xl text-sm text-white"
                    >
                      {mealSaving ? 'Sauvegarde...' : 'Sauvegarder ce plateau'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Confirmation modal for deletion */}
      {confirmDeleteId && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/60 p-4">
          {/* ... (code inchangé) ... */}
          <div className="w-full max-w-sm bg-dark-800 rounded-2xl p-6 border border-gray-600/30">
            <h3 className="text-white font-bold mb-3">Confirmer la suppression</h3>
            <p className="text-gray-300 text-sm mb-4">
              Es-tu sûr de vouloir supprimer ce repas ? Cette action est irréversible.
            </p>
            <div className="flex justify-end space-x-2">
              <button
                onClick={() => setConfirmDeleteId(null)}
                className="px-4 py-2 bg-dark-700 rounded-xl text-sm text-gray-300"
              >
                Annuler
              </button>
              <button
                onClick={confirmDelete}
                disabled={confirmLoading}
                className="px-4 py-2 bg-red-600 rounded-xl text-sm text-white"
              >
                {confirmLoading ? 'Suppression...' : 'Confirmer'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- NOUVEAU (Req 5): Modal Chat Coach --- */}
      {coachChatOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          {/* ... (code inchangé) ... */}
          <div className="w-full max-w-lg max-h-[85vh] bg-dark-800 rounded-2xl border border-gray-600/30 flex flex-col">
            <div className="flex items-center justify-between p-4 border-b border-gray-700">
              <h3 className="text-white font-bold">Coach Nutritionnel IA</h3>
              <button onClick={() => setCoachChatOpen(false)} className="text-gray-400">Fermer</button>
            </div>

            {/* Zone de chat */}
            <div className="flex-1 p-4 space-y-3 overflow-y-auto">
              {chatMessages.map((msg, idx) => (
                <div key={idx} className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`p-3 rounded-xl max-w-xs ${msg.sender === 'user' ? 'bg-primary-600 text-white' : 'bg-dark-700 text-gray-200'}`}>
                    {msg.text}
                  </div>
                </div>
              ))}
              {isChatting && (
                <div className="flex justify-start">
                  <div className="p-3 rounded-xl bg-dark-700 text-gray-400">...</div>
                </div>
              )}
            </div>

            {/* Suggestion de repas */}
            {suggestedMeal && Array.isArray(suggestedMeal) && (
              <div className="p-4 border-t border-gray-700 bg-dark-900/50">
                <h4 className="text-white text-sm font-medium mb-2">Suggestion du coach :</h4>
                <ul className="space-y-1">
                  {suggestedMeal.map((item: any, idx: number) => (
                    <li key={idx} className="text-xs text-gray-300 flex justify-between">
                      <span>{item.name} ({item.quantity_g}g)</span>
                      <span>{item.calories} kcal / {item.protein}g P</span>
                    </li>
                  ))}
                </ul>
                <button
                  onClick={saveSuggestedMeal}
                  disabled={mealSaving}
                  className="w-full mt-3 px-4 py-2 bg-green-600 rounded-xl text-sm text-white disabled:opacity-60"
                >
                  {mealSaving ? 'Sauvegarde...' : "Ajouter ce repas à mon journal"}
                </button>
              </div>
            )}

            {/* Zone de saisie */}
            <div className="p-4 border-t border-gray-700 flex space-x-2">
              <input
                type="text"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && !isChatting && handleChatSend()}
                placeholder="Pose ta question..."
                className="flex-1 p-3 rounded-xl bg-dark-700 text-white"
                disabled={isChatting}
              />
              <button
                onClick={handleChatSend}
                disabled={isChatting}
                className="px-4 py-2 bg-gradient-to-r from-primary-500 to-secondary-500 rounded-xl text-white"
              >
                Envoyer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- NOUVEAU: Modal de modification de repas (Version Améliorée) --- */}
      {editModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-lg max-h-[90vh] bg-dark-800 rounded-2xl border border-gray-600/30 flex flex-col">
            
            {/* --- En-tête --- */}
            <div className="flex items-center justify-between p-4 border-b border-gray-700 flex-shrink-0">
              <h3 className="text-white font-bold text-lg">Modifier le repas</h3>
              <button onClick={() => setEditModalOpen(null)} className="text-gray-400 hover:text-white text-2xl">&times;</button>
            </div>

            {/* --- Contenu scrollable --- */}
            <div className="flex-1 p-6 overflow-y-auto space-y-4">
              {/* Prévisualisation image (si elle existe) */}
              {editModalOpen.beforePhoto && (
                <img 
                  src={editModalOpen.beforePhoto} 
                  alt="Aperçu du repas" 
                  className="w-full h-40 object-cover rounded-xl mb-2" 
                />
              )}
              
              <p className="text-sm text-gray-400 -mt-2 mb-4">
                {/* Sécurisation de l'affichage de la date */}
                Repas du {editModalOpen.createdAt?.seconds ? new Date(editModalOpen.createdAt.seconds * 1000).toLocaleDateString('fr-FR') : 'Date inconnue'} à {editModalOpen.time}
              </p>
              
              <h4 className="text-white font-medium">Éléments du repas</h4>
                
              {editedFoods && editedFoods.map((food, index) => (
                <div key={index} className="bg-dark-700/60 rounded-xl p-4 space-y-3 relative border border-gray-700">
                  {/* Bouton Supprimer l'aliment */}
                  <button 
                    onClick={() => removeEditedFood(index)}
                    className="absolute -top-2 -right-2 p-1 bg-red-600 rounded-full text-white hover:bg-red-500"
                    aria-label="Supprimer cet aliment"
                  >
                    <Trash2 size={14} />
                  </button>
                  
                  {/* Nom de l'aliment */}
                  <input 
                    type="text"
                    value={food.name || ''}
                    onChange={(e) => updateEditedFood(index, { name: e.target.value })}
                    placeholder="Nom de l'aliment"
                    className="w-full p-2 rounded-lg bg-dark-600 border border-gray-600 text-white font-semibold focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                  {/* Métriques */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="relative">
                      <input 
                        type="number"
                        value={String(food.quantity ?? '')} // Utiliser String() pour gérer 0
                        onChange={(e) => updateEditedFood(index, { quantity: Number(e.target.value) })}
                        placeholder="Qté"
                        className="w-full p-2 rounded-lg bg-dark-600 border border-gray-600 text-white pl-8 focus:outline-none focus:ring-2 focus:ring-primary-500"
                      />
                      <span className="absolute left-2.5 top-2.5 text-gray-400 text-sm">#</span>
                    </div>
                    <select
                      value={food.unit || 'g'}
                      onChange={(e) => updateEditedFood(index, { unit: e.target.value })}
                      className="w-full p-2 rounded-lg bg-dark-600 border border-gray-600 text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
                    >
                      <option value="g">g</option>
                      <option value="ml">ml</option>
                      <option value="pièce">pièce</option>
                      <option value="louche">louche</option>
                      <option value="portion">portion</option>
                    </select>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="relative">
                      <input 
                        type="number"
                        value={String(food.calories ?? '')}
                        onChange={(e) => updateEditedFood(index, { calories: Number(e.target.value) })}
                        placeholder="Kcal"
                        className="w-full p-2 rounded-lg bg-dark-600 border border-gray-600 text-white pl-8 focus:outline-none focus:ring-2 focus:ring-primary-500"
                      />
                      <span className="absolute left-2.5 top-2.5 text-gray-400 text-sm">🔥</span>
                    </div>
                     <div className="relative">
                      <input 
                        type="number"
                        value={String(food.protein ?? '')}
                        onChange={(e) => updateEditedFood(index, { protein: Number(e.target.value) })}
                        placeholder="Prot (g)"
                        className="w-full p-2 rounded-lg bg-dark-600 border border-gray-600 text-white pl-8 focus:outline-none focus:ring-2 focus:ring-primary-500"
                      />
                      <span className="absolute left-2.5 top-2.5 text-gray-400 text-sm">💪</span>
                    </div>
                  </div>
                </div>
              ))}
              
              {/* Bouton Ajouter */}
              <button
                onClick={addEditedFood}
                className="w-full py-2 border-2 border-dashed border-gray-600 rounded-lg text-gray-400 hover:border-primary-500 hover:text-primary-500 transition-colors"
              >
                + Ajouter un aliment
              </button>

            </div>

            {/* --- Pied de page (Totaux et Boutons) --- */}
            <div className="p-6 bg-dark-900/50 border-t border-gray-700 flex-shrink-0">
              {/* Totaux */}
              <div className="flex justify-between items-center mb-4">
                <span className="text-white font-semibold text-lg">Nouveau total :</span>
                <div className="text-right">
                  <p className="text-primary-400 font-bold text-xl">{editTotals.calories} kcal</p>
                  <p className="text-secondary-400 font-medium">{editTotals.protein}g Protéines</p>
                </div>
              </div>
              
              {/* Boutons d'action */}
              <div className="flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => setEditModalOpen(null)}
                  className="px-5 py-2.5 bg-dark-700 rounded-xl text-sm font-medium text-gray-300 hover:bg-dark-600"
                >
                  Annuler
                </button>
                <button
                  type="button"
                  onClick={handleSaveEdit}
                  disabled={mealSaving}
                  className="px-5 py-2.5 bg-green-600 rounded-xl text-sm font-medium text-white disabled:opacity-50 hover:bg-green-500"
                >
                  {mealSaving ? 'Sauvegarde...' : 'Sauvegarder'}
                </button>
              </div>
            </div>

          </div>
        </div>
      )}
    </>
  );
};