"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReactNode, useState, useMemo } from "react";
import { WalletProvider, WalletManager, NetworkId, WalletId } from "@txnlab/use-wallet-react";


const defaultManager = new WalletManager({
  wallets: [
    WalletId.DEFLY,
    WalletId.PERA,
    {
      id: WalletId.LUTE,
      options: { siteName: "0rca Swarm Dojo" }
    }
  ],
  defaultNetwork: NetworkId.TESTNET,
  networks: {
    [NetworkId.TESTNET]: {
      algod: {
        baseServer: "https://testnet-api.algonode.cloud",
        port: "",
        token: "",
      },
    },
  },
});

export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30_000,
            refetchOnWindowFocus: false,
          },
        },
      })
  );

  const manager = useMemo(() => defaultManager, []);

  return (
    <WalletProvider manager={manager}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </WalletProvider>
  );
}
