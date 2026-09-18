import "@/styles/youtube-loader.css";

interface Props {
  className?: string;
  color?: "youtube" | "brand";
}

export default function YouTubeLoader({ className = "", color = "youtube" }: Props) {
  return (
    <div
      className={["yt-loader", color === "brand" ? "yt-loader--brand" : "", className].filter(Boolean).join(" ")}
      role="progressbar"
      aria-label="Loading"
      aria-busy="true"
    >
      <div className="yt-loader__bar yt-loader__bar--primary" />
      <div className="yt-loader__bar yt-loader__bar--secondary" />
    </div>
  );
}
