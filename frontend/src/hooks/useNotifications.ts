import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiClient } from '@/api/client'
import { Notification } from '@/types'
import toast from 'react-hot-toast'

export const useNotifications = (email: string) => {
  return useQuery<{ notifications: Notification[]; unreadCount: number }>({
    queryKey: ['notifications', email],
    queryFn: () => apiClient.getNotifications(email),
    enabled: !!email,
    refetchInterval: 30000, // Poll every 30 seconds
  })
}

export const useMarkNotificationsRead = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (ids: string[]) => apiClient.markNotificationsRead(ids),
    onSuccess: (_, variables, context) => {
      // Optimistically update the cache
      queryClient.setQueryData(['notifications'], (old: any) => {
        if (!old) return old
        return {
          ...old,
          notifications: old.notifications.map((n: Notification) =>
            variables.includes(n.id) ? { ...n, read: true } : n
          ),
          unreadCount: Math.max(0, old.unreadCount - variables.length),
        }
      })
      queryClient.invalidateQueries({ queryKey: ['notifications'] })
    },
    onError: () => {
      toast.error('Failed to mark notifications as read')
    },
  })
}

export const useSendNudge = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({
      contractId,
      from,
      message,
    }: {
      contractId: string
      from: string
      message?: string
    }) => apiClient.sendNudge(contractId, { from, message }),
    onMutate: () => {
      // Optimistic update - show success immediately
      toast.success('Nudge sent!')
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] })
    },
    onError: (error: any) => {
      toast.error(error.error || 'Failed to send nudge')
    },
  })
}