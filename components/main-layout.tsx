"use client"

import * as React from "react"
import Link from "next/link"
import { AppSidebar } from "@/components/app-sidebar"
import { SidebarProvider, SidebarInset, SidebarTrigger } from "@/components/ui/sidebar"
import { Separator } from "@/components/ui/separator"
import { Logo } from "@/components/logo"
import { UserMenu } from "@/components/user-menu"

export function MainLayout({ children }: { children: React.ReactNode }) {
  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <header className="flex h-16 shrink-0 items-center gap-2 border-b bg-white px-4 md:px-6">
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="mr-2 h-4" />
          <Link href="/" className="flex items-center">
            <img src="/logo.png" alt="Elixir Health" className="h-12 w-auto object-contain" />
          </Link>
          
          {/* Navigation Bar */}
          <nav className="flex items-center gap-1 ml-6">
            <Link
              href="/"
              className="px-4 py-2 text-sm font-medium text-blue-600 border-b-2 border-blue-600"
            >
              Home
            </Link>
            <Link
              href="/lab-reports"
              className="px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              Overview
            </Link>
          </nav>

          <div className="ml-auto">
            <UserMenu />
          </div>
        </header>
        <div className="flex flex-1 flex-col gap-6 p-4 md:p-6 overflow-auto bg-gray-50">
          {children}
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}

