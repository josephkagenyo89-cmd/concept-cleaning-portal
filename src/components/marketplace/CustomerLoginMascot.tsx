export default function CustomerLoginMascot() {
  return (
    <div className="relative mx-auto flex h-44 w-56 items-end justify-center">
      <div className="absolute left-1/2 top-2 -translate-x-1/2 animate-bounce text-xl">
        ✨
      </div>

      <div
        className="absolute bottom-0 left-1/2 -translate-x-1/2"
        style={{
          animation: 'customerMascotFloat 3s ease-in-out infinite',
        }}
      >
        <svg
          width="150"
          height="170"
          viewBox="0 0 150 170"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          aria-label="Concept Cleaning Services cleaner"
          role="img"
        >
          {/* Head */}
          <circle cx="75" cy="38" r="25" fill="#8D5524" />

          {/* Hair */}
          <path
            d="M52 34C53 15 67 8 77 10C91 8 101 19 99 34C92 27 84 24 74 25C66 25 59 28 52 34Z"
            fill="#222222"
          />

          {/* Face */}
          <circle cx="67" cy="38" r="2.5" fill="#222222" />
          <circle cx="83" cy="38" r="2.5" fill="#222222" />

          <path
            d="M68 49C72 53 78 53 82 49"
            stroke="#222222"
            strokeWidth="2.5"
            strokeLinecap="round"
          />

          {/* Uniform */}
          <path
            d="M48 67C48 57 57 53 75 53C93 53 102 57 102 67L108 119H42L48 67Z"
            fill="#0B3D91"
          />

          {/* Gold uniform accent */}
          <path
            d="M75 55V118"
            stroke="#C9A227"
            strokeWidth="4"
          />

          {/* Green uniform accent */}
          <path
            d="M49 74L67 68"
            stroke="#00A651"
            strokeWidth="5"
            strokeLinecap="round"
          />

          {/* Left arm */}
          <path
            d="M49 70C38 78 35 92 31 103"
            stroke="#8D5524"
            strokeWidth="11"
            strokeLinecap="round"
          />

          {/* Right arm */}
          <path
            d="M101 70C111 77 116 84 123 91"
            stroke="#8D5524"
            strokeWidth="11"
            strokeLinecap="round"
          />

          {/* Pointing hand */}
          <path
            d="M119 88L136 82"
            stroke="#8D5524"
            strokeWidth="7"
            strokeLinecap="round"
          />

          {/* Spray bottle */}
          <g
            style={{
              transformOrigin: '29px 106px',
              animation: 'customerMascotSpray 2.5s ease-in-out infinite',
            }}
          >
            <rect
              x="20"
              y="92"
              width="18"
              height="29"
              rx="5"
              fill="#00A651"
            />

            <path
              d="M25 92V86H36L39 91"
              stroke="#0B3D91"
              strokeWidth="5"
              strokeLinecap="round"
            />
          </g>

          {/* Legs */}
          <path
            d="M60 119V150"
            stroke="#222222"
            strokeWidth="13"
            strokeLinecap="round"
          />

          <path
            d="M90 119V150"
            stroke="#222222"
            strokeWidth="13"
            strokeLinecap="round"
          />

          {/* Shoes */}
          <path
            d="M51 151H66"
            stroke="#333333"
            strokeWidth="8"
            strokeLinecap="round"
          />

          <path
            d="M84 151H99"
            stroke="#333333"
            strokeWidth="8"
            strokeLinecap="round"
          />
        </svg>
      </div>

      <div className="absolute right-0 top-20 animate-pulse rounded-full bg-market/10 px-3 py-1 text-xs font-medium text-market">
        Let's get started!
      </div>

      <style>{`
        @keyframes customerMascotFloat {
          0%, 100% {
            transform: translate(-50%, 0);
          }

          50% {
            transform: translate(-50%, -7px);
          }
        }

        @keyframes customerMascotSpray {
          0%, 100% {
            transform: rotate(0deg);
          }

          50% {
            transform: rotate(-8deg);
          }
        }
      `}</style>
    </div>
  );
}