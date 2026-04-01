import React from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import type { AIPlatformScores } from '../../../shared/types';

interface AnalysisChartProps {
  scores: AIPlatformScores;
}

function platformGradientId(name: string): string {
  const map: Record<string, number> = {
    'ChatGPT': 0,
    'Perplexity': 1,
    'Google AI': 2,
    'Claude': 3,
  };
  const index = map[name] ?? 0;
  return `platformGrad-${index}`;
}

export const AnalysisChart: React.FC<AnalysisChartProps> = ({ scores }) => {
  const data = [
    { name: 'ChatGPT', score: scores.chatgpt },
    { name: 'Perplexity', score: scores.perplexity },
    { name: 'Google AI', score: scores.google_ai },
    { name: 'Claude', score: scores.claude },
  ];

  return (
    <div className="h-[300px] w-full mt-4 min-w-0">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 20, right: 30, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="platformGrad-0" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#5eead4" stopOpacity={0.95} />
              <stop offset="100%" stopColor="#06b6d4" stopOpacity={0.55} />
            </linearGradient>
            <linearGradient id="platformGrad-1" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#a78bfa" stopOpacity={0.95} />
              <stop offset="100%" stopColor="#7c3aed" stopOpacity={0.58} />
            </linearGradient>
            <linearGradient id="platformGrad-2" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#f5b942" stopOpacity={0.95} />
              <stop offset="100%" stopColor="#e9a634" stopOpacity={0.58} />
            </linearGradient>
            <linearGradient id="platformGrad-3" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#7dd3fc" stopOpacity={0.95} />
              <stop offset="100%" stopColor="#38bdf8" stopOpacity={0.58} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(167,139,250,0.22)" />
          <XAxis 
            dataKey="name" 
            axisLine={false} 
            tickLine={false} 
            tick={{ fill: 'rgba(255,255,255,0.78)', fontSize: 13, fontWeight: 600 }} 
            dy={12}
          />
          <YAxis 
            hide 
            domain={[0, 100]} 
          />
          <Tooltip 
            cursor={{ fill: 'rgba(167,139,250,0.14)', opacity: 0.8 }}
            contentStyle={{ 
              background: 'rgba(20,24,36,0.92)',
              border: '1px solid rgba(167,139,250,0.30)',
              borderRadius: '12px', 
              boxShadow: '0 18px 35px rgba(6,182,212,0.10), 0 8px 24px rgba(124,58,237,0.14)',
              padding: '12px 16px',
              fontFamily: 'inherit'
            }}
            labelStyle={{ color: 'rgba(255,255,255,0.75)' }}
            itemStyle={{ fontWeight: 700, color: '#f8fafc' }}
            formatter={(value: any) => [`${value}%`, 'Visibility']}
          />
          <Bar
            dataKey="score"
            radius={[8, 8, 0, 0]}
            animationDuration={1200}
            barSize={60}
            shape={(props: any) => {
              const { x, y, width, height, payload } = props;
              const gradientId = platformGradientId(payload?.name || '');
              return (
                <rect
                  x={x}
                  y={y}
                  width={width}
                  height={height}
                  rx={8}
                  ry={8}
                  fill={`url(#${gradientId})`}
                />
              );
            }}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};