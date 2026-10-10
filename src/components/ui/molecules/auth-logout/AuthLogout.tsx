import React from "react";
import { Button } from "../../atoms/button";
import { IoIosLogOut } from "react-icons/io";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/config/auth-context";
import { useTranslate } from "@tolgee/react";

const AuthLogout = () => {
  const navigate = useNavigate();
  const { logout } = useAuth();
  const { t } = useTranslate();
  function handleLogout(e: React.MouseEvent<HTMLButtonElement>) {
    e.preventDefault();
    logout();
    navigate("/login");
  }
  return (
    <Button
      size="icon"
      onClick={handleLogout}
      variant="outline"
      aria-label={t("studio.nav.logout")}
    >
      <IoIosLogOut className="w-4 h-4" />
    </Button>
  );
};

export default AuthLogout;
