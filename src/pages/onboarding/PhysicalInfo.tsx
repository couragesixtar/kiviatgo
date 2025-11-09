import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { ArrowRight, ArrowLeft, Ruler, Weight, Activity } from 'lucide-react';

interface PhysicalInfoProps {
  onNext: (data: { height: number; weight: number; bodyFat?: number; muscleMass?: number; boneMass?: number }) => void;
  onBack: () => void;
  initialData?: any;
  onUpdate?: (data: any) => void;
}

export const PhysicalInfo = ({ onNext, onBack, initialData, onUpdate }: PhysicalInfoProps) => {
  const [formData, setFormData] = useState({
    height: '',
    weight: '',
    bodyFat: '',
    muscleMass: '',
    boneMass: ''
  });

  useEffect(() => {
    if (!initialData) return;
    setFormData({
      height: initialData.height !== undefined ? String(initialData.height) : '',
      weight: initialData.weight !== undefined ? String(initialData.weight) : '',
      bodyFat: initialData.bodyFat !== undefined ? String(initialData.bodyFat) : '',
      muscleMass: initialData.muscleMass !== undefined ? String(initialData.muscleMass) : '',
      boneMass: initialData.boneMass !== undefined ? String(initialData.boneMass) : ''
    });
  }, [initialData]);

  const handleChange = (field: string, value: string) => {
    setFormData(prev => {
      const next = { ...prev, [field]: value };
      if (onUpdate) {
        const payload: any = {
          height: next.height ? parseFloat(next.height) : undefined,
          weight: next.weight ? parseFloat(next.weight) : undefined,
          bodyFat: next.bodyFat ? parseFloat(next.bodyFat) : undefined,
          muscleMass: next.muscleMass ? parseFloat(next.muscleMass) : undefined,
          boneMass: next.boneMass ? parseFloat(next.boneMass) : undefined,
        };
        onUpdate(payload);
      }
      return next;
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onNext({
      height: parseFloat(formData.height),
      weight: parseFloat(formData.weight),
      bodyFat: formData.bodyFat ? parseFloat(formData.bodyFat) : undefined,
      muscleMass: formData.muscleMass ? parseFloat(formData.muscleMass) : undefined,
      boneMass: formData.boneMass ? parseFloat(formData.boneMass) : undefined,
    });
  };

  const getProgressPercentage = () => {
    const requiredFields = ['height', 'weight'];
    const filledRequired = requiredFields.filter(field => formData[field as keyof typeof formData]).length;
    const optionalFields = ['bodyFat', 'muscleMass', 'boneMass'];
    const filledOptional = optionalFields.filter(field => formData[field as keyof typeof formData]).length;
    
    return ((filledRequired / requiredFields.length) * 60) + ((filledOptional / optionalFields.length) * 40);
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
            💪
          </motion.div>
          <h1 className="text-3xl font-bold text-white mb-2">
            OK champion, dis-moi qui tu es
          </h1>
          <p className="text-gray-400 mb-4">
            Renseigne tes infos physiques
          </p>
          
          {/* Progress Bar */}
          <div className="bg-dark-700 rounded-full h-2 mb-4">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${getProgressPercentage()}%` }}
              className="bg-gradient-to-r from-primary-500 to-secondary-500 h-full rounded-full"
              transition={{ duration: 0.5 }}
            />
          </div>
        </div>

        {/* Coach Tip */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="bg-gradient-to-r from-accent-orange/20 to-accent-pink/20 backdrop-blur-sm rounded-2xl p-4 mb-6 border border-accent-orange/30"
        >
          <p className="text-gray-300 text-sm text-center">
            Si t'as oublié ta masse grasse, t'inquiète — c'est pas comme ton ex, on peut la retrouver plus tard 😉
          </p>
        </motion.div>

        <motion.form
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          onSubmit={handleSubmit}
          className="space-y-4"
        >
          {/* Required Fields */}
          <div className="grid grid-cols-2 gap-4">
            <div className="relative">
              <Ruler size={20} className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400" />
              <input
                type="number"
                value={formData.height}
                onChange={(e) => handleChange('height', e.target.value)}
                placeholder="Taille (cm)"
                className="w-full bg-dark-800/50 border border-gray-600/30 rounded-2xl pl-12 pr-4 py-4 text-white placeholder-gray-400 focus:border-primary-500 focus:outline-none transition-colors"
                required
              />
            </div>
            <div className="relative">
              <Weight size={20} className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400" />
              <input
                type="number"
                step="0.1"
                value={formData.weight}
                onChange={(e) => handleChange('weight', e.target.value)}
                placeholder="Poids (kg)"
                className="w-full bg-dark-800/50 border border-gray-600/30 rounded-2xl pl-12 pr-4 py-4 text-white placeholder-gray-400 focus:border-primary-500 focus:outline-none transition-colors"
                required
              />
            </div>
          </div>

          {/* Optional Fields */}
          <div className="space-y-4">
            <p className="text-gray-400 text-sm text-center">Optionnel (en % sauf Taille et Poids)</p>
            
            <div className="relative">
              <Activity size={20} className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400" />
              <input
                type="number"
                step="0.1"
                value={formData.bodyFat}
                onChange={(e) => handleChange('bodyFat', e.target.value)}
                placeholder="Masse grasse (%)"
                className="w-full bg-dark-800/50 border border-gray-600/30 rounded-2xl pl-12 pr-4 py-4 text-white placeholder-gray-400 focus:border-secondary-500 focus:outline-none transition-colors"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="relative">
                <Activity size={20} className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400" />
                <input
                  type="number"
                  step="0.1"
                  value={formData.muscleMass}
                  onChange={(e) => handleChange('muscleMass', e.target.value)}
                  placeholder="Muscle (%)"
                  className="w-full bg-dark-800/50 border border-gray-600/30 rounded-2xl pl-12 pr-4 py-4 text-white placeholder-gray-400 focus:border-secondary-500 focus:outline-none transition-colors"
                />
              </div>
              <div className="relative">
                <Activity size={20} className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400" />
                <input
                  type="number"
                  step="0.1"
                  value={formData.boneMass}
                  onChange={(e) => handleChange('boneMass', e.target.value)}
                  placeholder="Os (%)"
                  className="w-full bg-dark-800/50 border border-gray-600/30 rounded-2xl pl-12 pr-4 py-4 text-white placeholder-gray-400 focus:border-secondary-500 focus:outline-none transition-colors"
                />
              </div>
            </div>
          </div>

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
            <div className="w-3 h-3 bg-primary-500 rounded-full"></div>
            <div className="w-3 h-3 bg-gray-600 rounded-full"></div>
            <div className="w-3 h-3 bg-gray-600 rounded-full"></div>
            <div className="w-3 h-3 bg-gray-600 rounded-full"></div>
          </div>
        </motion.div>
      </motion.div>
    </div>
  );
};