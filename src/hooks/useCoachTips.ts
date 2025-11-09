import { useState, useEffect } from 'react';

const coachTips = [
  "Les progrès, c'est comme un bon plat : faut du temps pour que ça cuise 🍳",
  "Un compte bien configuré, c'est la moitié du gain de masse 😎",
  "Assiette vide ? T'as gagné un squat bonus 💥",
  "Tes progrès parlent pour toi 💪",
  "Rome ne s'est pas faite en un jour, tes abdos non plus 🏛️",
  "Une protéine par jour éloigne le catabolisme pour toujours 🥚",
  "Le sommeil c'est gratuit, profites-en contrairement à ta salle de sport 😴",
  "Chaque rep compte, surtout quand t’as envie d’arrêter 🔥",
  "Les excuses brûlent zéro calorie 🧊",
  "Tu veux des résultats ? Commence par transpirer 💦",
  "Le mental pousse plus lourd que les bras 🧠💪",
  "Ce n’est pas la salle qui fait le muscle, c’est ta régularité 🕒",
  "Même les légendes ont commencé avec la barre à vide 🏋️",
  "Transpire aujourd’hui, brille demain ✨",
  "Les douleurs passent, la fierté reste 🧱",
  "T’as pas besoin d’être motivé, juste discipliné 📅",
  "Chaque repas compte autant que chaque série 🍗",
  "Le miroir ment, la balance exagère, mais le t-shirt dit la vérité 👕",
  "Les jours sans envie sont ceux qui forgent ton corps 🔥",
  "Tu veux des abdos ? Commence par dire non au deuxième dessert 🍰",
  "Force + patience = physique en béton 🧱",
  "Un corps fort commence par une tête forte 💭💪"
];

export const useCoachTips = () => {
  const [currentTip, setCurrentTip] = useState('');

  useEffect(() => {
    const getRandomTip = () => {
      const randomIndex = Math.floor(Math.random() * coachTips.length);
      return coachTips[randomIndex];
    };

    setCurrentTip(getRandomTip());

    // Change tip every 30 seconds
    const interval = setInterval(() => {
      setCurrentTip(getRandomTip());
    }, 30000);

    return () => clearInterval(interval);
  }, []);

  return currentTip;
};