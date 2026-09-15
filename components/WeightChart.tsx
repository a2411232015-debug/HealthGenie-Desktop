import React from 'react';

interface WeightData {
  date: string;
  weight: number;
}

interface WeightChartProps {
  data: WeightData[];
  targetWeight: number;
}

export const WeightChart: React.FC<WeightChartProps> = ({ data, targetWeight }) => {
  // SVG viewBox Base size (內部自適應比例)
  const width = 800;
  const height = 300;
  const padding = 40;
  
  // Calculate scales
  const weights = data.map(d => d.weight);
  const minWeight = Math.min(...weights, targetWeight) - 2;
  const maxWeight = Math.max(...weights, targetWeight) + 2;
  
  const xScale = (index: number) => padding + (index * (width - padding * 2) / (data.length - 1));
  const yScale = (weight: number) => height - padding - ((weight - minWeight) / (maxWeight - minWeight)) * (height - padding * 2);

  // Generate path for the line
  const pathD = data.map((d, i) => 
    `${i === 0 ? 'M' : 'L'} ${xScale(i)} ${yScale(d.weight)}`
  ).join(' ');

  // Generate area path (for gradient under the line)
  const areaD = `${pathD} L ${width - padding} ${height - padding} L ${padding} ${height - padding} Z`;

  return (
    <div className="w-full relative overflow-hidden flex items-center justify-center py-2">
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto max-h-[300px] drop-shadow-sm">
        <defs>
          <linearGradient id="lineGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#10b981" stopOpacity="0.2" />
            <stop offset="100%" stopColor="#10b981" stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* Grid Lines (Horizontal) */}
        {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
          const y = padding + ratio * (height - padding * 2);
          return (
            <line 
              key={ratio} 
              x1={padding} 
              y1={y} 
              x2={width - padding} 
              y2={y} 
              stroke="#e2e8f0" 
              strokeWidth="1" 
            />
          );
        })}

        {/* Target Weight Line */}
        <line 
          x1={padding} 
          y1={yScale(targetWeight)} 
          x2={width - padding} 
          y2={yScale(targetWeight)} 
          stroke="#f59e0b" 
          strokeWidth="2" 
          strokeDasharray="5,5" 
        />
        <text 
          x={width - padding + 5} 
          y={yScale(targetWeight)} 
          fill="#f59e0b" 
          dy="4" 
          fontSize="12" 
          className="font-bold"
        >
          目標
        </text>

        {/* Area Fill */}
        <path d={areaD} fill="url(#lineGradient)" />

        {/* Main Line */}
        <path d={pathD} fill="none" stroke="#10b981" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />

        {/* Data Points */}
        {data.map((d, i) => (
          <g key={i} className="group">
            <circle 
              cx={xScale(i)} 
              cy={yScale(d.weight)} 
              r={data.length > 30 ? "2" : "4"} 
              fill="white" 
              stroke="#10b981" 
              strokeWidth={data.length > 30 ? "1.5" : "2"}
              className="transition-all duration-300 cursor-pointer"
              style={{ transition: 'r 0.3s ease' }}
            />
            {/* Tooltip on hover (simple svg text) */}
            <g className="opacity-0 group-hover:opacity-100 transition-opacity duration-200">
               <rect 
                x={xScale(i) - 25} 
                y={yScale(d.weight) - 35} 
                width="50" 
                height="24" 
                rx="4" 
                fill="#1e293b" 
               />
               <text 
                x={xScale(i)} 
                y={yScale(d.weight) - 19} 
                textAnchor="middle" 
                fill="white" 
                fontSize="12" 
                fontWeight="bold"
               >
                 {d.weight}kg
               </text>
            </g>
            
            {/* X Axis Labels (動態抽樣標籤，防止擠壓) */}
            {(data.length <= 14 || i % Math.ceil(data.length / 8) === 0 || i === data.length - 1) && (
              <text 
                x={xScale(i)} 
                y={height - 15} 
                textAnchor="middle" 
                fill="#94a3b8" 
                fontSize={data.length > 30 ? "10" : "12"}
              >
                {d.date}
              </text>
            )}
          </g>
        ))}
      </svg>
    </div>
  );
};
