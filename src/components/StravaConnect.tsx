// src/components/StravaConnect.tsx
import { Activity } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext'; // On l'utilise pour savoir s'il est déjà connecté

export const StravaConnect = () => {
  const { user } = useAuth();

  // On vérifie si l'utilisateur a déjà des données Strava synchronisées
  const isConnected = !!(user as any)?.daily?.stravaLastSync;

  if (isConnected) {
    const lastSyncDate = new Date((user as any).daily.stravaLastSync).toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
    return (
      <div className="bg-dark-800/50 backdrop-blur-sm rounded-2xl p-4 border border-green-500/30">
        <div className="flex items-center space-x-3">
          <Activity size={24} className="text-green-400" />
          <div>
            <p className="text-white font-medium">Strava Connecté !</p>
            <p className="text-gray-400 text-sm">
              Dernière synchro: {lastSyncDate}
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Si pas connecté, on affiche le bouton
  
  // 1. Lire les variables d'environnement
  const clientId = import.meta.env.VITE_STRAVA_CLIENT_ID;
  const redirectUri = import.meta.env.VITE_STRAVA_REDIRECT_URI;
  
  // 2. Définir les "scopes" (ce qu'on veut lire)
  // 'activity:read' est nécessaire pour les calories et les activités
  const scope = 'activity:read';
  
  // 3. Construire l'URL d'autorisation
  const authUrl = `https://www.strava.com/oauth/authorize?client_id=${clientId}&redirect_uri=${encodeURIComponent(
    redirectUri
  )}&response_type=code&scope=${encodeURIComponent(scope)}`;

  return (
    <a
      href={authUrl}
      className="block bg-orange-600 hover:bg-orange-700 text-white font-bold py-3 px-4 rounded-xl text-center transition-colors duration-200"
    >
      <div className="flex items-center justify-center space-x-2">
        <Activity size={20} />
        <span>Connecter Strava</span>
      </div>
    </a>
  );
};