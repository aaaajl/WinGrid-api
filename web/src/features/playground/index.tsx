/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.

For commercial licensing, please contact support@quantumnous.com
*/
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { ConfirmDialog } from '@/components/confirm-dialog'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

import { PlaygroundChat } from './components/chat/playground-chat'
import {
  ImageHistoryList,
  ImageResultPreview,
} from './components/image-history-list'
import { ImageInputForm } from './components/image-input-form'
import { PlaygroundInput } from './components/input/playground-input'
import {
  SpeechHistoryList,
  SpeechResultPreview,
} from './components/speech-history-list'
import { SpeechInputForm } from './components/speech-input-form'
import { VideoInputForm } from './components/video-input-form'
import { VideoPlayer } from './components/video-player'
import { VideoTaskQueue } from './components/video-task-queue'
import {
  useChatHandler,
  useImageGeneration,
  usePlaygroundConversation,
  usePlaygroundImageModels,
  usePlaygroundOptions,
  usePlaygroundSpeechModels,
  usePlaygroundState,
  usePlaygroundVideoModels,
  useSpeechGeneration,
  useVideoTask,
} from './hooks'
import {
  loadActiveTab,
  loadVideoDraft,
  loadVideoPreviewTaskId,
  saveActiveTab,
  saveVideoDraft,
  saveVideoPreviewTaskId,
  type PlaygroundTab,
} from './lib/storage/ui-draft'
import type {
  ImageGenerationRequest,
  ImageRequestProfile,
  SpeechGenerationRequest,
  SpeechRequestProfile,
  VideoGenerationRequest,
  VideoRequestProfile,
  VideoTaskItem,
} from './types'

type PendingSubmit =
  | {
      kind: 'video'
      req: VideoGenerationRequest
      apiKey: string
      tokenId: number
      meta?: {
        size?: string
        duration?: number
        profile?: VideoRequestProfile
      }
    }
  | {
      kind: 'image'
      req: ImageGenerationRequest
      apiKey: string
      meta?: { profile?: ImageRequestProfile }
    }
  | {
      kind: 'speech'
      req: SpeechGenerationRequest
      apiKey: string
      meta?: { profile?: SpeechRequestProfile }
    }

function resolveInitialTab(): PlaygroundTab {
  return loadActiveTab() ?? 'image'
}

