import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import FlightPlanner from "./flight-planner.jsx";

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <FlightPlanner />
  </StrictMode>
);
