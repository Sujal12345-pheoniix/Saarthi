"use client";

import { motion } from "framer-motion";

export default function HowItWorks() {
  const steps = [
    {
      number: "01",
      title: "Share Your Data",
      description: "Upload a selfie for skin analysis or log your daily mood and physical activity.",
    },
    {
      number: "02",
      title: "AI Analysis",
      description: "Our advanced multimodal AI processes your data to detect patterns and conditions.",
    },
    {
      number: "03",
      title: "Personalized Guidance",
      description: "Receive actionable insights, habits, and a holistic wellness score to track progress.",
    },
  ];

  return (
    <section className="py-24">
      <div className="container mx-auto px-4">
        <div className="text-center max-w-3xl mx-auto mb-16">
          <h2 className="text-3xl md:text-4xl font-bold mb-4 text-foreground">How Saarthi Works</h2>
          <p className="text-lg text-slate-600 dark:text-slate-400">
            A simple, intuitive process to start your wellness journey.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 relative">
          {/* Connector Line for Desktop */}
          <div className="hidden md:block absolute top-1/2 left-0 w-full h-0.5 bg-slate-200 dark:bg-slate-800 -z-10 transform -translate-y-1/2" />

          {steps.map((step, idx) => (
            <motion.div
              key={idx}
              initial={{ opacity: 0, scale: 0.9 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: idx * 0.2 }}
              className="flex flex-col items-center text-center"
            >
              <div className="w-16 h-16 rounded-full bg-primary-100 dark:bg-primary-900 flex items-center justify-center text-2xl font-bold text-primary-600 dark:text-primary-400 border-4 border-white dark:border-slate-950 mb-6 shadow-xl">
                {step.number}
              </div>
              <h3 className="text-xl font-semibold mb-3 text-foreground">{step.title}</h3>
              <p className="text-slate-600 dark:text-slate-400 max-w-sm">{step.description}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
