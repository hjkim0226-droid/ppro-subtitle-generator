import React from "react";
import { createRoot } from "react-dom/client";
import { initBolt } from "../lib/utils/bolt";
import { App } from "./main";
import "./main.scss";

// Initialize CEP + Load ExtendScript
initBolt();

const container = document.getElementById("root");
if (container) {
  const root = createRoot(container);
  root.render(<App />);
}
