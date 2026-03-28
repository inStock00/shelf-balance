import { MapPin, Linkedin } from "lucide-react";
import { Link } from "react-router-dom";

export function AppFooter() {
  return (
    <footer className="border-t bg-card px-4 py-3">
      <div className="flex flex-col md:flex-row items-center justify-between gap-2 text-xs text-muted-foreground">
        <div className="flex items-center gap-4 flex-wrap justify-center">
          <span>
            Built by <span className="font-medium text-foreground/70">Rhenie Ramos</span> — BS Computer Science (2005) · 15+ years experience
          </span>
          <span className="hidden md:inline text-border">|</span>
          <span>React · PHP · Node.js · SAP CDC</span>
        </div>
        <div className="flex items-center gap-4">
          <span className="inline-flex items-center gap-1">
            <MapPin className="h-3 w-3" />
            Angeles City, PH
          </span>
          <a
            href="https://www.linkedin.com/in/iosh"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 hover:text-primary transition-colors"
          >
            <Linkedin className="h-3 w-3" />
            LinkedIn
          </a>
          <Link to="/contact" className="hover:text-primary transition-colors">
            Contact
          </Link>
        </div>
      </div>
    </footer>
  );
}
