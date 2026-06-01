import React, { createContext, useContext, useEffect, useState } from "react";
import { DEFAULT_TENANT_ID } from "../config/tenant";

interface CurrentUser {
  id: string;
  full_name: string;
  email: string;
  role: string;
  avatar_color: string;
}

const CurrentUserContext = createContext<CurrentUser | null>(null);

export const useCurrentUser = () => useContext(CurrentUserContext);

export const CurrentUserProvider = ({ children }: { children: React.ReactNode }) => {
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);

  useEffect(() => {
    const resolveUser = async () => {
      try {
        const sessionRaw = localStorage.getItem("userSession");
        if (!sessionRaw) return;

        const session = JSON.parse(sessionRaw);
        const authUserId = session?.user?.id;
        if (!authUserId) return;

        const response = await fetch(
          `/api/users/by-auth-id?auth_user_id=${authUserId}&tenant_id=${DEFAULT_TENANT_ID}`,
        );
        if (!response.ok) return;

        const data = await response.json();
        setCurrentUser(data.user ?? null);
      } catch (error) {
        console.error("Failed to resolve current user:", error);
      }
    };

    void resolveUser();
  }, []);

  return <CurrentUserContext.Provider value={currentUser}>{children}</CurrentUserContext.Provider>;
};
