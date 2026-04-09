"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReactNode, useState, useMemo } from "react";
import { WalletProvider, WalletManager, NetworkId, WalletId } from "@txnlab/use-wallet-react";
import { DeflyWalletConnect } from "@blockshake/defly-connect";
import { PeraWalletConnect } from "@perawallet/connect";

const defaultManager = new WalletManager({
  wallets: [
    {
      id: WalletId.DEFLY,
      options: {
        bridge: "https://walletconnect.algorand.network",
      },
    },
    {
      id: WalletId.PERA,
      options: {
        shouldShowSignTxnToast: true,
      },
    },
  ],
  network: NetworkId.TESTNET,
  algod: {
    baseServer: "https://testnet-api.algonode.cloud",
    port: "",
    token: "",
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
