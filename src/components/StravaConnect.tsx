// src/components/StravaConnect.tsx

import { useAuth } from '../contexts/AuthContext';
import { CheckCircle } from 'lucide-react'; // Ajout de l'icône

// L'URL de l'image Strava (vous pouvez la garder ou la supprimer si vous préférez)
const stravaIconUrl = "https://kiviatgo.netlify.app/strava_icon.png"; // Assurez-vous que ce lien est correct

export const StravaConnect = () => {
  const { user } = useAuth();

  const handleConnect = () => {
    // Portée : lire les activités
    const scope = 'activity:read'; 
    // L'URL de redirection (là où Strava renvoie l'utilisateur)
    // Doit correspondre EXACTEMENT à ce qui est configuré dans votre app Strava
    const redirectUri = window.location.origin + '/strava-auth'; 
    
    // Votre Client ID Strava (doit être dans les variables d'environnement VITE)
    const clientId = (import.meta as any).env.VITE_STRAVA_CLIENT_ID;

    if (!clientId) {
      console.error("VITE_STRAVA_CLIENT_ID n'est pas défini !");
      alert("Erreur: La connexion Strava n'est pas configurée (CLIENT_ID manquant).");
      return;
    }

    const authUrl = `https://www.strava.com/oauth/authorize?client_id=${clientId}&response_type=code&redirect_uri=${encodeURIComponent(redirectUri)}&approval_prompt=auto&scope=${encodeURIComponent(scope)}`;
    
    // Redirige l'utilisateur vers la page d'autorisation Strava
    window.location.href = authUrl;
  };

  const hasStrava = user?.daily?.stravaLastSync;
  const lastSyncDate = hasStrava ? new Date(user.daily.stravaLastSync) : null;

  // --- DÉBUT DE LA MODIFICATION ---

  if (hasStrava && lastSyncDate) {
    // CAS 1: Déjà connecté -> Afficher le statut ET le bouton "Resynchroniser"
    return (
      <div className="flex items-center justify-between">
        {/* Partie gauche : Statut */}
        <div className="flex items-center space-x-3">
          <CheckCircle size={20} className="text-green-400 flex-shrink-0" />
          <div>
            <p className="text-white font-medium">Connecté à Strava</p>
            <p className="text-gray-400 text-sm">
              Dernière synchro: {lastSyncDate.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
            </p>
          </div>
        </div>

        {/* Partie droite : Bouton Resynchroniser */}
        <button
          onClick={handleConnect} // On réutilise la même fonction de connexion
          className="px-4 py-2 bg-dark-700 text-white text-sm rounded-xl hover:bg-dark-600 transition-colors flex-shrink-0"
        >
          Resynchroniser
        </button>
      </div>
    );
  } else {
    // CAS 2: Pas connecté -> Afficher le bouton de connexion
    return (
      <button
        onClick={handleConnect}
        className="w-full bg-[#FC4C02] text-white font-bold py-3 px-4 rounded-2xl flex items-center justify-center space-x-2 transition-opacity duration-200 hover:opacity-90"
      >
        <img src={stravaIconUrl} alt="Strava" className="w-6 h-6" />
        <span>Connecter Strava</span>
      </button>
    );
  }
  // --- FIN DE LA MODIFICATION ---
};