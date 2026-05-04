import React from "react";
import ReactDOM from "react-dom/client";
import "../styles/base.css";

function SidePanelBoot() {
  return <main>工作台初始化中…</main>;
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <SidePanelBoot />
  </React.StrictMode>,
);
