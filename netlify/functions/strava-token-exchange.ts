// netlify/functions/strava-token-exchange.ts
import { Handler, HandlerEvent, HandlerContext } from "@netlify/functions";

// Fonction utilitaire : timestamp d'il y a 24h (en secondes)
const getTimestamp24HoursAgo = () => {
  return Math.floor((Date.now() - 24 * 60 * 60 * 1000) / 1000);
};

const handler: Handler = async (event: HandlerEvent, context: HandlerContext) => {
  if (!event.body) {
    return { statusCode: 400, body: JSON.stringify({ error: "Missing code" }) };
  }

  const { code } = JSON.parse(event.body);

  // ⚠️ Ces variables DOIVENT être configurées dans le dashboard Netlify
  const CLIENT_ID = process.env.STRAVA_CLIENT_ID;
  const CLIENT_SECRET = process.env.STRAVA_CLIENT_SECRET;

  if (!CLIENT_ID || !CLIENT_SECRET) {
    console.error("❌ Strava credentials missing on server");
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: "Strava credentials not configured on server",
      }),
    };
  }

  try {
    // --- Étape 1 : Échanger le code contre un Access Token ---
    const tokenResponse = await fetch("https://www.strava.com/oauth/token", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        code,
        grant_type: "authorization_code",
      }),
    });

    const tokenData = await tokenResponse.json();

    if (!tokenResponse.ok) {
      console.error("Strava token error:", tokenData);
      return {
        statusCode: 400,
        body: JSON.stringify({
          error: `Strava token error: ${tokenData.message || "Bad Request"}`,
        }),
      };
    }

    const accessToken = tokenData.access_token;

    // --- Étape 2 : Récupérer les activités des dernières 24h ---
    const activitiesResponse = await fetch(
      `https://www.strava.com/api/v3/athlete/activities?after=${getTimestamp24HoursAgo()}`,
      {
        headers: { Authorization: `Bearer ${accessToken}` },
      }
    );

    if (!activitiesResponse.ok) {
      throw new Error("Failed to fetch Strava activities");
    }

    const activities: any[] = await activitiesResponse.json();

    // --- Étape 3 : Calculer les calories et déterminer la dernière synchro ---
    let totalCalories = 0;
    let lastSync = new Date().toISOString(); // Valeur par défaut

    if (activities.length > 0) {
      totalCalories = activities.reduce(
        (sum, act) => sum + (act.calories || 0),
        0
      );
      lastSync = activities
        .sort(
          (a, b) =>
            new Date(b.start_date).getTime() - new Date(a.start_date).getTime()
        )[0].start_date;
    }

    // --- Réponse OK ---
    return {
      statusCode: 200,
      body: JSON.stringify({
        totalCalories: Math.round(totalCalories),
        lastSync,
      }),
    };
  } catch (error) {
    console.error("Server error:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: (error as Error).message || "Server error",
      }),
    };
  }
};

export { handler };
