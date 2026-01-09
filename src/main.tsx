// import { createRoot } from "react-dom/client";
// import App from "./App.tsx";
import "./index.css";

// createRoot(document.getElementById("root")!).render(<App />);
import React from "react";
import ReactDOM from "react-dom/client";
import { GoogleOAuthProvider } from "@react-oauth/google";
import App from "./App";

ReactDOM.createRoot(document.getElementById("root")).render(
  <GoogleOAuthProvider clientId="257972565412-5u3604v1u4u69v5njimsp2a2udt36hfg.apps.googleusercontent.com">
    <App />
  </GoogleOAuthProvider>
);
