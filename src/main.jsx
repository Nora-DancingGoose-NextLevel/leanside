import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import RecursiveGranularityPage from "./recursive_granularity/RecursiveGranularityPage.jsx";

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <RecursiveGranularityPage />
  </StrictMode>
);
