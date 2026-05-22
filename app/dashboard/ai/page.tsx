"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Bot, Send, Sparkles, User } from "lucide-react";
import { useUser } from "@clerk/nextjs";

export default function AIRecommendations() {
  const { user } = useUser();
  const [messages, setMessages] = useState([
    {
      role: "ai",
      content: "Hello! I've analyzed your recent data across Skin, Mental, and Physical modules. I noticed a slight increase in stress combined with lower hydration. How can I help you today?"
    }
  ]);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);

  const handleSend = () => {
    if (!input.trim()) return;
    
    const newMsg = { role: "user", content: input };
    setMessages((prev) => [...prev, newMsg]);
    setInput("");
    setIsTyping(true);

    // Mock AI response
    setTimeout(() => {
      setIsTyping(false);
      setMessages((prev) => [
        ...prev,
        {
          role: "ai",
          content: "Based on that, I suggest a 10-minute meditation before bed tonight and keeping a water bottle at your desk tomorrow. Would you like me to schedule a reminder?"
        }
      ]);
    }, 2000);
  };

  return (
    <div className="p-8 max-w-5xl mx-auto h-[calc(100vh-80px)] flex flex-col">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-foreground mb-2 flex items-center gap-3">
          <Bot className="w-8 h-8 text-primary-500" />
          Saarthi AI Companion
        </h1>
        <p className="text-slate-600 dark:text-slate-400">
          Your centralized intelligence analyzing all your wellness data. Ask anything.
        </p>
      </div>

      <div className="flex-1 glass rounded-3xl flex flex-col overflow-hidden relative">
        <div className="absolute inset-0 bg-gradient-to-b from-primary-500/5 to-transparent pointer-events-none" />
        
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {messages.map((msg, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className={`flex gap-4 max-w-[80%] ${msg.role === 'user' ? 'ml-auto flex-row-reverse' : ''}`}
            >
              <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${
                msg.role === 'user' ? 'bg-slate-200 dark:bg-slate-800' : 'bg-primary-100 dark:bg-primary-900/50 text-primary-600 dark:text-primary-400'
              }`}>
                {msg.role === 'user' ? <User className="w-5 h-5 text-slate-600 dark:text-slate-300" /> : <Bot className="w-6 h-6" />}
              </div>
              <div className={`p-4 rounded-2xl ${
                msg.role === 'user' 
                  ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 rounded-tr-sm' 
                  : 'bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 shadow-sm rounded-tl-sm text-slate-700 dark:text-slate-300 leading-relaxed'
              }`}>
                {msg.content}
              </div>
            </motion.div>
          ))}
          {isTyping && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex gap-4 max-w-[80%]">
              <div className="w-10 h-10 rounded-full bg-primary-100 dark:bg-primary-900/50 text-primary-600 dark:text-primary-400 flex items-center justify-center shrink-0">
                <Bot className="w-6 h-6" />
              </div>
              <div className="p-4 rounded-2xl bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 shadow-sm rounded-tl-sm flex items-center gap-2">
                <motion.div animate={{ y: [0, -5, 0] }} transition={{ repeat: Infinity, duration: 0.6 }} className="w-2 h-2 rounded-full bg-primary-500" />
                <motion.div animate={{ y: [0, -5, 0] }} transition={{ repeat: Infinity, duration: 0.6, delay: 0.2 }} className="w-2 h-2 rounded-full bg-primary-500" />
                <motion.div animate={{ y: [0, -5, 0] }} transition={{ repeat: Infinity, duration: 0.6, delay: 0.4 }} className="w-2 h-2 rounded-full bg-primary-500" />
              </div>
            </motion.div>
          )}
        </div>

        <div className="p-4 bg-white/50 dark:bg-slate-900/50 backdrop-blur-md border-t border-slate-200 dark:border-slate-800">
          <div className="relative flex items-center">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSend()}
              placeholder="Ask Saarthi about your health..."
              className="w-full bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-full pl-6 pr-14 py-4 focus:outline-none focus:ring-2 focus:ring-primary-500 shadow-sm text-foreground"
            />
            <button
              onClick={handleSend}
              disabled={!input.trim()}
              className="absolute right-2 w-10 h-10 rounded-full bg-primary-600 text-white flex items-center justify-center hover:bg-primary-500 disabled:opacity-50 disabled:hover:bg-primary-600 transition-colors"
            >
              <Send className="w-5 h-5 ml-0.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
