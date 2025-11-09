import { motion } from 'framer-motion';
import { Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer } from 'recharts';

interface KiviatChartProps {
  data: Array<{
    subject: string;
    A: number;
    fullMark: number;
  }>;
}

export const KiviatChart = ({ data }: KiviatChartProps) => {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay: 0.6, duration: 0.6 }}
      className="bg-dark-800/50 backdrop-blur-sm rounded-2xl p-6 border border-primary-500/30"
    >
      <h3 className="text-xl font-bold text-white mb-4">Objectifs Journaliers</h3>
      
      <div className="h-80">
        <ResponsiveContainer width="100%" height="100%">
          <RadarChart data={data}>
            <PolarGrid 
              stroke="#374151"
              strokeWidth={1}
            />
            <PolarAngleAxis 
              dataKey="subject" 
              tick={{ fill: '#9ca3af', fontSize: 12 }}
            />
            <PolarRadiusAxis
              angle={90}
              domain={[0, 100]}
              tick={{ fill: '#6b7280', fontSize: 10 }}
            />
            <Radar
              name="Progress"
              dataKey="A"
              stroke="#10b981"
              fill="#10b981"
              fillOpacity={0.3}
              strokeWidth={3}
            />
          </RadarChart>
        </ResponsiveContainer>
      </div>
    </motion.div>
  );
};