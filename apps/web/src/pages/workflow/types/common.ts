

export enum WorkflowRunningStatus {
  Waiting = 'waiting',
  Running = 'running',
  Succeeded = 'succeeded',
  Failed = 'failed',
  Stopped = 'stopped',
  Paused = 'paused',
}


export enum NodeRunningStatus {
  NotStart = 'not-start',
  Waiting = 'waiting',
  Listening = 'listening',
  Running = 'running',
  Succeeded = 'succeeded',
  Failed = 'failed',
  Exception = 'exception',
  Retry = 'retry',
  Stopped = 'stopped',
  Paused = 'paused',
}

