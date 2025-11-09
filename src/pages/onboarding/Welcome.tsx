import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { User, Mail, Lock, ArrowRight } from 'lucide-react';

interface WelcomeProps {
  onNext: (data: { firstName: string; lastName: string; email: string; password: string; age?: number }) => Promise<void>;
  onCancel?: () => void;
  initialData?: any;
  onUpdate?: (data: any) => void;
}

export const Welcome = ({ onNext, onCancel, initialData, onUpdate }: WelcomeProps) => {
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    password: '',
    age: ''
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<{ firstName?: string; lastName?: string; email?: string; password?: string; age?: string }>({});

  useEffect(() => {
    if (!initialData) return;
    setFormData(prev => ({
      firstName: initialData.firstName ?? prev.firstName,
      lastName: initialData.lastName ?? prev.lastName,
      email: initialData.email ?? prev.email,
      password: '', // never prefill password
      age: initialData.age !== undefined ? String(initialData.age) : prev.age
    }));
  }, [initialData]);

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  const validate = () => {
    const errs: typeof fieldErrors = {};
    if (!formData.firstName.trim()) errs.firstName = "Le prénom est requis.";
    if (!formData.lastName.trim()) errs.lastName = "Le nom est requis.";
    if (!formData.email.trim() || !emailRegex.test(formData.email)) errs.email = "Email invalide.";
    if (!formData.password || formData.password.length < 6) errs.password = "Mot de passe : minimum 6 caractères.";
    const ageNum = formData.age ? parseInt(formData.age, 10) : NaN;
    if (!formData.age || isNaN(ageNum) || ageNum <= 0) errs.age = "Âge invalide.";
    setFieldErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    setFieldErrors(prev => ({ ...prev, [field]: undefined }));

    // Ne PAS propager le password pendant la frappe
    if (onUpdate && field !== 'password') {
      if (field === 'age') {
        const ageNum = value ? parseInt(value, 10) : undefined;
        onUpdate({ age: ageNum });
      } else {
        onUpdate({ [field]: value });
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!validate()) return;
    setIsLoading(true);
    try {
      await onNext({
        firstName: formData.firstName,
        lastName: formData.lastName,
        email: formData.email,
        password: formData.password,
        age: formData.age ? parseInt(formData.age, 10) : undefined
      });
      // OnboardingFlow gère la navigation en cas de succès
    } catch (err: any) {
      setError(err?.message || 'Erreur inconnue, réessaie.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-dark-900 via-dark-800 to-dark-700 flex items-center justify-center p-6">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md"
      >
        <div className="text-center mb-8">
          <motion.div
            initial={{ scale: 0, rotate: -180 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ delay: 0.2, type: "spring", bounce: 0.6 }}
            className="text-6xl mb-4"
          >
            🦋
          </motion.div>
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="text-3xl font-bold text-white mb-2"
          >
            Bienvenue jeune sportif ! 👋
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="text-gray-400"
          >
            Prêt à transformer ton assiette ?
          </motion.p>
        </div>

        <motion.form
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
          onSubmit={handleSubmit}
          className="space-y-4"
        >
          <div className="grid grid-cols-2 gap-4">
            <div className="relative">
              <User size={20} className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                value={formData.firstName}
                onChange={(e) => handleChange('firstName', e.target.value)}
                placeholder="Prénom"
                className="w-full bg-dark-800/50 border border-gray-600/30 rounded-2xl pl-12 pr-4 py-4 text-white placeholder-gray-400 focus:border-primary-500 focus:outline-none transition-colors"
                required
              />
              {fieldErrors.firstName && <p className="text-red-400 text-xs mt-1">{fieldErrors.firstName}</p>}
            </div>
            <div className="relative">
              <User size={20} className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                value={formData.lastName}
                onChange={(e) => handleChange('lastName', e.target.value)}
                placeholder="Nom"
                className="w-full bg-dark-800/50 border border-gray-600/30 rounded-2xl pl-12 pr-4 py-4 text-white placeholder-gray-400 focus:border-primary-500 focus:outline-none transition-colors"
                required
              />
              {fieldErrors.lastName && <p className="text-red-400 text-xs mt-1">{fieldErrors.lastName}</p>}
            </div>
          </div>

          <div className="relative">
            <Mail size={20} className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400" />
            <input
              type="email"
              value={formData.email}
              onChange={(e) => handleChange('email', e.target.value)}
              placeholder="Email"
              className="w-full bg-dark-800/50 border border-gray-600/30 rounded-2xl pl-12 pr-4 py-4 text-white placeholder-gray-400 focus:border-primary-500 focus:outline-none transition-colors"
              required
            />
            {fieldErrors.email && <p className="text-red-400 text-xs mt-1">{fieldErrors.email}</p>}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="relative">
              <Lock size={20} className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400" />
              <input
                type="password"
                value={formData.password}
                onChange={(e) => handleChange('password', e.target.value)}
                placeholder="Mot de passe"
                className="w-full bg-dark-800/50 border border-gray-600/30 rounded-2xl pl-12 pr-4 py-4 text-white placeholder-gray-400 focus:border-primary-500 focus:outline-none transition-colors"
                required
              />
              {fieldErrors.password && <p className="text-red-400 text-xs mt-1">{fieldErrors.password}</p>}
            </div>

            <div className="relative">
              <User size={20} className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400" />
              <input
                type="number"
                value={formData.age}
                onChange={(e) => handleChange('age', e.target.value)}
                placeholder="Âge"
                className="w-full bg-dark-800/50 border border-gray-600/30 rounded-2xl pl-12 pr-4 py-4 text-white placeholder-gray-400 focus:border-secondary-500 focus:outline-none transition-colors"
                required
              />
              {fieldErrors.age && <p className="text-red-400 text-xs mt-1">{fieldErrors.age}</p>}
            </div>
          </div>

          {error && (
            <div className="text-red-400 text-sm text-center">{error}</div>
          )}

          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            type="submit"
            disabled={isLoading}
            className="w-full bg-gradient-to-r from-primary-500 to-secondary-500 text-white font-bold py-4 rounded-2xl flex items-center justify-center space-x-2 mt-8 disabled:opacity-60"
          >
            <span>{isLoading ? 'Création...' : 'Suivant'}</span>
            <ArrowRight size={20} />
          </motion.button>

          {onCancel && (
            <div className="text-center mt-3">
              <button
                type="button"
                onClick={onCancel}
                className="text-primary-400 hover:text-primary-300 transition-colors text-sm"
              >
                Déjà un compte ? Se connecter →
              </button>
            </div>
          )}
        </motion.form>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1 }}
          className="text-center mt-6"
        >
          <div className="flex justify-center space-x-2">
            <div className="w-3 h-3 bg-primary-500 rounded-full"></div>
            <div className="w-3 h-3 bg-gray-600 rounded-full"></div>
            <div className="w-3 h-3 bg-gray-600 rounded-full"></div>
            <div className="w-3 h-3 bg-gray-600 rounded-full"></div>
            <div className="w-3 h-3 bg-gray-600 rounded-full"></div>
          </div>
        </motion.div>
      </motion.div>
    </div>
  );
};