"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { House, TwitterLogo, GithubLogo, Book } from "@phosphor-icons/react";

export function NavBar() {
  const pathname = usePathname();
  
  return ( 
    <nav className="fixed top-0 z-50 w-full bg-transparent">
      <div className="w-full flex h-16 md:h-20 items-center justify-between px-4 sm:px-6 lg:px-8">
        {/* Logo and Brand Name */}
        <div className="flex items-center gap-2 md:gap-3">
          <Link href="/" className="flex items-center gap-2 md:gap-3">
            <Image 
              src="/flashblocks.svg" 
              alt="Flashblocks Logo" 
              width={32} 
              height={32}
              className="size-8 sm:size-10 md:size-12"
            />
            <span className="font-semibold text-lg sm:text-xl md:text-2xl text-white">Flashblocks</span>
          </Link>
        </div>
        
        {/* Navigation Links */}
        <div className="flex items-center space-x-4 md:space-x-6 lg:space-x-8">
          <NavLink href="https://x.com/0xBlazeIt" icon={<TwitterLogo weight="fill" className="size-4 md:size-5" />} active={false}>
            Twitter
          </NavLink>
          <NavLink href="https://github.com/leche64/flashblocks-base" icon={<GithubLogo weight="fill" className="size-4 md:size-5" />} active={false}>
            GitHub
          </NavLink>
          <NavLink href="https://github.com/flashbots/rollup-boost?tab=readme-ov-file#core-system-workflow" icon={<Book weight="fill" className="size-4 md:size-5" />} active={pathname.startsWith("/docs")}>
            Docs
          </NavLink>
        </div>
      </div>
    </nav>
  );
}

// Helper component for navigation links
function NavLink({ href, icon, active, children }) {
  const isExternalLink = href.startsWith('http');
  
  return (
    <Link 
      href={href}
      className={`flex items-center gap-1.5 md:gap-2 text-sm md:text-base font-medium transition-colors hover:text-white/80
        ${active ? "text-white" : "text-white/70"}`}
      target={isExternalLink ? "_blank" : undefined}
      rel={isExternalLink ? "noopener noreferrer" : undefined}
    >
      <span className="flex items-center justify-center">{icon}</span>
      <span className="hidden md:inline">{children}</span>
    </Link>
  );
}
