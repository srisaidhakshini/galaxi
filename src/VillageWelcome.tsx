/** A lightweight, offline illustration using the same domes and garden colours as the scene. */
export function VillageWelcome() {
  return (
    <aside className="village-intro">
      <a className="village-wordmark" href="/">
        ✳ galaxi<span>a little world of your own</span>
      </a>
      <div className="village-intro-copy">
        <span className="village-kicker">MAKE ROOM FOR YOUR NEXT IDEA</span>
        <h2>
          Good things
          <br />
          grow here<span>.</span>
        </h2>
        <p>A home for your projects. A little crew to bring them to life.</p>
      </div>
      <svg
        className="village-illustration"
        viewBox="0 0 560 380"
        role="img"
        aria-label="A friendly illustrated village with glass domes, trees, a fountain and winding paths"
      >
        <defs>
          <linearGradient id="village-glass" x2="0.8" y2="1">
            <stop stopColor="#e5f1e9" stopOpacity=".9" />
            <stop offset="1" stopColor="#acc9b9" stopOpacity=".7" />
          </linearGradient>
          <g id="welcome-tree">
            <path
              d="M0 0v24"
              stroke="#9b8063"
              strokeWidth="5"
              strokeLinecap="round"
            />
            <ellipse cy="-6" rx="15" ry="20" fill="#8fae8b" />
            <ellipse cx="-5" cy="-12" rx="10" ry="14" fill="#b6cda3" />
          </g>
          <g id="welcome-dome">
            <ellipse cy="7" rx="55" ry="16" fill="#b6a788" opacity=".23" />
            <ellipse rx="52" ry="14" fill="#e6c19e" />
            <path
              d="M-49 0a49 49 0 0 1 98 0Z"
              fill="url(#village-glass)"
              stroke="#fff9e9"
              strokeWidth="4"
            />
            <path
              d="M-49 0Q0-25 49 0M-43-23Q0-40 43-23M-24-42Q-40-19-25 5M0-49V8M24-42Q40-19 25 5"
              fill="none"
              stroke="#fff9e9"
              strokeWidth="2.5"
            />
            <path
              d="M-49 0L-24-23 0 0 24-23 49 0M-24-23 0-44 24-23"
              fill="none"
              stroke="#fff9e9"
              strokeWidth="2"
            />
            <rect
              x="-9"
              y="-16"
              width="18"
              height="25"
              rx="8"
              fill="#6f9584"
              stroke="#fff9e9"
              strokeWidth="3"
            />
            <circle cx="4" cy="-3" r="1.5" fill="#f7d597" />
          </g>
        </defs>
        <circle cx="431" cy="64" r="29" fill="#f2d697" />
        <path d="M65 98q9-19 23-8 20-22 35 5 22-4 24 10H65Z" fill="#fffdf4" />
        <path d="M324 32q9-14 19-6 14-16 28 4 14-2 15 8h-62Z" fill="#fffdf4" />
        <ellipse
          cx="278"
          cy="258"
          rx="217"
          ry="94"
          fill="#e2d7ba"
          opacity=".35"
        />
        <path
          d="M64 242C41 186 131 143 230 144c111-31 245 22 260 82 38 79-100 115-204 113C161 353 74 306 64 242Z"
          fill="#d5dfbd"
        />
        <path
          d="M153 213q58 63 124 43t114-34M279 256l31 63"
          fill="none"
          stroke="#f9f1d9"
          strokeWidth="15"
          strokeLinecap="round"
        />
        <use href="#welcome-tree" x="99" y="213" />
        <use href="#welcome-tree" x="455" y="235" />
        <use href="#welcome-tree" x="408" y="169" />
        <use href="#welcome-tree" x="211" y="302" />
        <use href="#welcome-dome" transform="translate(171 211) scale(1.05)" />
        <use href="#welcome-dome" transform="translate(364 225) scale(.83)" />
        <ellipse cx="274" cy="266" rx="36" ry="15" fill="#faf0d6" />
        <ellipse cx="274" cy="263" rx="29" ry="10" fill="#81b7ac" />
        <path
          d="M274 259v-25m0 7q-12-12-17 0m17 0q12-12 17 0"
          stroke="#c7e7da"
          strokeWidth="3"
          fill="none"
          strokeLinecap="round"
        />
        <g fill="#d69b7f">
          <rect
            x="105"
            y="270"
            width="24"
            height="8"
            rx="3"
            transform="rotate(20 105 270)"
          />
          <rect
            x="321"
            y="289"
            width="24"
            height="8"
            rx="3"
            transform="rotate(-18 321 289)"
          />
        </g>
        <g stroke="#719082" strokeWidth="3" strokeLinecap="round">
          <path d="M231 194v29m166 32v27" />
        </g>
        <g fill="#f6dc9a">
          <circle cx="231" cy="191" r="5" />
          <circle cx="397" cy="251" r="5" />
        </g>
        <g transform="translate(237 275)">
          <circle cy="-10" r="4" fill="#d9aa82" />
          <path d="M-5-6h10v12H-5Z" fill="#c87961" />
          <path
            d="M-3 6v7m6-7v7"
            stroke="#6b8270"
            strokeWidth="3"
            strokeLinecap="round"
          />
          <path d="M-6-13q6-8 12 0Z" fill="#efce83" />
        </g>
        <g fill="#f6ebc4">
          <circle cx="126" cy="242" r="3" />
          <circle cx="140" cy="280" r="3" />
          <circle cx="408" cy="286" r="3" />
        </g>
        <path
          d="m91 139 4-9 4 9 9 4-9 4-4 9-4-9-9-4Zm361-16 3-6 3 6 6 3-6 3-3 6-3-6-6-3Z"
          fill="#b7c7a5"
        />
      </svg>
      <div className="village-intro-note">
        <span aria-hidden="true">⌂</span>
        <div>
          <strong>Made on your computer.</strong>
          <span>Your code stays close to home.</span>
        </div>
      </div>
    </aside>
  );
}
