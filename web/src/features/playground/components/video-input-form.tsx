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
import { useState, useMemo, useEffect } from 'react'
import { FilmIcon, Loader2Icon, KeyRoundIcon } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { getUserTokens, fetchTokenKey } from '../api'
import { GenericVideoFields } from './generic-video-fields'
import { HappyHorseVideoFields } from './happyhorse-video-fields'
import { SeedanceVideoFields } from './seedance-video-fields'
import {
  buildVideoRequest,
  getDefaultGenericFormState,
  getDefaultHappyHorseFormState,
  getDefaultSeedanceFormState,
  isGenericCapabilities,
  isHappyHorseCapabilities,
  isSeedanceCapabilities,
  type GenericFormState,
  type HappyHorseFormState,
  type SeedanceFormState,
} from '../lib/video/build-video-request'
import type {
  VideoGenerationRequest,
  TokenOption,
  PlaygroundVideoModel,
  VideoRequestProfile,
} from '../types'

const PROFILE_LABELS: Record<VideoRequestProfile, string> = {
  happyhorse: 'HappyHorse',
  seedance: 'Seedance',
  generic: 'Video',
}

interface VideoInputFormProps {
  videoModels: PlaygroundVideoModel[]
  prompt: string
  onPromptChange: (prompt: string) => void
  onSubmit: (
    req: VideoGenerationRequest,
    apiKey: string,
    tokenId: number,
    meta?: {
      size?: string
      duration?: number
      profile?: VideoRequestProfile
    }
  ) => Promise<void>
  isSubmitting?: boolean
}

