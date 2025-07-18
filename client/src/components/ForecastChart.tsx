import React from 'react';
import { Chart as ChartJS, CategoryScale, LinearScale, LineElement, PointElement, Title, Tooltip, Legend, Filler } from 'chart.js';
import { Line } from 'react-chartjs-2';
import { ReturnForecast } from '../types';
import { format } from 'date-fns';

ChartJS.register(CategoryScale, LinearScale, LineElement, PointElement, Title, Tooltip, Legend, Filler);

interface ForecastChartProps {
  forecastData: ReturnForecast[];
  accuracy: number;
}

export default function ForecastChart({ forecastData, accuracy }: ForecastChartProps) {
  const labels = forecastData.map(item => format(new Date(item.date), 'MMM dd'));
  
  const actualData = forecastData.map(item => item.actual);
  const predictedData = forecastData.map(item => item.predicted);

  const data = {
    labels,
    datasets: [
      {
        label: 'Actual Returns',
        data: actualData,
        borderColor: 'rgba(16, 185, 129, 1)',
        backgroundColor: 'rgba(16, 185, 129, 0.1)',
        tension: 0.4,
        fill: false,
        pointBackgroundColor: 'rgba(16, 185, 129, 1)',
        pointBorderColor: 'white',
        pointBorderWidth: 2,
        pointRadius: 6,
        pointHoverRadius: 8,
      },
      {
        label: 'Predicted Returns',
        data: predictedData,
        borderColor: 'rgba(59, 130, 246, 1)',
        backgroundColor: 'rgba(59, 130, 246, 0.1)',
        borderDash: [5, 5],
        tension: 0.4,
        fill: false,
        pointBackgroundColor: 'rgba(59, 130, 246, 1)',
        pointBorderColor: 'white',
        pointBorderWidth: 2,
        pointRadius: 6,
        pointHoverRadius: 8,
      }
    ]
  };

  const options = {
    responsive: true,
    interaction: {
      mode: 'index' as const,
      intersect: false,
    },
    plugins: {
      legend: {
        position: 'top' as const,
      },
      tooltip: {
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        titleColor: 'white',
        bodyColor: 'white',
        borderColor: 'rgba(255, 255, 255, 0.1)',
        borderWidth: 1,
      },
    },
    scales: {
      y: {
        beginAtZero: true,
        grid: {
          color: 'rgba(0, 0, 0, 0.1)',
        },
        title: {
          display: true,
          text: 'Number of Returns',
        },
      },
      x: {
        grid: {
          display: false,
        },
        title: {
          display: true,
          text: 'Date',
        },
      },
    },
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-lg font-semibold text-slate-900">Return Forecast</h3>
          <p className="text-sm text-slate-600 mt-1">AI-powered prediction of future returns</p>
        </div>
        <div className="text-right">
          <div className="text-2xl font-bold text-emerald-600">{accuracy.toFixed(1)}%</div>
          <div className="text-sm text-slate-600">Forecast Accuracy</div>
        </div>
      </div>
      
      <div className="h-80 mb-6">
        <Line data={data} options={options} />
      </div>

      <div className="grid grid-cols-3 gap-4 pt-4 border-t border-slate-200">
        <div className="text-center">
          <div className="text-xl font-semibold text-slate-900">
            {forecastData.filter(f => f.actual !== undefined).reduce((sum, f) => sum + (f.actual || 0), 0)}
          </div>
          <div className="text-sm text-slate-600">Actual Returns</div>
        </div>
        <div className="text-center">
          <div className="text-xl font-semibold text-blue-600">
            {forecastData.filter(f => f.actual === undefined).reduce((sum, f) => sum + f.predicted, 0)}
          </div>
          <div className="text-sm text-slate-600">Predicted Returns</div>
        </div>
        <div className="text-center">
          <div className="text-xl font-semibold text-amber-600">
            {Math.abs(
              forecastData.filter(f => f.actual !== undefined).reduce((sum, f) => sum + f.predicted - (f.actual || 0), 0)
            )}
          </div>
          <div className="text-sm text-slate-600">Avg. Deviation</div>
        </div>
      </div>
    </div>
  );
}