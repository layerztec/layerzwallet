import "./polyfills";

import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import { initElectrobunRpc } from "./modules/init-electrobun";
import "./index.css";
import App from "./pages/App";

initElectrobunRpc();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
