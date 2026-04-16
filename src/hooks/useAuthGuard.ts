"use client";

import { useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useWallet } from "@txnlab/use-wallet-react";

const PUBLIC_ROUTES = ["/"];

export function useAuthGuard() {
  const router = useRouter();
  const pathname = usePathname();
  const { activeAccount, isReady } = useWallet();

  useEffect(() => {
    if (!isReady) return;

    const isAuthenticated = !!activeAccount;
    const isPublicRoute = PUBLIC_ROUTES.includes(pathname);

    if (!isAuthenticated && !isPublicRoute) {
      router.replace("/");
    }

    if (isAuthenticated && isPublicRoute) {
      router.replace("/dashboard");
    }
  }, [activeAccount, isReady, pathname, router]);

  return {
    isAuthenticated: !!activeAccount,
    isLoading: !isReady,
    address: activeAccount?.address || null,
  };
}
