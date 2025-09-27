import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiClient } from '@/api/client'
import { Contract, SignatureData } from '@/types'
import toast from 'react-hot-toast'

export const useContracts = () => {
  return useQuery<Contract[]>({
    queryKey: ['contracts'],
    queryFn: () => apiClient.getContracts(),
    staleTime: 30000, // 30 seconds
  })
}

export const useVendorContracts = (vendorEmail: string) => {
  return useQuery<Contract[]>({
    queryKey: ['vendor-contracts', vendorEmail],
    queryFn: () => apiClient.getVendorContracts(vendorEmail),
    enabled: !!vendorEmail,
    staleTime: 30000,
  })
}

export const useContract = (id: string) => {
  return useQuery<Contract>({
    queryKey: ['contract', id],
    queryFn: () => apiClient.getContract(id),
    enabled: !!id,
  })
}

export const useContractAccess = (id: string) => {
  return useQuery({
    queryKey: ['contract-access', id],
    queryFn: () => apiClient.getContractAccess(id),
    enabled: !!id,
    retry: false, // Don't retry if contract not signed yet
  })
}

export const useSignContract = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (data: SignatureData) => apiClient.signContract(data),
    onSuccess: (_, variables) => {
      toast.success('Contract signed successfully!')
      queryClient.invalidateQueries({ queryKey: ['contracts'] })
      queryClient.invalidateQueries({ queryKey: ['contract', variables.contractId] })
      queryClient.invalidateQueries({ queryKey: ['contract-access', variables.contractId] })
    },
    onError: (error: any) => {
      toast.error(error.error || 'Failed to sign contract')
    },
  })
}

export const useRecordEvent = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ contractId, event }: { contractId: string; event: string }) =>
      apiClient.recordEvent(contractId, event),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['contract-access', variables.contractId] })
    },
  })
}