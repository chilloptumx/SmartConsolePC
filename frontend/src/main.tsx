
  import { createRoot } from "react-dom/client";
  import App from "./app/App.tsx";
  import "./styles/index.css";

  // Ensure dark theme tokens apply to Radix portals (Dialogs, Selects, etc.) which render under <body>.
  document.documentElement.classList.add("dark");

  createRoot(document.getElementById("root")!).render(<App />);
  