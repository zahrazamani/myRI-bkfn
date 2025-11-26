import React from 'react';

interface CoinTallyProps {
  points: number;
}

const CoinTally: React.FC<CoinTallyProps> = ({ points }) => {
  return (
    <div className="flex items-center space-x-2 bg-yellow-100 border border-yellow-300 rounded-full px-3 py-1">
      <span className="text-xl">🪙</span>
      <span className="font-bold text-yellow-800 text-lg">{points}</span>
      <span className="text-sm text-yellow-700">Hero Points</span>
    </div>
  );
};

export default CoinTally;