// src/components/StravaConnect.tsx
import { Activity } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext'; // On l'utilise pour savoir s'il est déjà connecté

export const StravaConnect = () => {
  const { user } = useAuth();

  // --- CORRECTION ---
  // On vérifie le REFRESH TOKEN, pas seulement la date de synchro.
  // C'est le token qui nous permet les synchros futures.
  const isConnected = !!(user as any)?.daily?.stravaRefreshToken; 
  const lastSync = (user as any)?.daily?.stravaLastSync;

  // On affiche "Connecté" SEULEMENT si on a le token ET une date de synchro
  if (isConnected && lastSync) {
    const lastSyncDate = new Date(lastSync).toLocaleDateString('fr-FR', {
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

  // Si on arrive ici, c'est que isConnected est false (pas de token).
  // On affiche le bouton de connexion, MÊME SI une ancienne synchro (stravaLastSync) existe.
  
  // 1. Lire les variables d'environnement
  const clientId = import.meta.env.VITE_STRAVA_CLIENT_ID;
  const redirectUri = import.meta.env.VITE_STRAVA_REDIRECT_URI;
  
  // 2. Définir les "scopes" (ce qu'on veut lire)
  // IMPORTANT: On demande 'activity:read_all' et 'refresh_token'
  const scope = 'activity:read_all,refresh_token';
  
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
        {/* Si 'lastSync' existe mais 'refreshToken' manque, on sait qu'il faut reconnecter */}
        <span>{lastSync ? 'Reconnecter Strava (Mise à jour)' : 'Connecter Strava'}</span>
      </div>
    </a>
  );
};