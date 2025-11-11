// netlify/functions/strava-token-exchange.ts

import { Handler, HandlerEvent, HandlerContext } from "@netlify/functions";

// Fonction pour calculer le timestamp d'il y a 24 heures (en secondes)
const getTimestamp24HoursAgo = () => {
  return Math.floor((Date.now() - 24 * 60 * 60 * 1000) / 1000);
};

const CLIENT_ID = process.env.VITE_STRAVA_CLIENT_ID;
const CLIENT_SECRET = process.env.VITE_STRAVA_CLIENT_SECRET;

// Helper pour récupérer les activités (on va l'utiliser 2 fois)
const fetchActivities = async (accessToken: string) => {
  const activitiesResponse = await fetch(
    `https://www.strava.com/api/v3/athlete/activities?after=${getTimestamp24HoursAgo()}`,
    {
      headers: { Authorization: `Bearer ${accessToken}` },
    }
  );

  if (!activitiesResponse.ok) {
    throw new Error('Failed to fetch Strava activities');
  }

  const activities: any[] = await activitiesResponse.json();

  let totalCalories = 0;
  let lastSync = new Date().toISOString();

  if (activities.length > 0) {
    totalCalories = activities.reduce((sum, act) => sum + (act.calories || 0), 0);
    // Trouve la date de début de l'activité la plus récente
    lastSync = activities.sort((a, b) => new Date(b.start_date).getTime() - new Date(a.start_date).getTime())[0].start_date;
  }
  
  return { totalCalories, lastSync };
};


const handler: Handler = async (event: HandlerEvent, context: HandlerContext) => {
  if (!event.body) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Missing body' }) };
  }
  if (!CLIENT_ID || !CLIENT_SECRET) {
     return { statusCode: 500, body: JSON.stringify({ error: 'Strava credentials not configured on server' }) };
  }

  const { code, refreshToken } = JSON.parse(event.body);

  try {
    let tokenData: any;
    
    // --- NOUVELLE LOGIQUE ---
    if (code) {
      // SCÉNARIO 1: Échange du code (première connexion)
      const response = await fetch('https://www.strava.com/oauth/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          client_id: CLIENT_ID,
          client_secret: CLIENT_SECRET,
          code: code,
          grant_type: 'authorization_code', // On demande le code
        }),
      });
      if (!response.ok) {
        const errorData = await response.json();
        return { statusCode: 400, body: JSON.stringify({ error: `Strava token error: ${errorData.message || 'Bad Request'}` }) };
      }
      tokenData = await response.json();

    } else if (refreshToken) {
      // SCÉNARIO 2: Rafraîchissement du token (synchronisations suivantes)
      const response = await fetch('https://www.strava.com/oauth/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          client_id: CLIENT_ID,
          client_secret: CLIENT_SECRET,
          refresh_token: refreshToken,
          grant_type: 'refresh_token', // On demande le rafraîchissement
        }),
      });
      if (!response.ok) {
        const errorData = await response.json();
        return { statusCode: 400, body: JSON.stringify({ error: `Strava refresh token error: ${errorData.message || 'Bad Request'}` }) };
      }
      tokenData = await response.json();
    } else {
      return { statusCode: 400, body: JSON.stringify({ error: 'Missing code or refreshToken' }) };
    }
    // --- FIN DE LA NOUVELLE LOGIQUE ---

    const accessToken = tokenData.access_token;
    const newRefreshToken = tokenData.refresh_token; // Strava renvoie un nouveau refresh token
    
    // Récupérer les activités (fonction helper)
    const { totalCalories, lastSync } = await fetchActivities(accessToken);

    return {
      statusCode: 200,
      body: JSON.stringify({
        totalCalories: Math.round(totalCalories),
        lastSync: lastSync,
        refreshToken: newRefreshToken, // IMPORTANT: On le renvoie au client
      }),
    };

  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: (error as Error).message || 'Server error' }),
    };
  }
};

export { handler };