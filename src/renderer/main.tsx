import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import "../index.css"
import App from "./App"

// Set document title
document.title = "ConfigPilot"

// Set meta description
const metaDescription = document.querySelector('meta[name="description"]')
if (metaDescription) {
  metaDescription.setAttribute("content", "Configuration Management Tool")
} else {
  const meta = document.createElement("meta")
  meta.name = "description"
  meta.content = "Configuration Management Tool"
  document.head.appendChild(meta)
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <div className="font-sans antialiased">
      <App />
    </div>
  </StrictMode>,
)
