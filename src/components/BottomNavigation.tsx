import { Link } from 'react-router-dom';
import { Hop as Home, UtensilsCrossed, TrendingUp, User } from 'lucide-react';
import { motion } from 'framer-motion';

interface BottomNavigationProps {
  currentPath: string;
}

export const BottomNavigation = ({ currentPath }: BottomNavigationProps) => {
  const navItems = [
    { path: '/', icon: Home, label: 'Progrès' },
    { path: '/meals', icon: UtensilsCrossed, label: 'Repas' },
    { path: '/charts', icon: TrendingUp, label: 'Graphiques' },
    { path: '/profile', icon: User, label: 'Profil' },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-dark-800/90 backdrop-blur-lg border-t border-dark-600">
      <div className="flex justify-around items-center py-2">
        {navItems.map(({ path, icon: Icon, label }) => {
          const isActive = currentPath === path;
          
          return (
            <Link
              key={path}
              to={path}
              className="flex flex-col items-center p-3 relative"
            >
              {isActive && (
                <motion.div
                  layoutId="activeTab"
                  className="absolute inset-0 bg-primary-500/20 rounded-xl"
                  initial={false}
                  transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                />
              )}
              <Icon 
                size={24} 
                className={`mb-1 ${
                  isActive ? 'text-primary-400' : 'text-gray-400'
                }`} 
              />
              <span 
                className={`text-xs ${
                  isActive ? 'text-primary-400 font-medium' : 'text-gray-400'
                }`}
              >
                {label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
};