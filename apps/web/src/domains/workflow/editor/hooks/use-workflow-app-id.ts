import { useSearchParams } from 'react-router-dom'

export const useWorkflowAppId = (): string | null => {
  const [searchParams] = useSearchParams()
  return searchParams.get('appId')
}
