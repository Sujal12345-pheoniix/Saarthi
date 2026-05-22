"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { UploadCloud, CheckCircle2, AlertCircle, ScanFace, Droplets, Sparkles, RefreshCw } from "lucide-react";

export default function SkinAnalysis() {
  const [file, setFile] = useState<File | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [result, setResult] = useState<any>(null);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      setFile(e.dataTransfer.files[0]);
    }
  };

  const handleAnalyze = () => {
    if (!file) return;
    setIsAnalyzing(true);
    
    // Mocking the AI analysis process
    setTimeout(() => {
      setIsAnalyzing(false);
      setResult({
        healthScore: 82,
        confidence: 94,
        hydration: 60,
        problems: ["Slight dryness in T-zone", "Minor hyperpigmentation"],
        recommendations: [
          "Use a hyaluronic acid serum morning and night.",
          "Increase daily water intake to 2.5L.",
          "Apply SPF 50 daily even when indoors."
        ]
      });
    }, 4000);
  };

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <div className="mb-10">
        <h1 className="text-3xl font-bold text-foreground mb-2">Skin Health Analysis</h1>
        <p className="text-slate-600 dark:text-slate-400">
          Upload a clear photo of your face. Our AI will analyze your skin condition and provide personalized recommendations.
        </p>
      </div>

      <AnimatePresence mode="wait">
        {!file && !result && (
          <motion.div
            key="upload"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-3xl p-12 text-center glass hover:border-primary-500 transition-colors cursor-pointer"
            onDragOver={(e) => e.preventDefault()}
            onDrop={handleDrop}
            onClick={() => document.getElementById("file-upload")?.click()}
          >
            <input 
              id="file-upload" 
              type="file" 
              accept="image/*" 
              className="hidden" 
              onChange={(e) => e.target.files && setFile(e.target.files[0])}
            />
            <div className="w-20 h-20 bg-primary-50 dark:bg-primary-900/30 rounded-full flex items-center justify-center mx-auto mb-6">
              <UploadCloud className="w-10 h-10 text-primary-600 dark:text-primary-400" />
            </div>
            <h3 className="text-xl font-semibold text-foreground mb-2">Click or drag image to upload</h3>
            <p className="text-slate-500 dark:text-slate-400 max-w-md mx-auto">
              Please ensure your face is well-lit, makeup-free, and clearly visible. Supports JPG, PNG, HEIC (Max 5MB).
            </p>
          </motion.div>
        )}

        {file && !result && (
          <motion.div
            key="analyzing"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="glass rounded-3xl p-8 flex flex-col items-center justify-center min-h-[400px] relative overflow-hidden"
          >
            <img 
              src={URL.createObjectURL(file)} 
              alt="Preview" 
              className={`w-64 h-64 object-cover rounded-2xl shadow-2xl transition-all duration-1000 ${isAnalyzing ? 'blur-sm scale-105' : ''}`}
            />
            
            {isAnalyzing ? (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/40 backdrop-blur-sm z-10 text-white rounded-3xl">
                <motion.div 
                  animate={{ rotate: 360 }} 
                  transition={{ repeat: Infinity, duration: 2, ease: "linear" }}
                  className="mb-6"
                >
                  <ScanFace className="w-16 h-16 text-primary-400" />
                </motion.div>
                <h3 className="text-2xl font-bold mb-2">Analyzing Skin Topography</h3>
                <p className="text-slate-200">Our AI model is checking for 24 distinct conditions...</p>
                
                {/* Scanning line animation */}
                <motion.div 
                  className="absolute top-0 left-0 w-full h-1 bg-primary-500 shadow-[0_0_15px_rgba(16,185,129,0.8)]"
                  animate={{ top: ["0%", "100%", "0%"] }}
                  transition={{ repeat: Infinity, duration: 3, ease: "linear" }}
                />
              </div>
            ) : (
              <div className="mt-8 flex gap-4">
                <button 
                  onClick={() => setFile(null)}
                  className="px-6 py-3 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 font-medium hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                >
                  Cancel
                </button>
                <button 
                  onClick={handleAnalyze}
                  className="px-6 py-3 rounded-xl bg-primary-600 text-white font-medium hover:bg-primary-500 transition-colors flex items-center gap-2 shadow-lg shadow-primary-500/30"
                >
                  <Sparkles className="w-5 h-5" /> Analyze Image
                </button>
              </div>
            )}
          </motion.div>
        )}

        {result && (
          <motion.div
            key="results"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="grid grid-cols-1 lg:grid-cols-3 gap-8"
          >
            <div className="lg:col-span-1 flex flex-col gap-6">
              <div className="glass p-6 rounded-3xl text-center relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-primary-500 to-teal-400" />
                <p className="text-slate-500 dark:text-slate-400 font-medium mb-2">Overall Health</p>
                <div className="relative inline-flex items-center justify-center w-32 h-32 mb-4">
                  <svg className="w-full h-full transform -rotate-90">
                    <circle cx="64" cy="64" r="56" fill="transparent" stroke="currentColor" strokeWidth="12" className="text-slate-100 dark:text-slate-800" />
                    <motion.circle 
                      initial={{ strokeDasharray: "0 1000" }}
                      animate={{ strokeDasharray: `${result.healthScore * 3.51} 1000` }}
                      transition={{ duration: 1.5, ease: "easeOut" }}
                      cx="64" cy="64" r="56" fill="transparent" stroke="currentColor" strokeWidth="12" strokeLinecap="round" 
                      className="text-primary-500" 
                    />
                  </svg>
                  <div className="absolute text-3xl font-bold text-foreground">{result.healthScore}<span className="text-lg text-slate-400">%</span></div>
                </div>
                <p className="text-sm text-slate-500 dark:text-slate-400">AI Confidence: {result.confidence}%</p>
              </div>

              <div className="glass p-6 rounded-3xl">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-lg bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center text-blue-500">
                    <Droplets className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-foreground">Hydration Level</h3>
                    <p className="text-sm text-slate-500 dark:text-slate-400">Needs Improvement</p>
                  </div>
                </div>
                <div className="w-full h-3 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                  <motion.div 
                    initial={{ width: 0 }}
                    animate={{ width: `${result.hydration}%` }}
                    transition={{ duration: 1, delay: 0.5 }}
                    className="h-full bg-blue-500" 
                  />
                </div>
              </div>
            </div>

            <div className="lg:col-span-2 flex flex-col gap-6">
              <div className="glass p-8 rounded-3xl flex-1">
                <h3 className="text-xl font-bold text-foreground mb-6 flex items-center gap-2">
                  <AlertCircle className="w-6 h-6 text-orange-500" /> Detected Conditions
                </h3>
                <ul className="space-y-4 mb-8">
                  {result.problems.map((prob: string, i: number) => (
                    <li key={i} className="flex items-start gap-3 p-4 rounded-xl bg-orange-50/50 dark:bg-orange-500/5 border border-orange-100 dark:border-orange-900/30">
                      <div className="w-2 h-2 mt-2 rounded-full bg-orange-500" />
                      <span className="text-slate-700 dark:text-slate-300 font-medium">{prob}</span>
                    </li>
                  ))}
                </ul>

                <h3 className="text-xl font-bold text-foreground mb-6 flex items-center gap-2">
                  <CheckCircle2 className="w-6 h-6 text-primary-500" /> Recommendations
                </h3>
                <ul className="space-y-4">
                  {result.recommendations.map((rec: string, i: number) => (
                    <li key={i} className="flex items-start gap-3 p-4 rounded-xl bg-primary-50/50 dark:bg-primary-500/5 border border-primary-100 dark:border-primary-900/30">
                      <CheckCircle2 className="w-5 h-5 text-primary-500 shrink-0 mt-0.5" />
                      <span className="text-slate-700 dark:text-slate-300 font-medium">{rec}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="flex justify-end">
                <button 
                  onClick={() => {setResult(null); setFile(null);}}
                  className="px-6 py-3 rounded-xl bg-slate-900 text-white dark:bg-white dark:text-slate-900 font-medium hover:scale-105 transition-transform flex items-center gap-2"
                >
                  <RefreshCw className="w-5 h-5" /> Analyze Another Photo
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
