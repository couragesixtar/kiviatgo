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

    // --- DÉBUT DE LA VERSION MISE À JOUR ---
    // (J'ai remplacé la fonction exchangeToken par celle-ci)
    const exchangeToken = async (code: string) => {
      try {
        setStatus('Appel de la fonction Netlify...');
        const response = await fetch('/.netlify/functions/strava-token-exchange', {
          method: 'POST',
          body: JSON.stringify({ code }),
        });

        // --- NOUVEAUX LOGS ---
        console.log("Réponse reçue du serveur. Status:", response.status);
        console.log("Content-Type:", response.headers.get('content-type'));
        // --- FIN DES NOUVEAUX LOGS ---

        if (!response.ok) {
          // Si la réponse n'est pas OK (ex: 404, 500)
          // On lit la réponse comme du TEXTE pour voir ce que c'est
          const errorText = await response.text();
          console.error("Réponse d'erreur du serveur (en texte):", errorText);
          
          if (response.status === 404) {
            throw new Error("Fonction non trouvée (404). Le 'Base directory' sur Netlify est-il bien 'project' ?");
          } else {
            // Si c'est une autre erreur (ex: 500), on l'affiche
            throw new Error(`Erreur serveur (${response.status}). Réponse: ${errorText.substring(0, 150)}...`);
          }
        }

        // Si response.ok est true, on tente de lire le JSON
        const data = await response.json();
        
        setStatus('Mise à jour de votre profil...');
        const { totalCalories, lastSync } = data;

        await updateUser({
          daily: {
            stravaRecentCalories: totalCalories,
            stravaLastSync: lastSync,
          },
        });

        setStatus('Synchronisation réussie !');
        navigate('/');

      } catch (err: any) {
        console.error("Erreur finale attrapée dans exchangeToken:", err);
        // Affiche l'erreur (ex: "Fonction non trouvée (404)...")
        setError(err.message || 'Une erreur inconnue est survenue.');
      }
    };
    // --- FIN DE LA VERSION MISE À JOUR ---


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
  }, [searchParams, navigate, updateUser]);

  // Si une erreur survient, on l'affiche et on propose de repartir
  // Le message d'erreur sera maintenant beaucoup plus clair
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