export function Playground() {
  const { t } = useTranslation()
  const {
    config,
    parameterEnabled,
    messages,
    isLoadingMessages,
    models,
    groups,
    updateMessages,
    setModels,
    setGroups,
    updateConfig,
    updateParameterEnabled,
    clearMessages,
  } = usePlaygroundState()

  const { sendChat, stopGeneration, isGenerating } = useChatHandler({
    config,
    parameterEnabled,
    onMessageUpdate: updateMessages,
  })

  const {
    editingMessageKey,
    handleSendMessage,
    handleRegenerateMessage,
    handleEditMessage,
    handleEditOpenChange,
    applyEdit,
    handleDeleteMessage,
  } = usePlaygroundConversation({
    messages,
    updateMessages,
    sendChat,
  })

  const {
    tasks,
    isSubmitting,
    submitError,
    submitTask,
    clearFinishedTasks,
    removeTask,
  } = useVideoTask()
  const [previewTask, setPreviewTask] = useState<VideoTaskItem | null>(() => {
    const previewId = loadVideoPreviewTaskId()
    if (!previewId) return null
    return tasks.find((task) => task.id === previewId) ?? null
  })
  const autoPreviewedRef = useRef<Set<string> | null>(null)

  const {
    history: imageHistory,
    previewItem: imagePreview,
    setPreviewItem: setImagePreview,
    isSubmitting: isImageSubmitting,
    submitError: imageSubmitError,
    generate: generateImage,
    removeHistoryItem,
    clearHistory,
  } = useImageGeneration()
  const [reusePrompt, setReusePrompt] = useState<string | null>(null)
  const [reusePromptNonce, setReusePromptNonce] = useState(0)

  const {
    history: speechHistory,
    previewItem: speechPreview,
    setPreviewItem: setSpeechPreview,
    isSubmitting: isSpeechSubmitting,
    submitError: speechSubmitError,
    generate: generateSpeech,
    removeHistoryItem: removeSpeechHistoryItem,
    clearHistory: clearSpeechHistory,
  } = useSpeechGeneration()
  const [reuseSpeechInput, setReuseSpeechInput] = useState<string | null>(null)
  const [reuseSpeechInputNonce, setReuseSpeechInputNonce] = useState(0)
  const [videoPrompt, setVideoPrompt] = useState(
    () => loadVideoDraft()?.prompt ?? ''
  )

  const { videoModels, isLoadingVideoModels } = usePlaygroundVideoModels()
  const { imageModels } = usePlaygroundImageModels()
  const { speechModels } = usePlaygroundSpeechModels()
  const hasVideoModels = videoModels.length > 0
  const [activeTab, setActiveTab] = useState<PlaygroundTab>(resolveInitialTab)
  const [pendingSubmit, setPendingSubmit] = useState<PendingSubmit | null>(null)

  const hasPendingVideoTasks = tasks.some(
    (task) => task.status === 'queued' || task.status === 'in_progress'
  )

  useEffect(() => {
    if (isLoadingVideoModels) return
    if (activeTab === 'video' && !hasVideoModels) {
      setActiveTab('image')
    }
  }, [activeTab, hasVideoModels, isLoadingVideoModels])

  useEffect(() => {
    saveActiveTab(activeTab)
  }, [activeTab])

  useEffect(() => {
    saveVideoPreviewTaskId(previewTask?.id ?? null)
  }, [previewTask])

  useEffect(() => {
    const draft = loadVideoDraft()
    saveVideoDraft({
      prompt: videoPrompt,
      model: draft?.model ?? '',
      tokenId: draft?.tokenId ?? '',
      happyHorse: draft?.happyHorse ?? null,
      seedance: draft?.seedance ?? null,
      miniMaxH3: draft?.miniMaxH3 ?? null,
      agnesVideo: draft?.agnesVideo ?? null,
      wan30: draft?.wan30 ?? null,
      generic: draft?.generic ?? null,
    })
  }, [videoPrompt])

  useEffect(() => {
    if (autoPreviewedRef.current === null) {
      autoPreviewedRef.current = new Set(
        tasks
          .filter((task) => task.status === 'completed')
          .map((task) => task.id)
      )
      return
    }

    const seen = autoPreviewedRef.current
    const newlyCompleted = tasks.find(
      (task) =>
        task.status === 'completed' && task.videoUrl && !seen.has(task.id)
    )
    if (newlyCompleted) {
      seen.add(newlyCompleted.id)
    }

    setPreviewTask((current) => {
      if (newlyCompleted) return newlyCompleted
      if (!current) return current
      const updated = tasks.find((task) => task.id === current.id)
      if (!updated) return null
      if (
        updated.status === current.status &&
        updated.progress === current.progress &&
        updated.videoUrl === current.videoUrl &&
        updated.error === current.error
      ) {
        return current
      }
      return updated
    })
  }, [tasks])

  const handleClearMessages = () => {
    handleEditOpenChange(false)
    clearMessages()
  }

  const { isLoadingModels } = usePlaygroundOptions({
    currentGroup: config.group,
    currentModel: config.model,
    setGroups,
    setModels,
    updateConfig,
  })

  const runVideoSubmit = async (
    req: VideoGenerationRequest,
    apiKey: string,
    tokenId: number,
    meta?: {
      size?: string
      duration?: number
      profile?: VideoRequestProfile
    }
  ) => {
    try {
      await submitTask(req, apiKey, tokenId, meta)
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : t('Failed to submit video task')
      )
    }
  }

  const runImageSubmit = async (
    req: ImageGenerationRequest,
    apiKey: string,
    meta?: { profile?: ImageRequestProfile }
  ) => {
    try {
      await generateImage(req, apiKey, meta)
      setReusePrompt(null)
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : t('Failed to generate image')
      )
    }
  }

  const runSpeechSubmit = async (
    req: SpeechGenerationRequest,
    apiKey: string,
    meta?: { profile?: SpeechRequestProfile }
  ) => {
    try {
      await generateSpeech(req, apiKey, meta)
      setReuseSpeechInput(null)
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : t('Failed to synthesize speech')
      )
    }
  }

  const handleVideoSubmit = async (
    req: VideoGenerationRequest,
    apiKey: string,
    tokenId: number,
    meta?: {
      size?: string
      duration?: number
      profile?: VideoRequestProfile
    }
  ) => {
    if (hasPendingVideoTasks) {
      setPendingSubmit({ kind: 'video', req, apiKey, tokenId, meta })
      return
    }
    await runVideoSubmit(req, apiKey, tokenId, meta)
  }

  const handleImageSubmit = async (
    req: ImageGenerationRequest,
    apiKey: string,
    meta?: { profile?: ImageRequestProfile }
  ) => {
    if (isImageSubmitting) {
      setPendingSubmit({ kind: 'image', req, apiKey, meta })
      return
    }
    await runImageSubmit(req, apiKey, meta)
  }

  const handleSpeechSubmit = async (
    req: SpeechGenerationRequest,
    apiKey: string,
    meta?: { profile?: SpeechRequestProfile }
  ) => {
    if (isSpeechSubmitting) {
      setPendingSubmit({ kind: 'speech', req, apiKey, meta })
      return
    }
    await runSpeechSubmit(req, apiKey, meta)
  }

  const handleConfirmPendingSubmit = () => {
    const pending = pendingSubmit
    setPendingSubmit(null)
    if (!pending) return
    if (pending.kind === 'video') {
      void runVideoSubmit(
        pending.req,
        pending.apiKey,
        pending.tokenId,
        pending.meta
      )
      return
    }
    if (pending.kind === 'speech') {
      void runSpeechSubmit(pending.req, pending.apiKey, pending.meta)
      return
    }
    void runImageSubmit(pending.req, pending.apiKey, pending.meta)
  }

  let pendingDialogDesc = t(
    'You have unfinished video tasks. Submit another request anyway?'
  )
  if (pendingSubmit?.kind === 'image') {
    pendingDialogDesc = t(
      'An image is still being generated. Submit another request anyway?'
    )
  } else if (pendingSubmit?.kind === 'speech') {
    pendingDialogDesc = t(
      'A speech synthesis is still in progress. Submit another request anyway?'
    )
  }

  const chatPanel = (
    <>
      <div className='flex min-h-0 flex-1 flex-col overflow-hidden'>
        <PlaygroundChat
          messages={messages}
          isLoadingMessages={isLoadingMessages}
          onRegenerateMessage={handleRegenerateMessage}
          onEditMessage={handleEditMessage}
          onDeleteMessage={handleDeleteMessage}
          onSelectPrompt={handleSendMessage}
          isGenerating={isGenerating}
          editingKey={editingMessageKey}
          onCancelEdit={handleEditOpenChange}
          onSaveEdit={(newContent) => applyEdit(newContent, false)}
          onSaveEditAndSubmit={(newContent) => applyEdit(newContent, true)}
        />
      </div>

      <div className='mx-auto w-full max-w-4xl'>
        <PlaygroundInput
          config={config}
          disabled={isGenerating}
          groups={groups}
          groupValue={config.group}
          isGenerating={isGenerating}
          isModelLoading={isLoadingModels}
          modelValue={config.model}
          models={models}
          onGroupChange={(value) => updateConfig('group', value)}
          onConfigChange={updateConfig}
          onClearMessages={handleClearMessages}
          onModelChange={(value) => updateConfig('model', value)}
          onParameterEnabledChange={updateParameterEnabled}
          onStop={stopGeneration}
          onSubmit={handleSendMessage}
          parameterEnabled={parameterEnabled}
          hasMessages={messages.length > 0}
        />
      </div>
    </>
  )

  return (
    <div className='relative flex size-full min-h-0 flex-col overflow-hidden'>
      <Tabs
        className='flex size-full min-h-0 flex-col overflow-hidden'
        value={activeTab}
        onValueChange={(value) => {
          if (
            value === 'chat' ||
            value === 'image' ||
            value === 'video' ||
            value === 'speech'
          ) {
            setActiveTab(value)
          }
        }}
      >
        <div className='flex shrink-0 justify-center border-b px-4 pt-2'>
          <TabsList>
            <TabsTrigger value='chat'>{t('Chat')}</TabsTrigger>
            <TabsTrigger value='image'>{t('Image')}</TabsTrigger>
            {hasVideoModels && (
              <TabsTrigger value='video'>{t('Video')}</TabsTrigger>
            )}
            <TabsTrigger value='speech'>{t('Speech')}</TabsTrigger>
          </TabsList>
        </div>

        <TabsContent
          className='flex min-h-0 flex-1 flex-col overflow-hidden'
          value='chat'
        >
          {chatPanel}
        </TabsContent>

        <TabsContent
          className='flex min-h-0 flex-1 gap-4 overflow-hidden p-4'
          value='image'
        >
          <div className='flex w-80 shrink-0 flex-col overflow-y-auto rounded-xl border'>
            <ImageInputForm
              imageModels={imageModels}
              isSubmitting={isImageSubmitting}
              onReusePrompt={reusePrompt}
              reusePromptNonce={reusePromptNonce}
              onSubmit={handleImageSubmit}
            />
          </div>
          <div className='flex flex-1 flex-col gap-4 overflow-y-auto'>
            {imagePreview && (
              <ImageResultPreview
                item={imagePreview}
                onClose={() => setImagePreview(null)}
              />
            )}
            {isImageSubmitting && !imagePreview && (
              <div className='border-border bg-background rounded-xl border shadow-sm'>
                <div className='flex items-center justify-between border-b px-4 py-2'>
                  <div className='flex flex-1 flex-col gap-1.5'>
                    <Skeleton className='h-3 w-24' />
                    <Skeleton className='h-4 w-48' />
                  </div>
                </div>
                <div className='grid gap-3 p-3 sm:grid-cols-2'>
                  <Skeleton className='aspect-square w-full rounded-lg' />
                </div>
              </div>
            )}
            {imageSubmitError && (
              <div className='border-destructive/50 bg-destructive/10 text-destructive rounded-lg border px-4 py-3 text-sm'>
                {imageSubmitError}
              </div>
            )}
            <ImageHistoryList
              items={imageHistory}
              onClear={clearHistory}
              onPreview={setImagePreview}
              onRemove={removeHistoryItem}
              onReusePrompt={(prompt) => {
                setReusePrompt(prompt)
                setReusePromptNonce((n) => n + 1)
              }}
            />
          </div>
        </TabsContent>

        <TabsContent
          className='flex min-h-0 flex-1 gap-4 overflow-hidden p-4'
          value='speech'
        >
          <div className='flex w-80 shrink-0 flex-col overflow-y-auto rounded-xl border'>
            <SpeechInputForm
              speechModels={speechModels}
              isSubmitting={isSpeechSubmitting}
              onReuseInput={reuseSpeechInput}
              reuseInputNonce={reuseSpeechInputNonce}
              onSubmit={handleSpeechSubmit}
            />
          </div>
          <div className='flex flex-1 flex-col gap-4 overflow-y-auto'>
            {speechPreview && (
              <SpeechResultPreview
                item={speechPreview}
                onClose={() => setSpeechPreview(null)}
              />
            )}
            {isSpeechSubmitting && !speechPreview && (
              <div className='border-border bg-background flex flex-col gap-3 rounded-xl border p-4 shadow-sm'>
                <Skeleton className='h-3 w-24' />
                <Skeleton className='h-4 w-48' />
                <Skeleton className='h-10 w-full rounded-lg' />
              </div>
            )}
            {speechSubmitError && (
              <div className='border-destructive/50 bg-destructive/10 text-destructive rounded-lg border px-4 py-3 text-sm'>
                {speechSubmitError}
              </div>
            )}
            <SpeechHistoryList
              items={speechHistory}
              onClear={clearSpeechHistory}
              onPreview={setSpeechPreview}
              onRemove={removeSpeechHistoryItem}
              onReuseInput={(input) => {
                setReuseSpeechInput(input)
                setReuseSpeechInputNonce((n) => n + 1)
              }}
            />
          </div>
        </TabsContent>

        {hasVideoModels && (
          <TabsContent
            className='flex min-h-0 flex-1 gap-4 overflow-hidden p-4'
            value='video'
          >
            <div className='flex w-80 shrink-0 flex-col overflow-y-auto rounded-xl border'>
              <VideoInputForm
                videoModels={videoModels}
                prompt={videoPrompt}
                onPromptChange={setVideoPrompt}
                isSubmitting={isSubmitting}
                onSubmit={handleVideoSubmit}
              />
            </div>
            <div className='flex flex-1 flex-col gap-4 overflow-y-auto'>
              {previewTask && (
                <VideoPlayer
                  task={previewTask}
                  onClose={() => setPreviewTask(null)}
                />
              )}
              {!previewTask &&
                tasks.some(
                  (task) =>
                    task.status === 'queued' || task.status === 'in_progress'
                ) && (
                  <div className='border-border bg-background rounded-xl border shadow-sm'>
                    <div className='flex items-center justify-between border-b px-4 py-2'>
                      <div className='flex flex-1 flex-col gap-1.5'>
                        <Skeleton className='h-3 w-24' />
                        <Skeleton className='h-4 w-48' />
                      </div>
                    </div>
                    <div className='p-3'>
                      <Skeleton className='aspect-video w-full rounded-lg' />
                    </div>
                    <div className='border-t px-4 py-2'>
                      <Skeleton className='h-3 w-3/4' />
                    </div>
                  </div>
                )}
              {submitError && (
                <div className='border-destructive/50 bg-destructive/10 text-destructive rounded-lg border px-4 py-3 text-sm'>
                  {submitError}
                </div>
              )}
              <VideoTaskQueue
                tasks={tasks}
                onPreview={setPreviewTask}
                onRemove={(id) => {
                  if (previewTask?.id === id) setPreviewTask(null)
                  removeTask(id)
                }}
                onClearFinished={() => {
                  if (
                    previewTask &&
                    (previewTask.status === 'completed' ||
                      previewTask.status === 'failed')
                  ) {
                    setPreviewTask(null)
                  }
                  clearFinishedTasks()
                }}
              />
            </div>
          </TabsContent>
        )}
      </Tabs>

      <ConfirmDialog
        open={pendingSubmit != null}
        onOpenChange={(open) => {
          if (!open) setPendingSubmit(null)
        }}
        title={t('Generation still in progress')}
        desc={pendingDialogDesc}
        confirmText={t('Submit anyway')}
        handleConfirm={handleConfirmPendingSubmit}
      />
    </div>
  )
}
