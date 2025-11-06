"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { Plus, MessageSquare } from "lucide-react"
import { useEffect, useState } from "react"

import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"
import { Button } from "@/components/ui/button"

type ChatSession = {
  id: string
  title: string
  created_at: string
  updated_at: string
}

export function NavChats() {
  const pathname = usePathname()
  const [sessions, setSessions] = useState<ChatSession[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchSessions()
  }, [pathname]) // Refresh when navigating between chats

  async function fetchSessions() {
    try {
      const response = await fetch('/api/chat/sessions')
      if (response.ok) {
        const data = await response.json()
        setSessions(data.sessions || [])
      }
    } catch (error) {
      console.error('[NavChats] Failed to fetch sessions:', error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <SidebarGroup>
      <SidebarGroupLabel>Chats</SidebarGroupLabel>
      <SidebarMenu>
        {/* New Chat Button */}
        <div className="px-2 pb-2">
          <Button asChild variant="secondary" className="w-full justify-start" size="sm">
            <Link href="/admin/chat">
              <Plus className="h-4 w-4 mr-2" />
              New Chat
            </Link>
          </Button>
        </div>

        {/* Loading State */}
        {loading && (
          <SidebarMenuItem>
            <SidebarMenuButton disabled>
              <MessageSquare className="h-4 w-4 opacity-50" />
              <span className="text-muted-foreground">Loading...</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        )}

        {/* Chat Sessions List */}
        {!loading && sessions.length === 0 && (
          <SidebarMenuItem>
            <SidebarMenuButton disabled>
              <MessageSquare className="h-4 w-4 opacity-50" />
              <span className="text-muted-foreground text-xs">No chats yet</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        )}

        {!loading && sessions.map((session) => {
          const isActive = pathname === `/admin/chat/${session.id}`
          return (
            <SidebarMenuItem key={session.id}>
              <SidebarMenuButton 
                asChild 
                tooltip={session.title}
                isActive={isActive}
              >
                <Link href={`/admin/chat/${session.id}`}>
                  <MessageSquare className="h-4 w-4" />
                  <span className="truncate">{session.title}</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          )
        })}
      </SidebarMenu>
    </SidebarGroup>
  )
}
