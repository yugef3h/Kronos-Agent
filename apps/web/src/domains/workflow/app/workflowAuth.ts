import { requestDevToken } from '../../../lib/api'
import { usePlaygroundStore } from '../../../store/playgroundStore'

let authTokenRequest: Promise<string> | null = null

export const ensureWorkflowAuthToken = async (): Promise<string> => {
  const currentToken = usePlaygroundStore.getState().authToken.trim()
  if (currentToken) {
    return currentToken
  }

  if (!authTokenRequest) {
    authTokenRequest = requestDevToken()
      .then((result) => {
        usePlaygroundStore.getState().setAuthToken(result.token)
        return result.token
      })
      .catch(() => '')
      .finally(() => {
        authTokenRequest = null
      })
  }

  return (await authTokenRequest).trim()
}

export const buildWorkflowAuthHeaders = async (
  extra?: Record<string, string>,
): Promise<Record<string, string>> => {
  const token = await ensureWorkflowAuthToken()
  if (!token) {
    throw new Error('无法获取鉴权 token，请刷新页面后重试。')
  }

  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
    ...extra,
  }
}
