import { useState } from 'react';
import { X, Calculator } from 'lucide-react';

const STANDARD_BAR_KG = 20;
const AVAILABLE_PLATES_KG = [25, 20, 15, 10, 5, 2.5, 1.25];

export default function PlateCalculator({ onClose }) {
  const [targetWeight, setTargetWeight] = useState('');
  const [barWeight, setBarWeight] = useState(STANDARD_BAR_KG);

  const calculatePlates = () => {
    const target = parseFloat(targetWeight);
    if (!target || target <= barWeight) return [];

    let remainingWeightPerSide = (target - barWeight) / 2;
    const platesToLoad = [];

    for (const plate of AVAILABLE_PLATES_KG) {
      let count = 0;
      while (remainingWeightPerSide >= plate) {
        count += 1;
        remainingWeightPerSide -= plate;
        remainingWeightPerSide = Math.round(remainingWeightPerSide * 100) / 100;
      }
      if (count > 0) platesToLoad.push({ weight: plate, count });
    }

    return platesToLoad;
  };

  const plates = calculatePlates();
  const actualCalculatedWeight =
    barWeight + plates.reduce((sum, p) => sum + p.weight * p.count * 2, 0);

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 backdrop-blur-md p-4">
      <div className="w-full max-w-sm rounded-[24px] glass-card p-6 shadow-2xl animate-scale-in">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <Calculator size={18} className="text-accent-orange" />
            <h2 className="text-xl font-extrabold text-text-main">Plate Calc</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="grid h-10 w-10 place-items-center rounded-xl bg-card-elevated text-text-muted transition hover:text-text-main active:scale-95"
          >
            <X size={18} />
          </button>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <label className="block">
            <span className="mb-2 block text-[10px] font-semibold uppercase tracking-[0.2em] text-text-muted">Target (KG)</span>
            <input
              type="number"
              value={targetWeight}
              onChange={(e) => setTargetWeight(e.target.value)}
              placeholder="e.g. 100"
              className="h-14 w-full rounded-xl glass-card px-4 text-center text-xl font-extrabold text-text-main outline-none focus:border-accent-orange transition font-mono"
            />
          </label>
          <label className="block">
            <span className="mb-2 block text-[10px] font-semibold uppercase tracking-[0.2em] text-text-muted">Bar (KG)</span>
            <input
              type="number"
              value={barWeight}
              onChange={(e) => setBarWeight(parseFloat(e.target.value) || 0)}
              className="h-14 w-full rounded-xl glass-card px-4 text-center text-xl font-extrabold text-text-main outline-none focus:border-accent-orange transition font-mono"
            />
          </label>
        </div>

        <div className="mt-8 rounded-xl bg-app-bg border border-glass-border p-4">
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-text-muted text-center mb-4">Plates per side</p>
          
          {plates.length > 0 ? (
            <div className="flex flex-col items-center gap-3">
              <div className="flex flex-wrap justify-center gap-2">
                {plates.map((plate, index) => (
                  <div
                    key={index}
                    className="flex flex-col items-center"
                    style={{ animationDelay: `${index * 50}ms` }}
                  >
                    <span className="mb-1 text-[10px] font-bold text-text-muted">&times;{plate.count}</span>
                    <div 
                      className={`flex h-16 w-12 items-center justify-center rounded-md border-b-4 border-r-2 shadow-inner font-mono text-sm font-extrabold transition-all duration-300 animate-fade-in ${
                        plate.weight >= 20 ? 'bg-quiet-red border-quiet-red/60 text-white' :
                        plate.weight >= 15 ? 'bg-quiet-amber border-quiet-amber/60 text-white' :
                        plate.weight >= 10 ? 'bg-quiet-green border-quiet-green/60 text-app-bg' :
                        'bg-card-elevated border-card-bg text-text-main'
                      }`}
                    >
                      {plate.weight}
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-2 text-center">
                <span className="text-xs text-text-muted font-medium">Actual load: </span>
                <span className="text-sm font-extrabold text-accent-orange">{actualCalculatedWeight} kg</span>
              </div>
            </div>
          ) : (
            <p className="text-center text-sm font-medium text-text-muted py-4">
              Enter target weight greater than bar.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
