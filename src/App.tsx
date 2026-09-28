import { Outlet, useLocation } from "react-router-dom";
import Navbar from "./components/ui/molecules/nav-bar/Navbar";
import { setFontVariables } from "./config/font-config";
import { useEffect } from "react";
import { LANGUAGE } from "./lib/constant";
import { AUTH_ROUTE_PATHS } from "./routes/paths";

function App() {
  const location = useLocation();

  const hideNavbar = AUTH_ROUTE_PATHS.includes(location.pathname);

  // Token bootstrap and renewal live in PlanAuthProvider - they have to settle
  // before the route guards read `isLoggedIn`, which a layout-level effect
  // cannot guarantee.
  useEffect(() => {
    setFontVariables(localStorage.getItem(LANGUAGE) || "en");
  }, []);

  return (
    <div className="flex h-screen w-full">
      {!hideNavbar && <Navbar />}
      <div className="flex-1 overflow-auto">
        <Outlet />
      </div>
    </div>
  );
}

export default App;
