import { motion } from 'framer-motion';
import { MessageCircle } from 'lucide-react';
import { useCoachTips } from '../hooks/useCoachTips';

export const CoachTip = () => {
  const tip = useCoachTips();

  if (!tip) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      key={tip}
      className="bg-gradient-to-r from-accent-orange/20 to-accent-pink/20 backdrop-blur-sm rounded-2xl p-4 mb-6 border border-accent-orange/30"
    >
      <div className="flex items-start space-x-3">
        <div className="bg-accent-orange/20 p-2 rounded-full">
          <MessageCircle size={20} className="text-accent-orange" />
        </div>
        <div>
          <h3 className="text-accent-orange font-medium text-sm mb-1">
            Astuce de Coach
          </h3>
          <p className="text-gray-300 text-sm leading-relaxed">
            {tip}
          </p>
        </div>
      </div>
    </motion.div>
  );
};