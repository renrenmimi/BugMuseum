import { ImageResponse } from "next/og";

export const alt = "Bug Museum — real bugs, with the working out left in";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: "#14120f",
          padding: "72px 80px",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <span
            style={{
              color: "#8d8474",
              fontSize: 26,
              letterSpacing: 6,
              textTransform: "uppercase",
            }}
          >
            Bug Museum
          </span>
          <span style={{ color: "#8d8474", fontSize: 26, letterSpacing: 6 }}>
            EST. 2026
          </span>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 26 }}>
          <span
            style={{
              color: "#ece5d8",
              fontSize: 78,
              lineHeight: 1.08,
              letterSpacing: -2,
            }}
          >
            Real bugs, with the
          </span>
          <span
            style={{
              color: "#ece5d8",
              fontSize: 78,
              lineHeight: 1.08,
              letterSpacing: -2,
            }}
          >
            working out left in.
          </span>
          <span style={{ color: "#b7ad9d", fontSize: 30, marginTop: 12 }}>
            Six defects from four of my own projects — broken, first fix, fixed.
          </span>
        </div>

        <div style={{ display: "flex", gap: 18, alignItems: "center" }}>
          {[
            ["#e2695a", "Broken"],
            ["#d9a038", "First fix"],
            ["#5cbfa0", "Fixed"],
          ].map(([colour, label]) => (
            <div
              key={label}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                border: `1px solid ${colour}`,
                borderRadius: 999,
                padding: "10px 22px",
                color: colour,
                fontSize: 26,
                letterSpacing: 2,
              }}
            >
              <div
                style={{
                  width: 14,
                  height: 14,
                  borderRadius: 999,
                  background: colour,
                }}
              />
              {label}
            </div>
          ))}
        </div>
      </div>
    ),
    size,
  );
}
