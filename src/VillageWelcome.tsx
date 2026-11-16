/** A lightweight, offline illustration using the same domes and garden colours as the scene. */
export function VillageWelcome() {
  return (
    <aside className="village-intro">
      <a className="village-wordmark" href="/">
        ✳ galaxi<span>a little world of your own</span>
      </a>
      <div className="village-intro-copy">
        <span className="village-kicker">
          EVERY GREAT ADVENTURE STARTS WITH AN IDEA
        </span>
        <h2>
          A world of ideas
          <br />
          comes to life<span>.</span>
        </h2>
        <p>
          A wonderfully wild world for your projects. Cook up an idea and watch
          your little crew bring it to life.
        </p>
      </div>
      <svg
        className="village-illustration"
        viewBox="0 0 560 380"
        role="img"
        aria-label="A candy-colored world with floating doughnuts, raining meatballs, fluffy clouds and a little project village"
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
            <ellipse cy="-6" rx="15" ry="20" fill="#f3a5ce" />
            <ellipse cx="-5" cy="-12" rx="10" ry="14" fill="#ffd0e4" />
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
        <g
          className="welcome-food welcome-donut"
          transform="translate(155 75) rotate(-20)"
        >
          <circle r="29" fill="#df934a" />
          <circle r="24" fill="#ff83b5" />
          <circle r="10" fill="#bcebf0" />
          <path
            d="M-18-10l5 3m23-10 3 6m-3 29 6-3m-30 3 5-4"
            stroke="#fff1a0"
            strokeWidth="4"
            strokeLinecap="round"
          />
        </g>
        <g
          className="welcome-food welcome-burger"
          transform="translate(360 103) rotate(12)"
        >
          <path d="M-30 0a30 27 0 0 1 60 0" fill="#ffc064" />
          <path
            d="M-29 4h58"
            stroke="#83c958"
            strokeWidth="8"
            strokeLinecap="round"
          />
          <path
            d="M-27 13h54"
            stroke="#924b34"
            strokeWidth="10"
            strokeLinecap="round"
          />
          <path
            d="M-26 22h52"
            stroke="#ffc064"
            strokeWidth="10"
            strokeLinecap="round"
          />
        </g>
        <g className="welcome-food welcome-meatballs" fill="#b96840">
          <circle cx="255" cy="55" r="12" />
          <circle cx="470" cy="140" r="15" />
          <circle cx="66" cy="155" r="9" />
        </g>
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
          fill="#a4dfbe"
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
          fill="#ffb95d"
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
