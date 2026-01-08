export type StartVariableType =
  | 'text-input'
  | 'paragraph'
  | 'select'
  | 'number'
  | 'url'
  | 'json'
  | 'json_object'
  | 'file'
  | 'file-list'
  | 'checkbox'

export type StartVariable = {
  id: string
  variable: string
  label: string
  type: StartVariableType
  required: boolean
  options: string[]
  placeholder: string
  hint: string
}

export type StartNodeConfig = {
  variables: StartVariable[]
}

export type StartValidationIssue = {
  path: string
  message: string
}