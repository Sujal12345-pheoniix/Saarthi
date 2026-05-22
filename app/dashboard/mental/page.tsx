"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Brain, Moon, Sun, CloudRain, Heart, Sparkles, Send } from "lucide-react";

export default function MentalHealthAnalysis() {
  const [mood, setMood] = useState<number | null>(null);
  const [journal, setJournal] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [result, setResult] = useState<any>(null);

  const moods = [
    { value: 1, icon: CloudRain, label: "Sad", color: "text-blue-500", bg: "bg-blue-100 dark:bg-blue-900/50" },
    { value: 2, icon: Moon, label: "Tired", color: "text-indigo-500", bg: "bg-indigo-100 dark:bg-indigo-900/50" },
    { value: 3, icon: Brain, label: "Anxious", color: "text-purple-500", bg: "bg-purple-100 dark:bg-purple-900/50" },
    { value: 4, icon: Heart, label: "Calm", color: "text-teal-500", bg: "bg-teal-100 dark:bg-teal-900/50" },
    { value: 5, icon: Sun, label: "Happy", color: "text-yellow-500", bg: "bg-yellow-100 dark:bg-yellow-900/50" },
  ];

  const handleSubmit = () => {
    if (!mood) return;
    setIsSubmitting(true);
    
    // Mocking AI analysis
    setTimeout(() => {
      setIsSubmitting(false);
      setResult({
        stressLevel: mood <= 3 ? 65 : 25,
        analysis: "Your mood and journal entry suggest a slight increase in cognitive load.",
        activities: [
          "5-minute 4-7-8 breathing exercise",
          "A short 15-minute walk in nature",
          "Listen to Lo-Fi beats while working"
        ]
      });
    }, 2500);
  };

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <div className="mb-10">
        <h1 className="text-3xl font-bold text-foreground mb-2">Mental Wellness Check-in</h1>
        <p className="text-slate-600 dark:text-slate-400">
          Track your emotional state and receive personalized cognitive activities to maintain balance.
        </p>
      </div>

      {!result ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="glass p-8 rounded-3xl"
          >
            <h3 className="text-xl font-semibold text-foreground mb-6">How are you feeling right now?</h3>
            <div className="flex justify-between items-center mb-8 gap-2">
              {moods.map((m) => (
                <button
                  key={m.value}
                  onClick={() => setMood(m.value)}
                  className={`flex flex-col items-center gap-2 p-3 rounded-2xl transition-all ${
                    mood === m.value ? `${m.bg} scale-110 shadow-lg` : 'hover:bg-slate-100 dark:hover:bg-slate-800 opacity-60 hover:opacity-100'
                  }`}
                >
                  <m.icon className={`w-8 h-8 ${m.color}`} />
                  <span className="text-xs font-medium text-slate-600 dark:text-slate-300">{m.label}</span>
                </button>
              ))}
            </div>

            <h3 className="text-xl font-semibold text-foreground mb-4">Mindful Journal</h3>
            <textarea
              className="w-full h-40 rounded-2xl bg-white/50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 p-4 focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none text-slate-700 dark:text-slate-300"
              placeholder="What's on your mind today? Write as much or as little as you want..."
              value={journal}
              onChange={(e) => setJournal(e.target.value)}
            />

            <button
              disabled={!mood || isSubmitting}
              onClick={handleSubmit}
              className={`w-full mt-6 py-4 rounded-xl flex items-center justify-center gap-2 font-semibold text-white transition-all ${
                !mood ? 'bg-slate-300 dark:bg-slate-700 cursor-not-allowed' : 'bg-primary-600 hover:bg-primary-500 shadow-lg shadow-primary-500/30 hover:scale-[1.02]'
              }`}
            >
              {isSubmitting ? (
                <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1, ease: "linear" }}>
                  <Brain className="w-5 h-5" />
                </motion.div>
              ) : (
                <><Sparkles className="w-5 h-5" /> Analyze Mindset</>
              )}
            </button>
          </motion.div>

          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="glass p-8 rounded-3xl flex flex-col items-center justify-center text-center relative overflow-hidden"
          >
            {/* Animated breathing circle concept */}
            <div className="absolute inset-0 bg-gradient-to-br from-primary-500/10 to-blue-500/10 -z-10" />
            <motion.div 
              animate={{ scale: [1, 1.2, 1] }} 
              transition={{ repeat: Infinity, duration: 8, ease: "easeInOut" }}
              className="w-48 h-48 rounded-full bg-primary-100 dark:bg-primary-900/20 flex items-center justify-center mb-8 border border-primary-200 dark:border-primary-800/50"
            >
              <div className="text-primary-600 dark:text-primary-400 font-medium">Breathe with me</div>
            </motion.div>
            <h3 className="text-2xl font-bold text-foreground mb-2">Take a moment</h3>
            <p className="text-slate-600 dark:text-slate-400 max-w-sm">
              Inhale for 4 seconds, hold for 7 seconds, exhale for 8 seconds. This helps reset your nervous system.
            </p>
          </motion.div>
        </div>
      ) : (
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="glass p-8 rounded-3xl"
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
            <div>
              <h2 className="text-2xl font-bold text-foreground mb-6">AI Mind Analysis</h2>
              <div className="mb-8">
                <p className="text-sm font-medium text-slate-500 dark:text-slate-400 mb-2">Estimated Stress Level</p>
                <div className="flex items-center gap-4">
                  <div className="flex-1 h-4 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                    <motion.div 
                      initial={{ width: 0 }}
                      animate={{ width: `${result.stressLevel}%` }}
                      transition={{ duration: 1 }}
                      className={`h-full ${result.stressLevel > 50 ? 'bg-orange-500' : 'bg-primary-500'}`} 
                    />
                  </div>
                  <span className="font-bold text-lg text-foreground">{result.stressLevel}%</span>
                </div>
              </div>

              <div className="p-6 rounded-2xl bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-900/30 mb-8">
                <p className="text-slate-700 dark:text-slate-300 leading-relaxed font-medium">
                  {result.analysis}
                </p>
              </div>
            </div>

            <div>
              <h3 className="text-xl font-bold text-foreground mb-6 flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-primary-500" /> Recommended Activities
              </h3>
              <ul className="space-y-4">
                {result.activities.map((act: string, i: number) => (
                  <motion.li 
                    key={i} 
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.5 + (i * 0.1) }}
                    className="flex items-center gap-4 p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 shadow-sm"
                  >
                    <div className="w-8 h-8 rounded-full bg-primary-100 dark:bg-primary-900/50 text-primary-600 dark:text-primary-400 flex items-center justify-center font-bold text-sm shrink-0">
                      {i + 1}
                    </div>
                    <span className="text-slate-700 dark:text-slate-300 font-medium">{act}</span>
                  </motion.li>
                ))}
              </ul>
              
              <button 
                onClick={() => {setResult(null); setMood(null); setJournal("");}}
                className="mt-8 text-sm font-semibold text-primary-600 hover:text-primary-700 dark:text-primary-400 transition-colors underline underline-offset-4"
              >
                Log another entry
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </div>
  );
}
