import styles from "../styles/storefront.module.css";

export default function PlacementPreview({
  placement,
}: {
  placement: "announcement" | "product" | "cart";
}) {
  return (
    <div className={styles.preview} aria-hidden="true">
      <svg viewBox="0 0 280 160" fill="none" focusable="false">
        <rect
          x="16"
          y="12"
          width="248"
          height="140"
          rx="8"
          fill="white"
          stroke="#d9dce0"
        />
        <path d="M16 34H264" stroke="#e9eaec" />
        <circle cx="28" cy="23" r="2" fill="#b8bdc4" />
        <circle cx="36" cy="23" r="2" fill="#b8bdc4" />
        <circle cx="44" cy="23" r="2" fill="#b8bdc4" />
        <rect x="109" y="20" width="64" height="5" rx="2.5" fill="#eceef0" />
        {placement === "announcement" ? (
          <>
            <rect x="26" y="42" width="228" height="24" rx="4" fill="#e8e0ff" />
            <text
              x="140"
              y="57"
              textAnchor="middle"
              fill="#55309a"
              fontSize="9"
              fontWeight="600"
            >
              Your offer, across your store
            </text>
            <rect x="26" y="75" width="228" height="28" rx="4" fill="#f1f2f3" />
            {[26, 105, 184].map((x) => (
              <g key={x}>
                <rect
                  x={x}
                  y="112"
                  width="70"
                  height="22"
                  rx="3"
                  fill="#eceef0"
                />
                <rect
                  x={x}
                  y="140"
                  width="40"
                  height="3"
                  rx="1.5"
                  fill="#d9dce0"
                />
              </g>
            ))}
          </>
        ) : placement === "product" ? (
          <>
            <rect x="26" y="44" width="98" height="96" rx="4" fill="#f1eee9" />
            <rect
              x="59"
              y="60"
              width="32"
              height="64"
              rx="4"
              fill="#d6c8b5"
              transform="rotate(-8 75 92)"
            />
            <rect x="138" y="47" width="105" height="6" rx="3" fill="#c4c8ce" />
            <rect
              x="138"
              y="61"
              width="45"
              height="5"
              rx="2.5"
              fill="#d9dce0"
            />
            <rect
              x="134"
              y="79"
              width="116"
              height="29"
              rx="4"
              fill="#e8e0ff"
            />
            <text
              x="192"
              y="97"
              textAnchor="middle"
              fill="#55309a"
              fontSize="9"
              fontWeight="600"
            >
              Your product offer
            </text>
            <rect
              x="138"
              y="119"
              width="106"
              height="17"
              rx="4"
              fill="#303030"
            />
            <text x="191" y="131" textAnchor="middle" fill="white" fontSize="8">
              Add to cart
            </text>
          </>
        ) : (
          <>
            <rect x="26" y="44" width="228" height="42" rx="4" fill="#e0f0e8" />
            <text x="38" y="60" fill="#235c42" fontSize="9" fontWeight="600">
              A little closer to your offer
            </text>
            <rect
              x="38"
              y="69"
              width="204"
              height="5"
              rx="2.5"
              fill="#bcdccb"
            />
            <rect
              x="38"
              y="69"
              width="130"
              height="5"
              rx="2.5"
              fill="#38865b"
            />
            {[97, 124].map((y) => (
              <g key={y}>
                <rect
                  x="26"
                  y={y}
                  width="22"
                  height="20"
                  rx="3"
                  fill="#ece8e2"
                />
                <rect
                  x="57"
                  y={y + 3}
                  width="85"
                  height="4"
                  rx="2"
                  fill="#d0d4d9"
                />
                <rect
                  x="57"
                  y={y + 12}
                  width="43"
                  height="3"
                  rx="1.5"
                  fill="#e4e6e9"
                />
                <rect
                  x="225"
                  y={y + 4}
                  width="28"
                  height="4"
                  rx="2"
                  fill="#d0d4d9"
                />
              </g>
            ))}
          </>
        )}
      </svg>
      <span className={styles.previewCaption}>Example placement</span>
    </div>
  );
}
