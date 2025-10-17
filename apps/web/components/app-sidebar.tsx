import * as React from "react"
import { Sparkles } from "lucide-react"

import Link from "next/link"
import { createClient } from "@/lib/supabase/server"
import { NavMain } from "@/components/nav-main"
import { NavProjects } from "@/components/nav-projects"
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
    {
      title: "Documents",
      url: "/documents",
      icon: "FileText",
    },
    {
      title: "Knowledge Base",
      url: "#",
      icon: "Database",
      items: [
        {
          title: "Search",
          url: "#",
        },
        {
          title: "Collections",
          url: "#",
        },
        {
          title: "Analytics",
          url: "#",
        },
      ],
    },
    {
      title: "Knowledge Graph",
      url: "/graph",
      icon: "Network",
      items: [
        {
          title: "View Graph",
          url: "/graph",
        },
        {
          title: "Clean Up Duplicates",
          url: "/graph/cleanup",
        },
      ],
    },
    {
      title: "Settings",
      url: "/settings/general",
      icon: "Settings2",
      items: [
        {
          title: "General",
          url: "/settings/general",
        },
        {
          title: "Embeddings",
          url: "#",
        },
        {
          title: "Chunking",
          url: "#",
        },
        {
          title: "API Keys",
          url: "#",
        },
      ],
    },
  ],
  navSecondary: [
    {
      title: "Search",
      url: "#",
      icon: "Search",
    },
    {
      title: "AI Assistant",
      url: "#",
      icon: "Sparkles",
    },
  ],
  projects: [
    {
      name: "Quick Upload",
      url: "/documents",
      icon: "Upload",
    },
  ],
}

export async function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const supabase = await createClient()
  const { data: userData } = await supabase.auth.getUser()
  
  // Get profile from profiles table
  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, email, avatar_url")
    .eq("id", userData.user?.id)
    .single()
  
  const user = {
    name: profile?.full_name || profile?.email?.split("@")[0] || "User",
    email: profile?.email || userData.user?.email || "user@example.com",
    avatar: profile?.avatar_url || "",
  }

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
        <NavProjects projects={data.projects} />
        <NavSecondary items={data.navSecondary} className="mt-auto" />
      </SidebarContent>
      <SidebarFooter>
        <NavUser user={user} />
      </SidebarFooter>
    </Sidebar>
  )
}
