/**
 * React entry point.
 *
 * Owner: D · Phase: P1
 */

import React from "react";
import ReactDOM from "react-dom/client";

import App from "@/App";
import "@/styles/index.css";
// Leaflet ships its own CSS — without this the map tiles render scrambled.
import "leaflet/dist/leaflet.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
