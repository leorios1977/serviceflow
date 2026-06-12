"use client";

import { useRouter } from "next/navigation";
import { Menu, ChevronsUpDown, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { useOrg } from "@/lib/org-context";
import { signOut } from "@/app/(auth)/actions";
import { MobileSidebarNav } from "./mobile-sidebar-nav";

export function AppTopbar() {
  const { currentOrg, orgs, switchOrg } = useOrg();
  const router = useRouter();

  return (
    <header className="flex h-16 items-center justify-between border-b bg-card px-4 lg:px-6">
      {/* Mobile menu */}
      <Sheet>
        <SheetTrigger asChild>
          <Button variant="ghost" size="icon" className="lg:hidden">
            <Menu className="h-5 w-5" />
            <span className="sr-only">Toggle menu</span>
          </Button>
        </SheetTrigger>
        <SheetContent side="left" className="w-64 p-0">
          <MobileSidebarNav />
        </SheetContent>
      </Sheet>

      {/* Org Switcher */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="outline"
            className="gap-2 max-w-[200px] lg:max-w-[250px]"
          >
            <div className="h-5 w-5 rounded bg-primary/10 flex items-center justify-center">
              <span className="text-[10px] font-bold text-primary">
                {currentOrg?.name?.charAt(0) || "?"}
              </span>
            </div>
            <span className="truncate text-sm">
              {currentOrg?.name || "Select org"}
            </span>
            <ChevronsUpDown className="h-3 w-3 opacity-50" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-[200px]">
          <DropdownMenuLabel>Organizations</DropdownMenuLabel>
          <DropdownMenuSeparator />
          {orgs.map((org) => (
            <DropdownMenuItem
              key={org.id}
              onClick={() => {
                switchOrg(org.id);
                router.refresh();
              }}
            >
              <div className="h-5 w-5 rounded bg-primary/10 flex items-center justify-center mr-2">
                <span className="text-[10px] font-bold text-primary">
                  {org.name.charAt(0)}
                </span>
              </div>
              <span className="truncate">{org.name}</span>
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Right side: sign out */}
      <form action={signOut}>
        <Button variant="ghost" size="icon">
          <LogOut className="h-4 w-4" />
          <span className="sr-only">Sign out</span>
        </Button>
      </form>
    </header>
  );
}
