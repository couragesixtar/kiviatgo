import { motion } from 'framer-motion';
import { ReactNode } from 'react';

interface StatsCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: ReactNode;
  gradient: string;
  delay?: number;
}

export const StatsCard = ({ 
  title, 
  value, 
  subtitle, 
  icon, 
  gradient,
  delay = 0 
}: StatsCardProps) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.5 }}
      className={`bg-gradient-to-r ${gradient} rounded-2xl p-6 shadow-lg border border-white/10`}
    >
      <div className="flex items-center justify-between mb-4">
        <div className="bg-white/20 p-3 rounded-full">
          {icon}
        </div>
      </div>
      
      <div>
        <h3 className="text-white/80 text-sm font-medium mb-1">{title}</h3>
        <p className="text-white text-2xl font-bold mb-1">{value}</p>
        {subtitle && (
          <p className="text-white/70 text-xs">{subtitle}</p>
        )}
      </div>
    </motion.div>
  );
};