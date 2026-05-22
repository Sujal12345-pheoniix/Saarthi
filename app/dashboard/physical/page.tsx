"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Activity, Flame, Droplets, Moon, Dumbbell, Trophy } from "lucide-react";

export default function PhysicalHealthAnalysis() {
  const [formData, setFormData] = useState({
    weight: "",
    height: "",
    water: 1.5,
    sleep: 7,
    exercise: 30
  });

  const [score, setScore] = useState<number | null>(null);

  const calculateScore = () => {
    // Simple mock logic for score
    let s = 70;
    if (formData.water >= 2.5) s += 10;
    if (formData.sleep >= 7 && formData.sleep <= 9) s += 10;
    if (formData.exercise >= 45) s += 10;
    setScore(Math.min(s, 100));
  };

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <div className="mb-10">
        <h1 className="text-3xl font-bold text-foreground mb-2">Physical Health Tracker</h1>
        <p className="text-slate-600 dark:text-slate-400">
          Log your daily physical metrics to get personalized nutrition and workout guidance.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 flex flex-col gap-6">
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="glass p-8 rounded-3xl"
          >
            <h2 className="text-xl font-bold text-foreground mb-6">Today's Logs</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Weight (kg)</label>
                <input 
                  type="number" 
                  value={formData.weight}
                  onChange={(e) => setFormData({...formData, weight: e.target.value})}
                  className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-primary-500 text-foreground"
                  placeholder="e.g. 70"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Height (cm)</label>
                <input 
                  type="number" 
                  value={formData.height}
                  onChange={(e) => setFormData({...formData, height: e.target.value})}
                  className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-primary-500 text-foreground"
                  placeholder="e.g. 175"
                />
              </div>
            </div>

            <div className="space-y-8">
              <div>
                <div className="flex justify-between mb-2">
                  <label className="text-sm font-medium text-slate-700 dark:text-slate-300 flex items-center gap-2">
                    <Droplets className="w-4 h-4 text-blue-500" /> Water Intake
                  </label>
                  <span className="text-sm font-bold text-blue-500">{formData.water} L</span>
                </div>
                <input 
                  type="range" min="0" max="5" step="0.1" 
                  value={formData.water}
                  onChange={(e) => setFormData({...formData, water: parseFloat(e.target.value)})}
                  className="w-full accent-blue-500"
                />
              </div>

              <div>
                <div className="flex justify-between mb-2">
                  <label className="text-sm font-medium text-slate-700 dark:text-slate-300 flex items-center gap-2">
                    <Moon className="w-4 h-4 text-indigo-500" /> Sleep Duration
                  </label>
                  <span className="text-sm font-bold text-indigo-500">{formData.sleep} hrs</span>
                </div>
                <input 
                  type="range" min="0" max="12" step="0.5" 
                  value={formData.sleep}
                  onChange={(e) => setFormData({...formData, sleep: parseFloat(e.target.value)})}
                  className="w-full accent-indigo-500"
                />
              </div>

              <div>
                <div className="flex justify-between mb-2">
                  <label className="text-sm font-medium text-slate-700 dark:text-slate-300 flex items-center gap-2">
                    <Dumbbell className="w-4 h-4 text-emerald-500" /> Exercise Minutes
                  </label>
                  <span className="text-sm font-bold text-emerald-500">{formData.exercise} min</span>
                </div>
                <input 
                  type="range" min="0" max="180" step="5" 
                  value={formData.exercise}
                  onChange={(e) => setFormData({...formData, exercise: parseInt(e.target.value)})}
                  className="w-full accent-emerald-500"
                />
              </div>
            </div>

            <button 
              onClick={calculateScore}
              className="mt-8 w-full py-4 rounded-xl bg-primary-600 hover:bg-primary-500 text-white font-semibold shadow-lg shadow-primary-500/30 transition-all hover:scale-[1.02] flex items-center justify-center gap-2"
            >
              <Activity className="w-5 h-5" /> Calculate Daily Score
            </button>
          </motion.div>
        </div>

        <div className="lg:col-span-1">
          <motion.div 
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="glass p-8 rounded-3xl h-full flex flex-col"
          >
            <h2 className="text-xl font-bold text-foreground mb-6 flex items-center gap-2">
              <Trophy className="w-6 h-6 text-yellow-500" /> Daily Summary
            </h2>

            {score !== null ? (
              <div className="flex-1 flex flex-col">
                <div className="flex flex-col items-center justify-center py-8">
                  <div className="relative inline-flex items-center justify-center w-40 h-40 mb-6">
                    <svg className="w-full h-full transform -rotate-90">
                      <circle cx="80" cy="80" r="72" fill="transparent" stroke="currentColor" strokeWidth="12" className="text-slate-100 dark:text-slate-800" />
                      <motion.circle 
                        initial={{ strokeDasharray: "0 1000" }}
                        animate={{ strokeDasharray: `${score * 4.52} 1000` }}
                        transition={{ duration: 1.5, ease: "easeOut" }}
                        cx="80" cy="80" r="72" fill="transparent" stroke="currentColor" strokeWidth="12" strokeLinecap="round" 
                        className={score > 80 ? "text-emerald-500" : score > 60 ? "text-yellow-500" : "text-orange-500"} 
                      />
                    </svg>
                    <div className="absolute flex flex-col items-center">
                      <span className="text-4xl font-bold text-foreground">{score}</span>
                      <span className="text-sm font-medium text-slate-500">Score</span>
                    </div>
                  </div>
                  
                  <div className="text-center mt-auto">
                    <h3 className="font-bold text-foreground mb-2">AI Recommendation</h3>
                    <p className="text-sm text-slate-600 dark:text-slate-400">
                      {score > 80 
                        ? "Great job! You're hitting your targets. Keep up the good work."
                        : "Try to drink a bit more water and aim for 7+ hours of sleep to improve recovery."}
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-center opacity-50">
                <Flame className="w-16 h-16 text-slate-400 mb-4" />
                <p className="text-slate-500">Fill in your logs and calculate your score to see your summary.</p>
              </div>
            )}
          </motion.div>
        </div>
      </div>
    </div>
  );
}
