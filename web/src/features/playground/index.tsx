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
import { PlaygroundChat } from './components/chat/playground-chat'
import { PlaygroundInput } from './components/input/playground-input'
import { ImageInputForm } from './components/image-input-form'
import {
  ImageHistoryList,
  ImageResultPreview,
} from './components/image-history-list'
import { VideoInputForm } from './components/video-input-form'
import { VideoPlayer } from './components/video-player'
import { VideoTaskQueue } from './components/video-task-queue'
import {
  useChatHandler,
  useImageGeneration,
  usePlaygroundConversation,
  usePlaygroundImageModels,
  usePlaygroundOptions,
  usePlaygroundState,
  usePlaygroundVideoModels,
  useVideoTask,
} from './hooks'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Skeleton } from '@/components/ui/skeleton'
import type { VideoTaskItem, VideoRequestProfile } from './types'

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

  const { tasks, isSubmitting, submitError, submitTask, clearFinishedTasks, removeTask } =
    useVideoTask()
  const [previewTask, setPreviewTask] = useState<VideoTaskItem | null>(null)
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
  const [videoPrompt, setVideoPrompt] = useState('')

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
        task.status === 'completed' &&
        task.videoUrl &&
        !seen.has(task.id)
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

  const { videoModels } = usePlaygroundVideoModels()
  const { imageModels } = usePlaygroundImageModels()
  const hasVideoModels = videoModels.length > 0

  const handleVideoSubmit = async (
    req: Parameters<typeof submitTask>[0],
    apiKey: string,
    tokenId: number,
    meta?: { size?: string; duration?: number; profile?: VideoRequestProfile }
  ) => {
    try {
      await submitTask(req, apiKey, tokenId, meta)
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : t('Failed to submit video task')
      )
    }
  }

  const handleImageSubmit = async (
    req: Parameters<typeof generateImage>[0],
    apiKey: string,
    meta?: Parameters<typeof generateImage>[2]
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
        defaultValue='image'
      >
        <div className='flex shrink-0 justify-center border-b px-4 pt-2'>
          <TabsList>
            <TabsTrigger value='chat'>{t('Chat')}</TabsTrigger>
            <TabsTrigger value='image'>{t('Image')}</TabsTrigger>
            {hasVideoModels && (
              <TabsTrigger value='video'>{t('Video')}</TabsTrigger>
            )}
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
    </div>
  )
}
