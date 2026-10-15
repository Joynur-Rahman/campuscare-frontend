import { Check, Wrench } from 'lucide-react';
import { createdMs } from '../lib/ticketUtils.js';

function formatStepDate(timestamp) {
  if (!timestamp) return null;
  const ms = typeof timestamp === 'number'
    ? timestamp
    : (timestamp.seconds ? timestamp.seconds * 1000 : new Date(timestamp).getTime());
  if (!ms || isNaN(ms)) return null;
  const d = new Date(ms);
  const day = d.getDate();
  const month = d.toLocaleDateString('en-GB', { month: 'short' });
  const time = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
  return `${day} ${month}, ${time}`;
}

export function getTimelineStages(t) {
  const s = String(t?.status || '').toLowerCase().trim();
  const isFixed = s === 'resolved' || s === 'fixed' || s === 'done';
  const isInProgress = s === 'in progress' || s === 'in_progress' || s === 'being fixed';
  const hasTech = Boolean(t?.assignedTo || t?.assignedToName);

  const cMs = createdMs(t);
  const reportedTime = formatStepDate(cMs);

  // 1. Reported (Always done)
  // 2. Technician assigned
  const techAssigned = hasTech || isInProgress || isFixed;
  const assignedMs = t?.assignedAt || t?.acknowledgedAt || (cMs && techAssigned ? cMs + 60000 : null);
  const assignedTime = techAssigned ? formatStepDate(assignedMs) : null;

  // 3. Work started
  const workStarted = isInProgress || isFixed;
  const startedMs = t?.startedAt || t?.acknowledgedAt || (cMs && workStarted ? cMs + 1800000 : null);
  const startedTime = workStarted ? formatStepDate(startedMs) : null;

  // 4. Fixed
  const fixedMs = t?.resolvedAtMs || t?.resolved_at || t?.updated_at || (cMs && isFixed ? cMs + 3600000 : null);
  const fixedTime = isFixed ? formatStepDate(fixedMs) : null;

  return [
    {
      id: 'reported',
      label: 'Reported',
      time: reportedTime,
      done: true,
      current: false,
    },
    {
      id: 'assigned',
      label: 'Assigned',
      time: assignedTime,
      done: techAssigned,
      current: techAssigned && !workStarted,
    },
    {
      id: 'started',
      label: 'Started',
      time: startedTime,
      done: workStarted,
      current: workStarted && !isFixed,
    },
    {
      id: 'fixed',
      label: 'Fixed',
      time: fixedTime,
      done: isFixed,
      current: isFixed,
    },
  ];
}

export default function TicketTimelineStepper({ ticket, t: tProp }) {
  const t = ticket || tProp || {};
  const stages = getTimelineStages(t);
  

  return (
    <div className="w-full">
      <div className="relative">
        {/* Sleek Connecting Lines Behind Circles */}
        <div className="absolute top-2 left-[12.5%] right-[12.5%] h-[1.5px] -translate-y-1/2 flex z-0">
          <div
            className={`flex-1 transition-all ${
              stages[1].done ? 'bg-emerald-500' : 'bg-[#c9d6d4] dark:bg-slate-700'
            }`}
          />
          <div
            className={`flex-1 transition-all ${
              stages[2].done ? 'bg-emerald-500' : 'bg-[#c9d6d4] dark:bg-slate-700'
            }`}
          />
          <div
            className={`flex-1 transition-all ${
              stages[3].done ? 'bg-emerald-500' : 'bg-[#c9d6d4] dark:bg-slate-700'
            }`}
          />
        </div>

        {/* 4 Stage Nodes */}
        <div className="grid grid-cols-4 gap-0.5 sm:gap-1 relative z-10 text-center">
          {stages.map((st) => {
            return (
              <div key={st.id} className="flex flex-col items-center group/stage cursor-default" title={`${st.label}${st.time ? ` · ${st.time}` : " · Pending"}`}>

                {/* Thin, Sleek Circle Icon */}
                {st.done ? (
                  <div className="w-4 h-4 rounded-full bg-emerald-500 text-white flex items-center justify-center shadow-xs shrink-0 ring-2 ring-white/80 dark:ring-[#101214]">
                    <Check className="w-2.5 h-2.5 stroke-[3]" />
                  </div>
                ) : st.current ? (
                  <div className="w-4 h-4 rounded-full bg-amber-500 text-white flex items-center justify-center shadow-xs shrink-0 ring-2 ring-amber-500/30 animate-pulse">
                    <Wrench className="w-2 h-2" />
                  </div>
                ) : (
                  <div className="w-4 h-4 rounded-full bg-white dark:bg-slate-800 border-[1.5px] border-[#bccbc9] dark:border-slate-600 text-[#6f8a8f] dark:text-slate-500 flex items-center justify-center shrink-0 ring-2 ring-white/80 dark:ring-[#101214] text-[8px] font-bold">
                    ○
                  </div>
                )}

                {/* Stage Title */}
                <span
                  className={`text-[9.5px] font-bold mt-1 leading-tight tracking-tight truncate max-w-full px-0.5 ${
                    st.done
                      ? 'text-slate-800 dark:text-slate-100'
                      : st.current
                        ? 'text-amber-700 dark:text-amber-400 font-extrabold'
                        : 'text-[#877c68] dark:text-slate-400'
                  }`}
                  title={st.label}
                >
                  {st.label}
                </span>

                {/* Compact Date & Time */}
                {st.time ? (
                  <span className="text-[8px] text-slate-500 dark:text-slate-400 leading-tight mt-0.5 font-medium truncate max-w-full">
                    {st.time}
                  </span>
                ) : (
                  <span className="text-[8px] text-[#9c917b] dark:text-slate-500 mt-0.5 italic">
                    Pending
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
