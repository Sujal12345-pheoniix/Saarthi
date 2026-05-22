"use client";

import { useUser } from "@clerk/nextjs";
import { motion } from "framer-motion";
import { Flame, Activity, Brain, HeartPulse, ArrowRight } from "lucide-react";
import Link from "next/link";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

const data = [
  { name: 'Mon', score: 65 },
  { name: 'Tue', score: 70 },
  { name: 'Wed', score: 68 },
  { name: 'Thu', score: 75 },
  { name: 'Fri', score: 82 },
  { name: 'Sat', score: 85 },
  { name: 'Sun', score: 88 },
];

export default function DashboardOverview() {
  const { user } = useUser();

  const metrics = [
    { title: "Overall Wellness", value: "88%", icon: Activity, color: "text-emerald-500", bg: "bg-emerald-50 dark:bg-emerald-500/10" },
    { title: "Skin Health", value: "Good", icon: HeartPulse, color: "text-rose-500", bg: "bg-rose-50 dark:bg-rose-500/10" },
    { title: "Mental State", value: "Calm", icon: Brain, color: "text-blue-500", bg: "bg-blue-50 dark:bg-blue-500/10" },
    { title: "Active Streak", value: "5 Days", icon: Flame, color: "text-orange-500", bg: "bg-orange-50 dark:bg-orange-500/10" },
  ];

  return (
    <div className="p-8">
      <div className="mb-10">
        <h1 className="text-3xl font-bold text-foreground mb-2">
          Good morning, {user?.firstName || "Explorer"}! 👋
        </h1>
        <p className="text-slate-600 dark:text-slate-400">
          Here is your daily wellness summary. Let's make today a great day.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-10">
        {metrics.map((metric, idx) => (
          <motion.div
            key={idx}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.1 }}
            className="glass p-6 rounded-3xl flex items-center gap-4"
          >
            <div className={`w-14 h-14 rounded-2xl flex items-center justify-center ${metric.bg}`}>
              <metric.icon className={`w-7 h-7 ${metric.color}`} />
            </div>
            <div>
              <p className="text-sm font-medium text-slate-500 dark:text-slate-400 mb-1">{metric.title}</p>
              <h3 className="text-2xl font-bold text-foreground">{metric.value}</h3>
            </div>
          </motion.div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.4 }}
          className="lg:col-span-2 glass p-8 rounded-3xl"
        >
          <div className="flex items-center justify-between mb-8">
            <h2 className="text-xl font-bold text-foreground">Wellness Progress</h2>
            <select className="bg-slate-100 dark:bg-slate-800 border-none text-sm rounded-lg px-3 py-1.5 outline-none">
              <option>This Week</option>
              <option>This Month</option>
            </select>
          </div>
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#334155" opacity={0.2} />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#64748b' }} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748b' }} dx={-10} />
                <Tooltip 
                  contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                />
                <Line 
                  type="monotone" 
                  dataKey="score" 
                  stroke="#10b981" 
                  strokeWidth={4} 
                  dot={{ r: 6, fill: '#10b981', strokeWidth: 2, stroke: '#fff' }} 
                  activeDot={{ r: 8 }} 
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.5 }}
          className="glass p-8 rounded-3xl flex flex-col"
        >
          <h2 className="text-xl font-bold text-foreground mb-6">AI Daily Tip</h2>
          <div className="bg-gradient-to-br from-primary-500 to-teal-400 p-6 rounded-2xl text-white flex-1 flex flex-col justify-between">
            <div>
              <Brain className="w-8 h-8 mb-4 opacity-80" />
              <p className="text-lg font-medium leading-relaxed mb-6">
                "Your stress levels are slightly elevated. Try maintaining a fixed sleep cycle and taking a 5-minute breathing break this afternoon."
              </p>
            </div>
            <Link href="/dashboard/ai" className="inline-flex items-center text-sm font-semibold hover:opacity-80 transition-opacity">
              View AI Analysis <ArrowRight className="ml-2 w-4 h-4" />
            </Link>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
