import React from 'react';
import { Link } from 'react-router-dom';
import '../css/Watermark.css';

const SandwichDetectLogic = () => {
  return (
    <div className="min-h-screen watermark-container p-4 md:p-8 mx-auto max-w-4xl">
      <div className="mb-4">
        <nav className="text-sm text-gray-600">
          <Link to="/data-center" className="text-[#F3BA2F] hover:underline">Data Center</Link>
          <span className="mx-2">/</span>
          <Link to="/sandwich-stats" className="text-[#F3BA2F] hover:underline">Sandwich Stats</Link>
          <span className="mx-2">/</span>
          <span>Detection Logic</span>
        </nav>
      </div>

      <hr className="my-4 border-t border-gray-300" />

      <div className="bg-white rounded-xl shadow-sm p-6 md:p-8">
        <h1 className="text-2xl md:text-3xl font-bold text-gray-900 mb-6">
          Sandwich Attack Detection Logic
        </h1>

        <div className="space-y-6 text-gray-700">
          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">1. Exclude Arbitrage Transactions</h2>
            <p className="leading-relaxed">
              Drop trades flagged as arbitrage by our checks (including single-tx arb by transfers) but <strong>keep fake arbitrage</strong>: 
              if there is a large off-path swap that dwarfs the arb path (for example ≳10× the head swap, with BNB↔USD scaled), 
              we treat it as noise and not be excluded from sandwich detection.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">2. Search for Frontrun TX and Victim TX</h2>
            <p className="leading-relaxed">
              In each pool, read the block in order and find two swaps going the same way. The earlier swap (by the attacker) 
              is the frontrun that moves the price; the later swap (by a different wallet) is the victim who pays the worse price.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">3. Trace Token Flow (Graph Search)</h2>
            <p className="leading-relaxed">
              Follow the frontrun's output tokens through later transfers to see where they go. 
              <span className="text-gray-600">(Lightweight graph traversal over logs)</span>
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">4. Link Candidate Backruns</h2>
            <p className="leading-relaxed">
              Only keep later swaps that can be fed by that token flow. 
              <span className="text-gray-600">(Flow linkage with tolerance in bps)</span>
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">5. Pick the Best Subset</h2>
            <p className="leading-relaxed">
              From multiple candidate backruns, choose a subset whose total input best matches the frontrun's output, within tolerance. 
              <span className="text-gray-600">(Small knapsack / subset-sum)</span>
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">6. Validate Profit & Order</h2>
            <p className="leading-relaxed">
              Require positive profit and the correct order: <strong>frontrun → victim → backrun</strong>. 
              Also check monotonic changes in amounts to avoid false positives.
            </p>
          </section>

          <div className="mt-8 p-4 bg-amber-50 border border-amber-200 rounded-lg">
            <p className="text-sm text-amber-800">
              <strong>Note:</strong> This detection algorithm is continuously being refined to improve accuracy and reduce false positives.
            </p>
          </div>

          <div className="mt-6 flex justify-center">
            <Link 
              to="/sandwich-stats" 
              className="px-4 py-2 bg-[#F3BA2F] text-white rounded hover:bg-amber-500 transition-colors"
            >
              Back to Sandwich Stats
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SandwichDetectLogic;