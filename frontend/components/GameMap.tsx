import React from 'react';

interface GameMapProps {
  stages: string[];
  currentStage: string;
}

const GameMap: React.FC<GameMapProps> = ({ stages, currentStage }) => {
  const currentStageIndex = stages.indexOf(currentStage);

  return (
    <div className="w-full overflow-x-auto p-4 bg-gray-100/50 rounded-lg">
      <div className="flex items-center space-x-2 min-w-max">
        {stages.map((stage, index) => {
          const isCompleted = index < currentStageIndex;
          const isActive = index === currentStageIndex;

          return (
            <React.Fragment key={stage}>
              <div className="flex flex-col items-center text-center">
                <div
                  className={`relative w-16 h-16 rounded-full flex items-center justify-center text-white font-bold text-lg shadow-md ${
                    isCompleted ? 'bg-green-500' : isActive ? 'bg-indigo-600 animate-pulse' : 'bg-gray-400'
                  }`}
                >
                  {isCompleted ? '✔' : isActive ? '🦸' : ''}
                </div>
                <span className={`mt-2 text-xs font-semibold ${isActive ? 'text-indigo-700' : 'text-gray-600'}`}>{stage}</span>
              </div>
              {index < stages.length - 1 && (
                <div className={`flex-grow h-1 ${index < currentStageIndex ? 'bg-green-500' : 'bg-gray-300'}`} style={{minWidth: '40px'}}></div>
              )}
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
};

export default GameMap;