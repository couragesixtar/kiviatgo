// src/pages/StravaAuth.tsx

import { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Loader2 } from 'lucide-react';

const StravaAuth = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { updateUser } = useAuth();

  const [status, setStatus] = useState('Synchronisation en cours...');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const code = searchParams.get('code');
    const scope = searchParams.get('scope');

    const exchangeToken = async (code: string) => {
      try {
        setStatus('Appel de la fonction Netlify...');
        const response = await fetch('/.netlify/functions/strava-token-exchange', {
          method: 'POST',
          body: JSON.stringify({ code }),
        });

        console.log("Réponse reçue du serveur. Status:", response.status);
        console.log("Content-Type:", response.headers.get('content-type'));

        if (!response.ok) {
          const errorText = await response.text();
          console.error("Réponse d'erreur du serveur (en texte):", errorText);
          
          if (response.status === 404) {
            throw new Error("Fonction non trouvée (404). Vérifiez le déploiement Netlify.");
          } else {
            // Tenter de parser l'erreur JSON de Strava
            let stravaError = "Erreur inconnue";
            try {
              const errJson = JSON.parse(errorText);
              stravaError = errJson.error || JSON.stringify(errJson);
            } catch(e) {
              stravaError = errorText.substring(0, 150) + '...';
            }
            throw new Error(`Erreur serveur (${response.status}). Réponse: ${stravaError}`);
          }
        }

        const data = await response.json();
        
        setStatus('Mise à jour de votre profil...');
        
        // --- MODIFICATION : On récupère le refreshToken ---
        const { totalCalories, lastSync, refreshToken } = data;

        if (!refreshToken) {
          throw new Error("La réponse du serveur n'a pas fourni de refreshToken. Impossible de continuer.");
        }

        await updateUser({
          daily: {
            stravaRecentCalories: totalCalories,
            stravaLastSync: lastSync,
            stravaRefreshToken: refreshToken, // <-- ON LE SAUVEGARDE
          },
        });
        // --- FIN MODIFICATION ---

        setStatus('Synchronisation réussie !');
        navigate('/');

      } catch (err: any) {
        console.error("Erreur finale attrapée dans exchangeToken:", err);
        setError(err.message || 'Une erreur inconnue est survenue.');
      }
    };


    // Vérifier si l'utilisateur a bien autorisé ce qu'on demandait
    if (!scope || !scope.includes('activity:read')) {
      setError("L'autorisation de lire les activités est nécessaire.");
      return;
    }

    if (code) {
      exchangeToken(code); // On appelle notre nouvelle fonction
    } else {
      // L'utilisateur a peut-être cliqué "Annuler"
      setError('Autorisation Strava annulée ou code manquant.');
    }
  }, [searchParams, navigate, updateUser]); // Dépendances correctes

  // Si une erreur survient, on l'affiche et on propose de repartir
  if (error) {
    return (
      <div className="min-h-screen bg-dark-900 flex flex-col items-center justify-center p-6 text-center">
        <h2 className="text-2xl font-bold text-red-400 mb-4">Échec de la connexion</h2>
        <p className="text-gray-300 mb-6">{error}</p>
        <button
          onClick={() => navigate('/profile')} // On le renvoie au profil
          className="px-4 py-2 bg-primary-600 text-white rounded-xl"
        >
          Retour au Profil
        </button>
      </div>
    );
  }

  // Affichage de chargement pendant l'échange
  return (
    <div className="min-h-screen bg-dark-900 flex flex-col items-center justify-center p-6 text-center">
      <Loader2 size={48} className="text-primary-400 animate-spin mb-6" />
      <h2 className="text-2xl font-bold text-white mb-2">{status}</h2>
      <p className="text-gray-400">Veuillez patienter...</p>
    </div>
  );
};

export default StravaAuth;