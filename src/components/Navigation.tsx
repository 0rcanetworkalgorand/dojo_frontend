"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { WalletButton } from "./WalletButton";
import { WalletModal } from "./WalletModal";
import { cn } from "@/lib/utils/index";
import { Wallet, Menu, X } from "lucide-react";
import { useWallet } from "@txnlab/use-wallet-react";
import { useState, useEffect } from "react";
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
  const [mounted, setMounted] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const connectedWallet = wallets.find((w) => w.isConnected);

  return (
    <nav className="glass sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link href="/dashboard" className="flex items-center gap-3 group shrink-0">
            <div className="w-9 h-9 rounded-lg bg-accent flex items-center justify-center text-white font-bold text-lg group-hover:scale-[1.02] transition-transform duration-200">
              0
            </div>
            <div className="hidden sm:flex flex-col">
              <span className="font-heading font-bold text-foreground text-sm uppercase tracking-tight leading-none">
                0RCA
              </span>
              <span className="text-[10px] text-muted-light font-medium uppercase tracking-wider leading-none mt-0.5">
                On-Chain Agent Swarm
              </span>
            </div>
          </Link>

          {/* Desktop Nav */}
          <div className="hidden md:flex items-center gap-1">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "px-3 py-2 rounded-md text-sm font-medium transition-colors",
                  pathname === item.href
                    ? "text-foreground bg-black/[0.04]"
                    : "text-muted hover:text-foreground hover:bg-black/[0.02]"
                )}
              >
                {item.label}
              </Link>
            ))}
          </div>

          {/* Right Side */}
          <div className="flex items-center gap-3">
            <div className="h-6 w-px bg-black/[0.06] hidden md:block" />

            {mounted && activeAccount ? (
              <WalletButton />
            ) : (
              <button
                onClick={() => setIsWalletModalOpen(true)}
                className="btn-primary text-sm py-2 px-5 rounded-md"
              >
                <Wallet size={15} className="shrink-0" />
                <span className="hidden sm:inline">Connect Wallet</span>
              </button>
            )}

            {/* Mobile Menu Toggle */}
            <button
              onClick={() => setMobileOpen(!mobileOpen)}
              className="md:hidden p-2 text-muted hover:text-foreground hover:bg-black/[0.04] rounded-md transition-colors"
            >
              {mobileOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Menu */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ opacity: 0, y: -10, height: 0 }}
            animate={{ opacity: 1, y: 0, height: "auto" }}
            exit={{ opacity: 0, y: -10, height: 0 }}
            transition={{ duration: 0.2 }}
            className="md:hidden glass border-t border-black/[0.06] overflow-hidden"
          >
            <div className="max-w-7xl mx-auto px-4 py-3 space-y-1">
              {navItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMobileOpen(false)}
                  className={cn(
                    "block px-3 py-2.5 rounded-md text-sm font-medium transition-colors",
                    pathname === item.href
                      ? "text-foreground bg-black/[0.04]"
                      : "text-muted hover:text-foreground hover:bg-black/[0.02]"
                  )}
                >
                  {item.label}
                </Link>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <WalletModal
        open={isWalletModalOpen}
        onOpenChange={setIsWalletModalOpen}
      />
    </nav>
  );
}