export function VideoInputForm(props: VideoInputFormProps) {
  const { t } = useTranslation()
  const videoModels = props.videoModels
  const prompt = props.prompt
  const isSubmitting = props.isSubmitting ?? false

  const [selectedModelName, setSelectedModelName] = useState(
    videoModels[0]?.model ?? ''
  )
  const [happyHorseState, setHappyHorseState] = useState<HappyHorseFormState | null>(
    null
  )
  const [seedanceState, setSeedanceState] = useState<SeedanceFormState | null>(null)
  const [genericState, setGenericState] = useState<GenericFormState | null>(null)

  const [tokens, setTokens] = useState<TokenOption[]>([])
  const [selectedTokenId, setSelectedTokenId] = useState<string>('')
  const [isLoadingTokens, setIsLoadingTokens] = useState(false)

  const selectedModel = useMemo(
    () => videoModels.find((m) => m.model === selectedModelName) ?? videoModels[0],
    [videoModels, selectedModelName]
  )

  const selectedTokenName = useMemo(() => {
    if (!selectedTokenId) return ''
    return tokens.find((tk) => String(tk.id) === selectedTokenId)?.name ?? ''
  }, [tokens, selectedTokenId])

  useEffect(() => {
    setIsLoadingTokens(true)
    getUserTokens()
      .then((list) => {
        setTokens(list)
        if (list.length > 0) {
          setSelectedTokenId(String(list[0].id))
        }
      })
      .finally(() => setIsLoadingTokens(false))
  }, [])

  useEffect(() => {
    if (videoModels.length === 0) return
    const exists = videoModels.some((m) => m.model === selectedModelName)
    if (!exists) {
      setSelectedModelName(videoModels[0].model)
    }
  }, [videoModels, selectedModelName])

  useEffect(() => {
    if (!selectedModel) return
    if (selectedModel.profile === 'happyhorse') {
      setHappyHorseState(getDefaultHappyHorseFormState(selectedModel))
      setSeedanceState(null)
      setGenericState(null)
      return
    }
    if (selectedModel.profile === 'seedance') {
      setSeedanceState(getDefaultSeedanceFormState(selectedModel))
      setHappyHorseState(null)
      setGenericState(null)
      return
    }
    setGenericState(getDefaultGenericFormState(selectedModel))
    setHappyHorseState(null)
    setSeedanceState(null)
  }, [selectedModel])

  const getKeyPlaceholder = () => {
    if (isLoadingTokens) return t('Loading...')
    if (tokens.length === 0) return t('No API keys available')
    return t('Select API key')
  }

  let hasProfileState = false
  if (selectedModel?.profile === 'happyhorse') {
    hasProfileState = happyHorseState != null
  } else if (selectedModel?.profile === 'seedance') {
    hasProfileState = seedanceState != null
  } else if (selectedModel) {
    hasProfileState = genericState != null
  }

  const canSubmit =
    !isSubmitting &&
    !!prompt.trim() &&
    !!selectedTokenId &&
    !!selectedModel &&
    hasProfileState

  const handleSubmit = async () => {
    if (isSubmitting || !selectedModel) return
    if (!prompt.trim()) return
    if (!selectedTokenId) return

    const selectedToken = tokens.find((tk) => String(tk.id) === selectedTokenId)
    if (!selectedToken) return

    const realKey = await fetchTokenKey(selectedToken.id)
    if (!realKey) return

    const profile = selectedModel.profile
    let formState: HappyHorseFormState | SeedanceFormState | GenericFormState
    if (profile === 'happyhorse') {
      formState = { ...(happyHorseState as HappyHorseFormState), prompt }
    } else if (profile === 'seedance') {
      formState = { ...(seedanceState as SeedanceFormState), prompt }
    } else {
      formState = { ...(genericState as GenericFormState), prompt }
    }

    const req = buildVideoRequest(profile, formState)

    const meta = {
      duration: formState.duration,
      profile,
      ...('size' in formState && formState.size
        ? { size: formState.size }
        : {}),
    }

    await props.onSubmit(req, realKey, selectedToken.id, meta)
  }

  if (videoModels.length === 0) {
    return (
      <div className='text-muted-foreground flex flex-col gap-2 p-4 text-sm'>
        <p>{t('No text-to-video models available')}</p>
        <p className='text-xs'>
          {t(
            'Add enabled catalog models with the t2v tag and ensure your group has access.'
          )}
        </p>
      </div>
    )
  }

  return (
    <div className='flex flex-col gap-4 p-4'>
      <div className='flex flex-col gap-1.5'>
        <Label className='flex items-center gap-1'>
          <KeyRoundIcon className='size-3.5' />
          {t('API Key')}
        </Label>
        <Select
          disabled={isLoadingTokens || tokens.length === 0}
          value={selectedTokenId}
          onValueChange={(v) => {
            if (v != null) setSelectedTokenId(v)
          }}
        >
          <SelectTrigger>
            {selectedTokenName ? (
              <span className='flex flex-1 text-left' data-slot='select-value'>
                {selectedTokenName}
              </span>
            ) : (
              <SelectValue placeholder={getKeyPlaceholder()} />
            )}
          </SelectTrigger>
          <SelectContent>
            {tokens.map((token) => (
              <SelectItem key={token.id} value={String(token.id)}>
                {token.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {tokens.length === 0 && !isLoadingTokens && (
          <p className='text-muted-foreground text-xs'>
            {t('Please create an API key first in the Keys page.')}
          </p>
        )}
      </div>

      <div className='flex flex-col gap-1.5'>
        <Label>{t('Model')}</Label>
        <Select
          value={selectedModelName || undefined}
          onValueChange={(v) => {
            if (v != null) setSelectedModelName(v)
          }}
        >
          <SelectTrigger className='h-auto min-h-8 w-full py-1.5'>
            <SelectValue placeholder={t('Select model')}>
              {selectedModelName || undefined}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {videoModels.map((model) => (
              <SelectItem
                key={model.model}
                value={model.model}
                label={model.model}
              >
                {model.model}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {selectedModel && (
          <p className='text-muted-foreground text-xs'>
            {PROFILE_LABELS[selectedModel.profile]}
          </p>
        )}
      </div>

      <div className='flex flex-col gap-1.5'>
        <Label htmlFor='video-prompt'>{t('Prompt')}</Label>
        <Textarea
          id='video-prompt'
          className='min-h-[100px] resize-none'
          placeholder={t('Describe the video you want to generate...')}
          value={prompt}
          onChange={(e) => props.onPromptChange(e.target.value)}
        />
      </div>

      {selectedModel?.profile === 'happyhorse' &&
        happyHorseState &&
        isHappyHorseCapabilities(selectedModel.capabilities) && (
          <HappyHorseVideoFields
            capabilities={selectedModel.capabilities}
            state={happyHorseState}
            onChange={(patch) =>
              setHappyHorseState((current) =>
                current ? { ...current, ...patch } : current
              )
            }
          />
        )}

      {selectedModel?.profile === 'seedance' &&
        seedanceState &&
        isSeedanceCapabilities(selectedModel.capabilities) && (
          <SeedanceVideoFields
            capabilities={selectedModel.capabilities}
            state={seedanceState}
            onChange={(patch) =>
              setSeedanceState((current) =>
                current ? { ...current, ...patch } : current
              )
            }
          />
        )}

      {selectedModel?.profile === 'generic' &&
        genericState &&
        isGenericCapabilities(selectedModel.capabilities) && (
          <GenericVideoFields
            capabilities={selectedModel.capabilities}
            state={genericState}
            onChange={(patch) =>
              setGenericState((current) =>
                current ? { ...current, ...patch } : current
              )
            }
          />
        )}

      <Button
        className='w-full'
        disabled={!canSubmit}
        type='button'
        onClick={handleSubmit}
      >
        {isSubmitting ? (
          <>
            <Loader2Icon className='mr-2 size-4 animate-spin' />
            {t('Submitting...')}
          </>
        ) : (
          <>
            <FilmIcon className='mr-2 size-4' />
            {t('Generate Video')}
          </>
        )}
      </Button>
    </div>
  )
}
