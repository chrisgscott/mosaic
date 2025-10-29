import * as React from "react"
import { Sparkles } from "lucide-react"

import Link from "next/link"
import { createClient } from "@/lib/supabase/server"
import { NavMain } from "@/components/nav-main"
import { NavAdmin } from "@/components/nav-admin"
import { NavSecondary } from "@/components/nav-secondary"
import { NavUser } from "@/components/nav-user"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"

const data = {
  navMain: [
    {
      title: "Dashboard",
      url: "/",
      icon: "LayoutDashboard",
      isActive: true,
    },
  ],
  navSecondary: [],
  admin: [
    {
      title: "Documents",
      url: "/admin/documents",
      icon: "FileText",
    },
    {
      title: "Search",
      url: "/admin/search",
      icon: "Search",
    },
    {
      title: "Chat",
      url: "/admin/chat",
      icon: "MessageSquare",
    },
    {
      title: "Knowledge Graph",
      url: "/admin/graph",
      icon: "Network",
      items: [
        {
          title: "View Graph",
          url: "/admin/graph",
        },
        {
          title: "Visualize",
          url: "/admin/graph/visualize",
        },
        {
          title: "Clean Up Duplicates",
          url: "/admin/graph/cleanup",
        },
      ],
    },
    {
      title: "Settings",
      url: "#",
      icon: "Settings2",
      items: [
        {
          title: "General",
          url: "/admin/settings/general",
        },
        {
          title: "Prompts",
          url: "/admin/settings/prompts",
        },
      ],
    },
  ],
}

export async function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const supabase = await createClient()
  const { data: userData } = await supabase.auth.getUser()
  
  // Get profile from profiles table
  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, email, avatar_url, is_admin")
    .eq("id", userData.user?.id)
    .single()
  
  const user = {
    name: profile?.full_name || profile?.email?.split("@")[0] || "User",
    email: profile?.email || userData.user?.email || "user@example.com",
    avatar: profile?.avatar_url || "",
  }
  
  const isAdmin = profile?.is_admin === true

  return (
    <Sidebar variant="inset" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" asChild>
              <Link href="/">
                <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
                  <Sparkles className="size-4" />
                </div>
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-semibold">Mosaic</span>
                  <span className="truncate text-xs">RAG Platform</span>
                </div>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <NavMain items={data.navMain} />
        <NavSecondary items={data.navSecondary} className="mt-auto" />
        {isAdmin && <NavAdmin items={data.admin} />}
      </SidebarContent>
      <SidebarFooter>
        <NavUser user={user} />
      </SidebarFooter>
    </Sidebar>
  )
}
