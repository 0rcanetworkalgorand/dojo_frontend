"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { WalletButton } from "./WalletButton";
import { WalletModal } from "./WalletModal";
import { cn } from "@/lib/utils/index";
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
    <nav className="bg-dojo-bg/80 backdrop-blur-xl border-b border-white/[0.05] sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-6 sm:px-12">
        <div className="flex items-center justify-between h-24">
          <Link href="/dashboard" className="flex items-center gap-4 group">
            <div className="w-12 h-12 rounded-2xl bg-white flex items-center justify-center text-black font-black text-2xl group-hover:scale-105 transition-transform duration-500">
              0
            </div>
            <div className="flex flex-col">
              <span className="font-heading font-black text-white text-xl uppercase tracking-tighter leading-none">
                0RCA DOJO
              </span>
              <span className="text-[9px] text-dojo-teal font-black uppercase tracking-[0.3em] mt-1 opacity-80">
                Zen Infrastructure
              </span>
            </div>
          </Link>

          <div className="hidden md:flex items-center gap-10">
            <div className="flex items-center gap-2">
              {navItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "px-5 py-2 rounded-full text-xs font-black uppercase tracking-widest transition-all duration-300",
                    pathname === item.href
                      ? "bg-white text-black"
                      : "text-white/50 hover:text-white hover:bg-white/5"
                  )}
                >
                  {item.label}
                </Link>
              ))}
            </div>

            <div className="h-4 w-px bg-white/10 mx-2" />

            {activeAccount ? (
              <WalletButton />
            ) : (
              <button
                onClick={() => setIsWalletModalOpen(true)}
                className="dojo-button flex items-center gap-2"
              >
                <Wallet size={16} />
                Connect Wallet
              </button>
            )}
          </div>

          <button className="md:hidden p-3 text-white/50 hover:text-white hover:bg-white/5 rounded-2xl transition-all">
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
