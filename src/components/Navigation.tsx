"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { WalletButton } from "./WalletButton";
import { WalletModal } from "./WalletModal";
import { cn } from "@/lib/utils";
import { LogOut, Wallet, Menu } from "lucide-react";
import { useWallet } from "@txnlab/use-wallet-react";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

const navItems = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/marketplace", label: "Marketplace" },
  { href: "/hire", label: "Hire Agent" },
  { href: "/build", label: "Build Agent" },
  { href: "/profile", label: "Profile" },
];

export function Navigation() {
  const pathname = usePathname();
  const { activeAccount, wallets } = useWallet();
  const [isWalletModalOpen, setIsWalletModalOpen] = useState(false);

  const connectedWallet = wallets.find((w) => w.isConnected);

  return (
    <nav className="bg-white/80 backdrop-blur-md border-b border-gray-100 sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-6 sm:px-8">
        <div className="flex items-center justify-between h-20">
          <Link href="/dashboard" className="flex items-center gap-3 group">
            <div className="w-10 h-10 rounded-xl bg-dojo-teal flex items-center justify-center text-white shadow-lg shadow-dojo-teal/20 transition-transform group-hover:scale-105">
              <span className="font-heading font-bold text-xl leading-none">0</span>
            </div>
            <div className="flex flex-col">
              <span className="font-heading font-bold text-dojo-heading tracking-tight leading-none">
                0rca Swarm Dojo
              </span>
              <span className="text-[10px] text-dojo-teal font-medium uppercase tracking-[0.2em] mt-1 opacity-70">
                Zen Tech Dojo 道場
              </span>
            </div>
          </Link>

          <div className="hidden md:flex items-center gap-8">
            <div className="flex items-center gap-1 bg-gray-50 p-1.5 rounded-2xl border border-gray-100">
              {navItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "px-4 py-2 rounded-xl text-sm font-medium transition-all duration-200",
                    pathname === item.href
                      ? "bg-white text-dojo-teal shadow-sm ring-1 ring-black/5"
                      : "text-gray-500 hover:text-dojo-teal hover:bg-white/50"
                  )}
                >
                  {item.label}
                </Link>
              ))}
            </div>

            <div className="h-6 w-px bg-gray-200 mx-2" />

            {activeAccount ? (
              <WalletButton />
            ) : (
              <button
                onClick={() => setIsWalletModalOpen(true)}
                className="dojo-button flex items-center gap-2"
              >
                <Wallet size={18} />
                Connect Wallet
              </button>
            )}
          </div>

          <button className="md:hidden p-2 text-gray-500 hover:bg-gray-100 rounded-lg transition-colors">
            <Menu size={24} />
          </button>
        </div>
      </div>

      <WalletModal 
        open={isWalletModalOpen} 
        onOpenChange={setIsWalletModalOpen} 
      />
    </nav>
  );
}
