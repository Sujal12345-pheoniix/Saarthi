"use client";

import { motion } from "framer-motion";
import { Brain, HeartPulse, Activity, Bot, TrendingUp } from "lucide-react";

const features = [
  {
    title: "Skin Analysis",
    description: "Upload a photo and let our AI detect conditions like acne, dryness, and provide tailored skincare habits.",
    icon: <HeartPulse className="w-8 h-8 text-rose-500" />,
    color: "bg-rose-50 dark:bg-rose-950/30",
  },
  {
    title: "Mental Wellness",
    description: "Track your mood, stress levels, and daily journal. Receive meditation and activity recommendations.",
    icon: <Brain className="w-8 h-8 text-blue-500" />,
    color: "bg-blue-50 dark:bg-blue-950/30",
  },
  {
    title: "Physical Health",
    description: "Log workouts, water intake, and sleep. Get fitness scores and personalized nutrition guidance.",
    icon: <Activity className="w-8 h-8 text-emerald-500" />,
    color: "bg-emerald-50 dark:bg-emerald-950/30",
  },
  {
    title: "AI Recommendations",
    description: "Centralized AI engine analyzes your data across all modules to give holistic wellness tips.",
    icon: <Bot className="w-8 h-8 text-purple-500" />,
    color: "bg-purple-50 dark:bg-purple-950/30",
  },
  {
    title: "Progress Monitoring",
    description: "Visualize your wellness journey with interactive charts and build healthy habits with streaks.",
    icon: <TrendingUp className="w-8 h-8 text-orange-500" />,
    color: "bg-orange-50 dark:bg-orange-950/30",
  },
];

export default function Features() {
  return (
    <section id="features" className="py-24 bg-slate-50 dark:bg-slate-900/50">
      <div className="container mx-auto px-4">
        <div className="text-center max-w-3xl mx-auto mb-16">
          <h2 className="text-3xl md:text-4xl font-bold mb-4 text-foreground">Intelligent Features for Your Well-being</h2>
          <p className="text-lg text-slate-600 dark:text-slate-400">
            Saarthi brings together the most advanced AI models to provide comprehensive analysis across three core pillars of health.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {features.map((feature, idx) => (
            <motion.div
              key={idx}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: idx * 0.1 }}
              className="glass p-8 rounded-3xl hover:-translate-y-2 transition-transform duration-300"
            >
              <div className={`w-16 h-16 rounded-2xl flex items-center justify-center mb-6 ${feature.color}`}>
                {feature.icon}
              </div>
              <h3 className="text-xl font-semibold mb-3 text-foreground">{feature.title}</h3>
              <p className="text-slate-600 dark:text-slate-400 leading-relaxed">{feature.description}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
