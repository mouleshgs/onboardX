import { useQuery } from '@tanstack/react-query'
import { apiClient } from '@/api/client'
import { Contract, DashboardStats } from '@/types'

export const useDashboardStats = () => {
  return useQuery<DashboardStats>({
    queryKey: ['dashboard-stats'],
    queryFn: async () => {
      const contracts: Contract[] = await apiClient.getContracts()
      
      const total = contracts.length
      const signed = contracts.filter(c => c.status === 'signed').length
      const onboarded = contracts.filter(c => c.access?.progress === 100).length

      // Group by vendor
      const byVendor: Record<string, { total: number; signed: number; onboarded: number }> = {}
      
      contracts.forEach(contract => {
        const vendor = contract.vendorEmail || contract.vendorId || 'unknown'
        if (!byVendor[vendor]) {
          byVendor[vendor] = { total: 0, signed: 0, onboarded: 0 }
        }
        
        byVendor[vendor].total++
        if (contract.status === 'signed') byVendor[vendor].signed++
        if (contract.access?.progress === 100) byVendor[vendor].onboarded++
      })

      // Recent completions (most recent signed with 100% progress)
      const recent = contracts
        .filter(c => c.access?.progress === 100)
        .sort((a, b) => new Date(b.access!.generatedAt).getTime() - new Date(a.access!.generatedAt).getTime())
        .slice(0, 8)

      return {
        total,
        signed,
        onboarded,
        byVendor,
        recent,
      }
    },
    staleTime: 60000, // 1 minute
  })
}