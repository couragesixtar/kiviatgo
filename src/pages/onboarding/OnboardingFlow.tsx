import { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { Welcome } from './Welcome';
import { PhysicalInfo } from './PhysicalInfo';
import { Summary } from './Summary';
import { Goals } from './Goals';

export const OnboardingFlow = ({ onCancel }: { onCancel?: () => void }) => {
  const [currentStep, setCurrentStep] = useState(0);
  const [userData, setUserData] = useState<any>({});
  const { register, completeOnboarding, updateUser, createProgress } = useAuth();

  const STORAGE_KEY = 'kiviatgo_onboarding';

  // Restore saved onboarding state if present (helps when auth state change remounts the component)
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const saved = JSON.parse(raw);
        if (saved?.step !== undefined) setCurrentStep(saved.step);
        if (saved?.userData) setUserData(saved.userData);
      }
    } catch (err) {
      console.warn('Impossible de restaurer l\'onboarding depuis localStorage', err);
    }
  }, []);

  const saveState = (step: number, data: any) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ step, userData: data }));
    } catch (err) {
      console.warn('Impossible de sauvegarder l\'onboarding', err);
    }
  };

  const clearState = () => {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch (err) {
      // ignore
    }
  };

  const handleWelcomeNext = async (data: any) => {
    const merged = { ...userData, ...data };
    // sauvegarde immédiate avant le register pour résilience
    saveState(1, merged);
    try {
      setUserData(merged);
      await register(data);
      // go to PhysicalInfo (step 1)
      setCurrentStep(1);
    } catch (err) {
      clearState();
      throw err;
    }
  };

  const handlePhysicalInfoNext = async (data: any) => {
    const merged = { ...userData, ...data };
    setUserData(merged);
    // next -> Goals
    saveState(2, merged);
    try {
      await updateUser({
        height: data.height,
        weight: data.weight,
        bodyFat: data.bodyFat,
        muscleMass: data.muscleMass,
        boneMass: data.boneMass
      });
      if (data.weight) {
        await createProgress({
          weight: data.weight,
          bodyFat: data.bodyFat,
          muscleMass: data.muscleMass
        });
      }
      setCurrentStep(2);
    } catch (err) {
      console.error('Erreur lors de la sauvegarde des infos physiques', err);
      throw err;
    }
  };

  const handleGoalsNext = async (data: any) => {
    const merged = { ...userData, ...data };
    setUserData(merged);
    // next -> Summary
    saveState(3, merged);
    try {
      await updateUser({
        targetWeight: data.targetWeight,
        daily: {
          caloriesTarget: data.caloriesTarget,
          proteinTarget: data.proteinTarget
        } as any
      } as any);
      setCurrentStep(3);
    } catch (err) {
      console.error('Erreur lors de la sauvegarde des objectifs', err);
      throw err;
    }
  };

  const handleComplete = async () => {
    try {
      const { height, weight, bodyFat, muscleMass, boneMass, targetWeight } = userData;
      await updateUser({ height, weight, bodyFat, muscleMass, boneMass, targetWeight });
      await completeOnboarding();
      clearState();
    } catch (err) {
      console.error('Erreur lors de la finalisation de l\'onboarding', err);
      throw err;
    }
  };

  const handleBack = () => {
    const nextStep = Math.max(0, currentStep - 1);
    setCurrentStep(nextStep);
    saveState(nextStep, userData);
  };

  const handleCancel = () => {
    clearState();
    if (onCancel) onCancel();
  };

  // helper onUpdate partagé : MERGE en mémoire SEULEMENT (ne pas écrire localStorage ici)
  const handleLiveUpdate = (data: any) => {
    const merged = { ...userData, ...data };
    setUserData(merged);
    // NOTE : on n'appelle plus saveState ici pour éviter l'écriture à chaque frappe
  };

  // when rendering steps, pass initialData + onUpdate so each page persists edits in memory;
  // actual localStorage save happens dans les handlers "Next" (saveState déjà appelés là).
  switch (currentStep) {
    case 0:
      return <Welcome onNext={handleWelcomeNext} onCancel={handleCancel} initialData={userData} onUpdate={handleLiveUpdate} />;
    case 1:
      return <PhysicalInfo onNext={handlePhysicalInfoNext} onBack={handleBack} initialData={userData} onUpdate={handleLiveUpdate} />;
    case 2:
      return <Goals onNext={handleGoalsNext} onBack={handleBack} initialData={userData} onUpdate={handleLiveUpdate} />;
    case 3:
      return <Summary userData={userData} onComplete={handleComplete} />;
    default:
      return <Welcome onNext={handleWelcomeNext} onCancel={handleCancel} initialData={userData} onUpdate={handleLiveUpdate} />;
  }
};