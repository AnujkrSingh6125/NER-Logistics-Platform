'use client';

import React, { useState, useEffect } from 'react';
import { Calendar } from 'lucide-react';

export default function LiveClockWidget() {
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const formatDate = (date) => {
    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  };

  const formatTime = (date) => {
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });
  };

  return (
    <div className="bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border border-slate-200/90 dark:border-slate-800 rounded-xl p-2.5 sm:p-3 shadow-sm flex items-center space-x-3 min-w-[190px]">
      <div className="w-8 h-8 rounded-lg bg-blue-50/80 dark:bg-slate-800 border border-blue-100 dark:border-slate-700 flex items-center justify-center text-[#0284c7] dark:text-cyan-400 shrink-0">
        <Calendar className="w-4 h-4" />
      </div>
      <div className="flex flex-col">
        <span className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 leading-tight">
          {formatDate(time)}
        </span>
        <span className="text-sm font-black font-mono text-slate-900 dark:text-white leading-tight mt-0.5">
          {formatTime(time)}
        </span>
        <div className="flex items-center space-x-1.5 mt-0.5">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
          <span className="text-[9px] font-mono text-emerald-600 dark:text-emerald-400 font-bold tracking-wide">
            System Online
          </span>
        </div>
      </div>
    </div>
  );
}
