import { useNavigate } from 'react-router';
import { Plus, Clock } from 'lucide-react';
import { useState, useEffect } from 'react';

export function LandingPage() {
  const navigate = useNavigate();
  const [typedText, setTypedText] = useState('');
  const fullText = 'rack. configure. connect.';

  const words = [
    { text: 'FOX', height: 22 },
    { text: 'NEWS', height: 22 },
    { text: 'BROADCAST', height: 22 },
    { text: 'ENGINEERING', height: 22 },
  ];

  const [positions, setPositions] = useState([0, 1, 2, 3]);

  useEffect(() => {
    let currentIndex = 0;
    const typingInterval = setInterval(() => {
      if (currentIndex <= fullText.length) {
        setTypedText(fullText.slice(0, currentIndex));
        currentIndex++;
      } else {
        clearInterval(typingInterval);
      }
    }, 100);

    return () => clearInterval(typingInterval);
  }, []);

  useEffect(() => {
    let shuffleInterval: ReturnType<typeof setInterval> | undefined;
    const initialTimeout = setTimeout(() => {
      shuffleInterval = setInterval(() => {
        setPositions((prev) => {
          const newPositions = [...prev];
          for (let i = newPositions.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [newPositions[i], newPositions[j]] = [newPositions[j], newPositions[i]];
          }
          return newPositions;
        });
      }, 3000);
    }, 3000);

    return () => {
      clearTimeout(initialTimeout);
      if (shuffleInterval) clearInterval(shuffleInterval);
    };
  }, []);

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      <div className="absolute inset-0 opacity-10">
        <div
          className="absolute inset-0"
          style={{
            backgroundImage:
              'linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)',
            backgroundSize: '50px 50px',
          }}
        />
      </div>

      <div className="relative z-10 px-6 text-center">
        <div className="relative mb-8">
          <div className="relative inline-block">
            <svg width="400" height="250" viewBox="0 0 400 250" className="mx-auto mb-4">
              <g className="animate-fade-in">
                <rect
                  x="20"
                  y="20"
                  width="8"
                  height="200"
                  fill="#003366"
                  className="animate-slide-down"
                  style={{ animationDelay: '0s' }}
                />
                <rect
                  x="372"
                  y="20"
                  width="8"
                  height="200"
                  fill="#003366"
                  className="animate-slide-down"
                  style={{ animationDelay: '0.1s' }}
                />

                {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
                  <g key={i} className="animate-fade-in" style={{ animationDelay: `${0.2 + i * 0.1}s` }}>
                    <line
                      x1="28"
                      y1={30 + i * 25}
                      x2="372"
                      y2={30 + i * 25}
                      stroke="#004080"
                      strokeWidth="1"
                      strokeDasharray="4 4"
                    />
                  </g>
                ))}

                {words.map((word, wordIndex) => {
                  const yPositions = [40, 75, 110, 145];
                  const textYPositions = [51, 86, 121, 156];
                  const animationDelays = ['0.5s', '0.7s', '0.9s', '1.1s'];
                  const slideAnimations = [
                    'animate-slide-in-left',
                    'animate-slide-in-right',
                    'animate-slide-in-left',
                    'animate-slide-in-right',
                  ];

                  const currentSlot = positions.indexOf(wordIndex);
                  const targetY = yPositions[currentSlot];
                  const targetTextY = textYPositions[currentSlot];

                  return (
                    <g
                      key={wordIndex}
                      className={slideAnimations[wordIndex]}
                      style={{
                        animationDelay: animationDelays[wordIndex],
                      }}
                    >
                      <rect
                        x="40"
                        y={targetY}
                        width="320"
                        height={word.height}
                        fill="#CC0000"
                        rx="2"
                        style={{ transition: 'y 0.8s cubic-bezier(0.4, 0, 0.2, 1)' }}
                      >
                        <animate attributeName="opacity" values="0.85;1;0.85" dur="2s" repeatCount="indefinite" />
                      </rect>
                      <text
                        x="200"
                        y={targetTextY}
                        textAnchor="middle"
                        fill="white"
                        fontSize="12"
                        fontWeight="bold"
                        style={{ transition: 'y 0.8s cubic-bezier(0.4, 0, 0.2, 1)' }}
                      >
                        {word.text}
                      </text>
                    </g>
                  );
                })}
              </g>
            </svg>

            <div className="relative flex items-center justify-center gap-2">
              <h1
                className="flex text-8xl font-black tracking-tighter text-white"
                style={{ fontFamily: 'system-ui, -apple-system, sans-serif' }}
              >
                <span className="inline-block animate-letter-slide" style={{ animationDelay: '0.1s' }}>
                  R
                </span>
                <span className="inline-block animate-letter-slide" style={{ animationDelay: '0.2s' }}>
                  A
                </span>
                <span className="inline-block animate-letter-slide" style={{ animationDelay: '0.3s' }}>
                  C
                </span>
                <span className="inline-block animate-letter-slide" style={{ animationDelay: '0.4s' }}>
                  K
                </span>
                <span className="inline-block animate-plus-spin text-[#CC0000]" style={{ animationDelay: '0.5s' }}>
                  +
                </span>
              </h1>
            </div>
          </div>
        </div>

        <div className="mb-16">
          <div className="flex min-h-[40px] items-center justify-center text-3xl font-light uppercase tracking-[0.3em] text-blue-200">
            <span className="typewriter">{typedText}</span>
            <span className="ml-1 cursor-blink">|</span>
          </div>
          
        </div>

        <div className="mx-auto flex max-w-4xl flex-col items-center justify-center gap-6 sm:flex-row">
          <button
            type="button"
            onClick={() => navigate('/rack?new=1')}
            className="group relative w-full rounded-2xl border-2 border-red-400 bg-gradient-to-br from-[#CC0000] to-red-700 p-8 text-white shadow-2xl transition-all duration-300 hover:scale-105 hover:shadow-red-500/50 sm:w-96"
          >
            <div className="flex flex-col items-center gap-4">
              <div className="rounded-full bg-white/10 p-4 transition-all group-hover:bg-white/20">
                <Plus className="size-12" strokeWidth={3} />
              </div>
              <div>
                <h2 className="text-3xl font-black uppercase tracking-tight">Build a New Rack</h2>
                <p className="mt-2 text-sm font-medium text-red-100">Import CSV or manually configure devices</p>
              </div>
            </div>
            <div className="pointer-events-none absolute inset-0 rounded-2xl bg-gradient-to-r from-transparent via-white/10 to-transparent opacity-0 transition-opacity group-hover:opacity-100" />
          </button>

          <button
            type="button"
            onClick={() => navigate('/edit')}
            className="group relative w-full rounded-2xl border-2 border-blue-400 bg-gradient-to-br from-[#003366] to-[#004080] p-8 text-white shadow-2xl transition-all duration-300 hover:scale-105 hover:shadow-blue-500/50 sm:w-96"
          >
            <div className="flex flex-col items-center gap-4">
              <div className="rounded-full bg-white/10 p-4 transition-all group-hover:bg-white/20">
                <Clock className="size-12" strokeWidth={3} />
              </div>
              <div>
                <h2 className="text-3xl font-black uppercase tracking-tight">Edit Existing Rack</h2>
                <p className="mt-2 text-sm font-medium text-blue-100">View and modify saved rack configurations</p>
              </div>
            </div>
            <div className="pointer-events-none absolute inset-0 rounded-2xl bg-gradient-to-r from-transparent via-white/10 to-transparent opacity-0 transition-opacity group-hover:opacity-100" />
          </button>
        </div>

       
      </div>

      <style>{`
        @keyframes fade-in {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes slide-down {
          from { transform: translateY(-100px); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
        @keyframes slide-in-left {
          from { transform: translateX(-50px); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
        @keyframes slide-in-right {
          from { transform: translateX(50px); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
        @keyframes letter-slide {
          from { transform: translateY(-100px) rotate(-180deg); opacity: 0; }
          to { transform: translateY(0) rotate(0deg); opacity: 1; }
        }
        @keyframes plus-spin {
          from { transform: scale(0) rotate(0deg); opacity: 0; }
          50% { transform: scale(1.5) rotate(360deg); }
          to { transform: scale(1) rotate(720deg); opacity: 1; }
        }
        @keyframes cursor-blink {
          0%, 50% { opacity: 1; }
          51%, 100% { opacity: 0; }
        }
        .animate-fade-in {
          animation: fade-in 1s ease-out forwards;
          opacity: 0;
        }
        .animate-slide-down {
          animation: slide-down 0.8s ease-out forwards;
          opacity: 0;
        }
        .animate-slide-in-left {
          animation: slide-in-left 0.6s ease-out forwards;
          opacity: 0;
        }
        .animate-slide-in-right {
          animation: slide-in-right 0.6s ease-out forwards;
          opacity: 0;
        }
        .animate-letter-slide {
          animation: letter-slide 0.8s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
          opacity: 0;
        }
        .animate-plus-spin {
          animation: plus-spin 1.2s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
          opacity: 0;
        }
        .cursor-blink {
          animation: cursor-blink 1s step-end infinite;
        }
        .animate-fade-in-delayed {
          animation: fade-in 1s ease-out 3s forwards;
          opacity: 0;
        }
      `}</style>
    </div>
  );
}
