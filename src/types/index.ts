export interface User {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  age?: number;
  height: number;
  weight: number;
  bodyFat: number;
  muscleMass: number;
  boneMass: number;
  calibrationPhoto?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Meal {
  id: string;
  userId: string;
  beforePhoto: string;
  afterPhoto?: string;
  foods: Food[];
  totalCalories: number;
  totalProtein: number;
  totalCarbs: number;
  totalFat: number;
  createdAt: Date;
}

export interface Food {
  name: string;
  quantity: number;
  unit: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}

export interface Progress {
  id: string;
  userId: string;
  weight: number;
  bodyFat: number;
  muscleMass: number;
  date: Date;
}

export interface DailyStats {
  caloriesConsumed: number;
  caloriesTarget: number;
  proteinConsumed: number;
  proteinTarget: number;
  mealsCount: number;
  hydration: number;
  activity: number;
  sleep: number;
}