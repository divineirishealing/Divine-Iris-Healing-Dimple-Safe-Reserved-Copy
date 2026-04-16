import "./axiosRetry";
import React from "react";
import ReactDOM from "react-dom/client";
import "@/index.css";
import App from "@/App";

// Free-tier: cache shell + assets so navigations still resolve if the CDN hiccups during deploy.
if (process.env.NODE_ENV === "production" && "serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    const base = (process.env.PUBLIC_URL || "").replace(/\/$/, "") || "";
    navigator.serviceWorker.register(`${base}/service-worker.js`).catch(() => {});
  });
}

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
