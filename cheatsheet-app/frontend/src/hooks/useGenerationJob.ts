import { useCallback, useEffect, useRef, useState } from 'react'
import type { CheatsheetProject } from '../types/block'
import {
  getIngestJob,
  startIngestFilesJob,
  startIngestTextJob,
  type JobProgress,
  type JobStage,
  type JobStatus,
} from '../services/api'

const POLL_INTERVAL_MS = 1000

export interface StartArgs {
  files?: File[]
  text?: string
  userFocus: string
  language: string
}

export interface GenerationJobState {
  status: JobStatus | 'idle'
  stage: JobStage | null
  topicsTotal: number | null
  topicsDone: number | null
  project: CheatsheetProject | null
  error: string | null
  warnings: string[]
}

const INITIAL: GenerationJobState = {
  status: 'idle',
  stage: null,
  topicsTotal: null,
  topicsDone: null,
  project: null,
  error: null,
  warnings: [],
}

function toState(progress: JobProgress): GenerationJobState {
  return {
    status: progress.status,
    stage: progress.stage,
    topicsTotal: progress.topics_total,
    topicsDone: progress.topics_done,
    project: progress.result,
    error: progress.error,
    warnings: progress.warnings,
  }
}

export function useGenerationJob() {
  const [state, setState] = useState<GenerationJobState>(INITIAL)
  const timerRef = useRef<number | null>(null)
  const abortRef = useRef<AbortController | null>(null)
  const mountedRef = useRef(true)

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
      if (timerRef.current !== null) {
        window.clearTimeout(timerRef.current)
        timerRef.current = null
      }
      abortRef.current?.abort()
    }
  }, [])

  const stopPolling = useCallback(() => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current)
      timerRef.current = null
    }
    abortRef.current?.abort()
    abortRef.current = null
  }, [])

  const poll = useCallback((jobId: string) => {
    const tick = async () => {
      if (!mountedRef.current) return
      const ctrl = new AbortController()
      abortRef.current = ctrl
      try {
        const progress = await getIngestJob(jobId, ctrl.signal)
        if (!mountedRef.current) return
        setState(toState(progress))
        if (progress.status === 'completed' || progress.status === 'failed') {
          stopPolling()
          return
        }
      } catch (err) {
        if (!mountedRef.current) return
        if ((err as { name?: string })?.name === 'AbortError') return
        setState((prev) => ({
          ...prev,
          status: 'failed',
          error: err instanceof Error ? err.message : String(err),
        }))
        stopPolling()
        return
      }
      timerRef.current = window.setTimeout(tick, POLL_INTERVAL_MS)
    }
    tick()
  }, [stopPolling])

  const start = useCallback(
    async (args: StartArgs) => {
      stopPolling()
      setState({ ...INITIAL, status: 'pending' })
      try {
        const jobId = args.files
          ? await startIngestFilesJob(args.files, args.userFocus, args.language)
          : await startIngestTextJob(args.text ?? '', args.userFocus, args.language)
        if (!mountedRef.current) return
        poll(jobId)
      } catch (err) {
        if (!mountedRef.current) return
        setState({
          ...INITIAL,
          status: 'failed',
          error: err instanceof Error ? err.message : String(err),
        })
      }
    },
    [poll, stopPolling],
  )

  const reset = useCallback(() => {
    stopPolling()
    setState(INITIAL)
  }, [stopPolling])

  return { ...state, start, reset }
}
