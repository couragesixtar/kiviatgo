import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { ArrowRight, ArrowLeft, Camera, Upload, CircleCheck as CheckCircle } from 'lucide-react';

interface CalibrationProps {
  onNext: (data: { calibrationPhoto?: string }) => void;
  onBack: () => void;
  initialData?: any;
  onUpdate?: (data: any) => void;
}

export const Calibration = ({ onNext, onBack, initialData, onUpdate }: CalibrationProps) => {
  const [photoUploaded, setPhotoUploaded] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isValidating, setIsValidating] = useState(false);
  const [validationMsg, setValidationMsg] = useState<string | null>(null);

  useEffect(() => {
    if (initialData?.calibrationPhoto) {
      setPhotoUploaded(true);
    }
  }, [initialData]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploading(true);
    setValidationMsg(null);
    try {
      // upload to ImgBB
      const apiKey = (import.meta as any).env?.VITE_IMGBB_KEY ?? '7d609caa0a6667338f1bcbb8bcc5df90';
      const formData = new FormData();
      formData.append('image', file);

      const res = await fetch(`https://api.imgbb.com/1/upload?key=${encodeURIComponent(apiKey)}`, {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) {
        const bodyText = await res.text().catch(() => '');
        throw new Error(`ImgBB error ${res.status}. Réponse: ${bodyText.slice(0,300)}`);
      }

      const json = await res.json().catch(async () => {
        const bodyText = await res.text().catch(() => '');
        throw new Error(`Réponse inattendue d'ImgBB (non JSON). ${bodyText.slice(0,300)}`);
      });

      if (!json || !json.success) throw new Error('ImgBB réponse invalide.');

      const url = json?.data?.url || json?.data?.display_url || json?.data?.image?.url;
      if (!url) throw new Error('Impossible d\'extraire le lien image depuis la réponse ImgBB.');

      // validate with Gemini (primary image part approach)
      setIsValidating(true);
      const model = (import.meta as any).env?.VITE_GENAI_MODEL ?? 'gemini-2.5-flash';
      const apiKeyGen = (import.meta as any).env?.VITE_GENAI_KEY ?? undefined;
      const timeoutMs = 7000;

      try {
        const mod = await import('@google/genai').catch(() => null);
        if (!mod || !(mod as any).GoogleGenAI) throw new Error('IA indisponible');
        const { GoogleGenAI, createUserContent, createPartFromUri } = mod as any;
        const ai = new GoogleGenAI(apiKeyGen ? { apiKey: apiKeyGen } : {});
        let imagePart: any;
        try {
          const uploaded = await ai.files.upload({ file: url });
          imagePart = createPartFromUri(uploaded.uri, uploaded.mimeType);
        } catch {
          imagePart = createPartFromUri(url, 'image/*');
        }

        const prompt = [
          "Vérifie si cette photo est une calibration correcte : assiette vide + pièce de 1€ ou carte visible. Réponds 'OK' ou 'NOT_OK' puis une courte explication.",
          imagePart
        ];

        const call = ai.models.generateContent({ model, contents: [createUserContent(prompt)] });
        const response: any = await Promise.race([
          call,
          new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), timeoutMs))
        ]);
        const text = response?.text ?? response?.output?.[0]?.content ?? String(response);
        const normalized = String(text).toLowerCase();

        if (/ok|oui|valide|acceptable|good|yes/.test(normalized)) {
          setPhotoUploaded(true);
          setValidationMsg('Calibration validée par le coach.');
          if (onUpdate) onUpdate({ calibrationPhoto: url });
        } else {
          const explanation = text.split('\n').slice(0,2).join(' ').slice(0,400);
          setPhotoUploaded(false);
          setValidationMsg(`Calibration refusée : ${explanation}`);
        }
      } catch (aiErr: any) {
        console.warn('AI validation primary failed', aiErr);

        // fallback simple text prompt with URL
        try {
          const mod2 = await import('@google/genai').catch(() => null);
          if (!mod2 || !(mod2 as any).GoogleGenAI) throw new Error('IA indisponible');
          const { GoogleGenAI } = mod2 as any;
          const ai2 = new GoogleGenAI(apiKeyGen ? { apiKey: apiKeyGen } : {});
          const simplePrompt = `Regarde l'image à ${url}. Est-ce une calibration valide (assiette vide + pièce/carte visible) ? Réponds "OK" ou "NOT_OK" puis une brève explication.`;
          const call2 = ai2.models.generateContent({ model, contents: simplePrompt });
          const response2: any = await Promise.race([
            call2,
            new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), timeoutMs))
          ]);
          const text2 = response2?.text ?? response2?.output?.[0]?.content ?? String(response2);
          const normalized2 = String(text2).toLowerCase();
          if (/ok|oui|valide|acceptable|good|yes/.test(normalized2)) {
            setPhotoUploaded(true);
            setValidationMsg('Calibration validée par le coach.');
            if (onUpdate) onUpdate({ calibrationPhoto: url });
          } else {
            const explanation = String(text2).split('\n').slice(0,2).join(' ').slice(0,400);
            setPhotoUploaded(false);
            setValidationMsg(`Calibration refusée : ${explanation}`);
          }
        } catch (fallbackErr: any) {
          console.warn('AI validation fallback failed', fallbackErr);
          setValidationMsg("Hmm notre coach personnel n'est pas disponible actuellement — remplis ta calibration toi‑même et réessaie plus tard.");
        }
      }
    } catch (err: any) {
      console.warn('Upload failed', err);
      setValidationMsg(err?.message ?? 'Échec de l\'upload de la photo.');
    } finally {
      setIsUploading(false);
      setIsValidating(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onNext({ calibrationPhoto: photoUploaded ? (initialData?.calibrationPhoto ?? 'uploaded') : undefined });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-dark-900 via-dark-800 to-dark-700 flex items-center justify-center p-6">
      <motion.div
        initial={{ opacity: 0, x: 100 }}
        animate={{ opacity: 1, x: 0 }}
        className="w-full max-w-md"
      >
        <div className="text-center mb-8">
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.2, type: "spring", bounce: 0.5 }}
            className="text-6xl mb-4"
          >
            📸
          </motion.div>
          <h1 className="text-3xl font-bold text-white mb-2">
            On calibre ton assiette !
          </h1>
          <p className="text-gray-400">
            Photo de l'assiette + pièce de 1€ ou carte bancaire
          </p>
        </div>

        {/* Coach Tip */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="bg-gradient-to-r from-accent-orange/20 to-accent-pink/20 backdrop-blur-sm rounded-2xl p-4 mb-6 border border-accent-orange/30"
        >
          <p className="text-gray-300 text-sm text-center">
            La carte sert à la calibration, pas à payer ton repas 😅
          </p>
        </motion.div>

        <motion.form
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          onSubmit={handleSubmit}
          className="space-y-6"
        >
          {/* Upload Area */}
          <div className="relative">
            <input
              type="file"
              accept="image/*"
              onChange={handleFileUpload}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              id="photo-upload"
            />
            <label
              htmlFor="photo-upload"
              className={`block w-full h-48 border-2 border-dashed rounded-2xl flex flex-col items-center justify-center cursor-pointer transition-colors ${
                photoUploaded
                  ? 'border-primary-500 bg-primary-500/10'
                  : 'border-gray-600 bg-dark-800/50 hover:border-primary-500'
              }`}
            >
              {isUploading ? (
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                >
                  <Upload size={32} className="text-primary-400 mb-2" />
                </motion.div>
              ) : isValidating ? (
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                >
                  <Upload size={32} className="text-primary-400 mb-2" />
                </motion.div>
              ) : photoUploaded ? (
                <CheckCircle size={32} className="text-primary-400 mb-2" />
              ) : (
                <Camera size={32} className="text-gray-400 mb-2" />
              )}
              
              <p className="text-white font-medium mb-1">
                {isUploading
                  ? 'Upload en cours...'
                  : isValidating
                  ? 'Validation en cours...'
                  : photoUploaded
                  ? 'Photo uploadée ✅'
                  : 'Prendre une photo'
                }
              </p>
              <p className="text-gray-400 text-sm text-center px-4">
                {!photoUploaded && 'Assiette vide + pièce de 1€ ou carte bancaire pour l\'échelle'}
              </p>
            </label>
          </div>

          {/* Validation Message */}
          {validationMsg && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.6 }}
              className="bg-dark-800/50 rounded-2xl p-4 border border-gray-600/30"
            >
              <p className={`text-sm text-center ${photoUploaded ? 'text-green-400' : 'text-red-400'}`}>
                {validationMsg}
              </p>
            </motion.div>
          )}

          {/* Instructions */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6 }}
            className="bg-dark-800/50 rounded-2xl p-4 border border-gray-600/30"
          >
            <h3 className="text-white font-medium mb-2">Instructions :</h3>
            <ul className="text-gray-300 text-sm space-y-1">
              <li>• Place une pièce de 1€ ou une carte bancaire sur l'assiette</li>
              <li>• Prends la photo de dessus, bien centrée</li>
              <li>• Assure-toi que l'éclairage soit bon</li>
            </ul>
          </motion.div>

          <div className="flex space-x-4 mt-8">
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
            >
              <span>Suivant</span>
              <ArrowRight size={20} />
            </motion.button>
          </div>
        </motion.form>

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
            <div className="w-3 h-3 bg-primary-500 rounded-full"></div>
            <div className="w-3 h-3 bg-gray-600 rounded-full"></div>
          </div>
        </motion.div>

      </motion.div>
    </div>
  );
};