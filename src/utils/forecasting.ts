import { ReturnForecast } from '../types';

// Simple moving average forecast (simplified ARIMA alternative)
export const generateReturnForecast = (historicalData: number[], days: number = 7): number[] => {
  if (historicalData.length < 3) {
    return Array(days).fill(historicalData[historicalData.length - 1] || 0);
  }

  const forecast = [];
  const windowSize = Math.min(5, historicalData.length);
  
  for (let i = 0; i < days; i++) {
    // Calculate moving average
    const recentData = i === 0 
      ? historicalData.slice(-windowSize)
      : [...historicalData.slice(-windowSize + i), ...forecast.slice(0, i)];
    
    const average = recentData.reduce((sum, val) => sum + val, 0) / recentData.length;
    
    // Add some seasonality and trend
    const seasonalityFactor = 1 + 0.1 * Math.sin((i * 2 * Math.PI) / 7); // Weekly pattern
    const trendFactor = 1 + (Math.random() - 0.5) * 0.2; // Random trend
    
    forecast.push(Math.round(average * seasonalityFactor * trendFactor));
  }
  
  return forecast;
};

export const calculateForecastAccuracy = (forecasts: ReturnForecast[]): number => {
  const actualForecasts = forecasts.filter(f => f.actual !== undefined);
  
  if (actualForecasts.length === 0) return 0;
  
  const totalError = actualForecasts.reduce((sum, f) => {
    return sum + Math.abs(f.predicted - (f.actual || 0));
  }, 0);
  
  const totalActual = actualForecasts.reduce((sum, f) => sum + (f.actual || 0), 0);
  
  return Math.max(0, 100 - (totalError / totalActual * 100));
};