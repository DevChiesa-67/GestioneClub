"use client";

import RugbyPitch from "../RugbyPitch";

type Props = {
  coloreClub?: string;
};

function Player({
  x,
  y,
  label,
  color = "#ffffff",
  delay = "0s",
  move = false,
}: {
  x: number;
  y: number;
  label: string;
  color?: string;
  delay?: string;
  move?: boolean;
}) {
  return (
    <div
      className={`absolute flex h-8 w-8 items-center justify-center rounded-full border-2 text-xs font-bold text-zinc-950 shadow-lg ${
        move ? "animate-rambo-run" : ""
      }`}
      style={{
        left: `${x}%`,
        top: `${y}%`,
        backgroundColor: color,
        borderColor: "rgba(255,255,255,.85)",
        animationDelay: delay,
      }}
    >
      {label}
    </div>
  );
}

export default function RamboAnimation({ coloreClub = "#E3A71E" }: Props) {
  return (
    <div>
      <RugbyPitch>
        <style jsx>{`
          @keyframes ramboRun {
            0% {
              transform: translate(0, 0);
            }
            35% {
              transform: translate(-2%, 0);
            }
            100% {
              transform: translate(-90px, -45px);
            }
          }

          @keyframes ballMove {
            0% {
              transform: translate(0, 0) scale(1);
              opacity: 1;
            }
            35% {
              transform: translate(-5px, 0) scale(1);
              opacity: 1;
            }
            100% {
              transform: translate(-90px, -45px) scale(0.9);
              opacity: 1;
            }
          }

          @keyframes arrowShow {
            0%,
            20% {
              opacity: 0;
              stroke-dashoffset: 100;
            }
            100% {
              opacity: 1;
              stroke-dashoffset: 0;
            }
          }

          .animate-rambo-run {
            animation: ramboRun 4.5s ease-in-out infinite;
          }

          .animate-ball {
            animation: ballMove 4.5s ease-in-out infinite;
          }

          .animate-arrow {
            stroke-dasharray: 100;
            animation: arrowShow 4.5s ease-in-out infinite;
          }
        `}</style>

        <svg
          viewBox="0 0 100 62"
          className="absolute inset-0 h-full w-full"
          preserveAspectRatio="none"
        >
          <path
            d="M 43 31 C 37 29, 31 24, 25 18"
            fill="none"
            stroke={coloreClub}
            strokeWidth="1.5"
            strokeLinecap="round"
            className="animate-arrow"
          />

          <polygon points="25,18 28,18 26,21" fill={coloreClub} />
        </svg>

        <div className="absolute left-[40%] top-[38%] rounded-2xl border border-white/20 bg-black/25 px-3 py-2 text-xs text-white">
          Mischia
        </div>

        <Player x={42} y={49} label="1" />
        <Player x={46} y={49} label="2" />
        <Player x={50} y={49} label="3" />

        <Player x={43} y={42} label="4" />
        <Player x={49} y={42} label="5" />

        <Player x={40} y={34} label="6" />
        <Player x={52} y={34} label="7" />

        <Player x={45} y={28} label="8" color={coloreClub} move />

        <div
          className="animate-ball absolute h-4 w-5 rounded-full bg-orange-700 shadow-lg"
          style={{
            left: "47%",
            top: "32%",
          }}
        />

        <div className="absolute bottom-4 left-4 right-4 rounded-2xl border border-zinc-700 bg-zinc-950/80 p-3 text-sm text-zinc-200 backdrop-blur">
          <b className="text-white">Rambo</b>: l’8 controlla la palla in uscita
          dalla mischia ed esce sul lato sinistro.
        </div>
      </RugbyPitch>
    </div>
  );
}