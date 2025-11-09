import { useState } from 'react';
import { motion } from 'framer-motion';
import { Mail, Lock, LogIn } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';

interface LoginProps {
  onSwitchToRegister: () => void;
}

export const Login = ({ onSwitchToRegister }: LoginProps) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { login } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    
    try {
      await login(email, password);
    } catch (error) {
      // If user doesn't exist, switch to register
      onSwitchToRegister();
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
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.2, type: "spring", bounce: 0.5 }}
            className="text-6xl mb-4"
          >
            🦋
          </motion.div>
          <h1 className="text-3xl font-bold text-white mb-2">
            Bon retour champion ! 👋
          </h1>
          <p className="text-gray-400">
            Connecte-toi pour continuer ton parcours
          </p>
        </div>

        <motion.form
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          onSubmit={handleSubmit}
          className="space-y-6"
        >
          <div className="relative">
            <Mail size={20} className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400" />
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Email"
              className="w-full bg-dark-800/50 border border-gray-600/30 rounded-2xl pl-12 pr-4 py-4 text-white placeholder-gray-400 focus:border-primary-500 focus:outline-none transition-colors"
              required
            />
          </div>

          <div className="relative">
            <Lock size={20} className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400" />
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Mot de passe"
              className="w-full bg-dark-800/50 border border-gray-600/30 rounded-2xl pl-12 pr-4 py-4 text-white placeholder-gray-400 focus:border-primary-500 focus:outline-none transition-colors"
              required
            />
          </div>

          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            type="submit"
            disabled={isLoading}
            className="w-full bg-gradient-to-r from-primary-500 to-secondary-500 text-white font-bold py-4 rounded-2xl flex items-center justify-center space-x-2 disabled:opacity-50"
          >
            <LogIn size={20} />
            <span>{isLoading ? 'Connexion...' : 'Se connecter'}</span>
          </motion.button>
        </motion.form>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="text-center mt-6"
        >
          <button
            onClick={onSwitchToRegister}
            className="text-primary-400 hover:text-primary-300 transition-colors"
          >
            Première fois ? Créer un compte →
          </button>
        </motion.div>
      </motion.div>
    </div>
  );
};