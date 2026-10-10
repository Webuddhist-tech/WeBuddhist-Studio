import { Outlet, useLocation } from "react-router-dom";
import Navbar from "./components/ui/molecules/nav-bar/Navbar";
import { setFontVariables } from "./config/font-config";
import { useEffect } from "react";
import { useTolgee } from "@tolgee/react";
import { AUTH_ROUTE_PATHS } from "./routes/paths";
import { useIsMobile } from "./hooks/useIsMobile";
import {
  MobileTabBar,
  MobileTopBar,
} from "./components/ui/molecules/nav-bar/MobileNav";

function App() {
  const location = useLocation();

  const hideNavbar = AUTH_ROUTE_PATHS.includes(location.pathname);
  const isMobile = useIsMobile();

  // Token bootstrap and renewal live in PlanAuthProvider - they have to settle
  // before the route guards read `isLoggedIn`, which a layout-level effect
  // cannot guarantee.
  const language = useTolgee(["language"]).getLanguage();
  useEffect(() => {
    setFontVariables(language ?? "en");
  }, [language]);

  return (
    // A phone stacks a top bar, the page and a tab bar; desktop keeps the sidebar.
    <div className="flex h-screen w-full max-md:h-dvh max-md:flex-col">
      {!hideNavbar && (isMobile ? <MobileTopBar /> : <Navbar />)}
      <div className="relative min-h-0 flex-1 overflow-auto">
        <Outlet />
      </div>
      {!hideNavbar && isMobile && <MobileTabBar />}
    </div>
  );
}

export default App;
