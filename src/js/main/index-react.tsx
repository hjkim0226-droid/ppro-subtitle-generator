import React from "react";
import { createRoot } from "react-dom/client";
import { initializeCEP } from "../lib/utils/init-cep";
import { App } from "./main";
import "./main.scss";

initializeCEP();

const container = document.getElementById("root");
if (container) {
  const root = createRoot(container);
  root.render(<App />);
}
