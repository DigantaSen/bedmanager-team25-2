import React, { useState, useEffect } from 'react';
import { Clock, Calendar } from 'lucide-react';

const TimeRemaining = ({ targetTime, label = 'Time remaining', compact = false }) => {
  const [timeRemaining, setTimeRemaining] = useState('');
  const [isOverdue, setIsOverdue] = useState(false);

  useEffect(() => {
    if (!targetTime) return;

    const calculateTimeRemaining = () => {
      const now = new Date();
      const target = new Date(targetTime);
      const diff = target - now;

      if (diff <= 0) {
        setIsOverdue(true);
        const overdueMs = Math.abs(diff);
        const overdueDays = Math.floor(overdueMs / (1000 * 60 * 60 * 24));
        const overdueHours = Math.floor((overdueMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const overdueMinutes = Math.floor((overdueMs % (1000 * 60 * 60)) / (1000 * 60));
        const overdueSeconds = Math.floor((overdueMs % (1000 * 60)) / 1000);

        if (overdueDays > 0) {
          setTimeRemaining(`${overdueDays}d ${overdueHours}h ${overdueMinutes}m overdue`);
        } else if (overdueHours > 0) {
          setTimeRemaining(`${overdueHours}h ${overdueMinutes}m ${overdueSeconds}s overdue`);
        } else if (overdueMinutes > 0) {
          setTimeRemaining(`${overdueMinutes}m ${overdueSeconds}s overdue`);
        } else {
          setTimeRemaining(`${overdueSeconds}s overdue`);
        }
      } else {
        setIsOverdue(false);
        const days = Math.floor(diff / (1000 * 60 * 60 * 24));
        const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((diff % (1000 * 60)) / 1000);

        if (days > 0) {
          setTimeRemaining(`${days}d ${hours}h ${minutes}m ${seconds}s`);
        } else if (hours > 0) {
          setTimeRemaining(`${hours}h ${minutes}m ${seconds}s`);
        } else if (minutes > 0) {
          setTimeRemaining(`${minutes}m ${seconds}s`);
        } else {
          setTimeRemaining(`${seconds}s`);
        }
      }
    };

    calculateTimeRemaining();
    const interval = setInterval(calculateTimeRemaining, 1000); // Update every second

    return () => clearInterval(interval);
  }, [targetTime]);

  if (!targetTime) return null;

  const targetDate = new Date(targetTime);
  const formattedDate = targetDate.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });
  const formattedTime = targetDate.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit'
  });

  if (compact) {
    return (
      <div className={`flex items-center gap-1 text-xs ${isOverdue ? 'text-red-400' : 'text-cyan-400'}`}>
        <Clock className="w-3 h-3" />
        <span className="font-medium">{timeRemaining}</span>
      </div>
    );
  }

  return (
    <div className={`flex flex-col gap-1 ${isOverdue ? 'text-red-400' : 'text-cyan-400'}`}>
      <div className="flex items-center gap-2">
        <Clock className="w-4 h-4" />
        <span className="text-sm font-semibold">
          {isOverdue ? 'Overdue by:' : label + ':'}
        </span>
      </div>
      <div className="text-lg font-bold">{timeRemaining}</div>
      <div className="flex items-center gap-2 text-xs text-neutral-400">
        <Calendar className="w-3 h-3" />
        <span>
          {formattedDate} at {formattedTime}
        </span>
      </div>
    </div>
  );
};

export default TimeRemaining;
