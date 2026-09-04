import { Link } from '@tanstack/react-router'
import { FilmIcon, Loader2Icon, KeyRoundIcon } from 'lucide-react'
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
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { useAuthStore } from '@/stores/auth-store'

import {
  getUserTokens,
  fetchTokenKey,
  getInheritedTokenAutoGroups,
} from '../api'
import { STORAGE_KEYS_VIDEO } from '../constants'
import {
  getCompatibleTokens,
  selectCompatibleTokenId,
} from '../lib/api-key-selection'
import {
  loadStoredTokenId,
  loadVideoDraft,
  saveStoredTokenId,
  saveVideoDraft,
} from '../lib/storage/ui-draft'
import {
  buildVideoRequest,
  getDefaultAgnesVideoFormState,
  getDefaultGenericFormState,
  getDefaultHappyHorseFormState,
  getDefaultMiniMaxH3FormState,
  getDefaultSeedanceFormState,
  getDefaultWan30FormState,
  isAgnesVideoCapabilities,
  isGenericCapabilities,
  isHappyHorseCapabilities,
  isMiniMaxH3Capabilities,
  isSeedanceCapabilities,
  isWan30VideoCapabilities,
  type AgnesVideoFormState,
  type GenericFormState,
  type HappyHorseFormState,
  type MiniMaxH3FormState,
  type SeedanceFormState,
  type Wan30FormState,
} from '../lib/video/build-video-request'
import type {
  VideoGenerationRequest,
  TokenOption,
  PlaygroundVideoModel,
  VideoRequestProfile,
} from '../types'
import { AgnesVideoFields } from './agnes-video-fields'
import { GenericVideoFields } from './generic-video-fields'
import { HappyHorseVideoFields } from './happyhorse-video-fields'
import { MiniMaxH3VideoFields } from './minimax-h3-video-fields'
import { SeedanceVideoFields } from './seedance-video-fields'
import { Wan30VideoFields } from './wan30-video-fields'

const PROFILE_LABELS: Record<VideoRequestProfile, string> = {
  happyhorse: 'HappyHorse',
  seedance: 'Seedance',
  minimax_h3: 'MiniMax H3',
  agnes_video: 'Agnes Video',
  wan30_video: 'Wan Video',
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
  const userGroup = useAuthStore((state) => state.auth.user?.group ?? '')
  const videoModels = props.videoModels
  const prompt = props.prompt
  const isSubmitting = props.isSubmitting ?? false
  const initialDraft = useMemo(() => loadVideoDraft(), [])

  const [selectedModelName, setSelectedModelName] = useState(
    () => initialDraft?.model || videoModels[0]?.model || ''
  )
  const [happyHorseState, setHappyHorseState] =
    useState<HappyHorseFormState | null>(() => initialDraft?.happyHorse ?? null)
  const [seedanceState, setSeedanceState] = useState<SeedanceFormState | null>(
    () => initialDraft?.seedance ?? null
  )
  const [miniMaxH3State, setMiniMaxH3State] =
    useState<MiniMaxH3FormState | null>(() => initialDraft?.miniMaxH3 ?? null)
  const [agnesVideoState, setAgnesVideoState] =
    useState<AgnesVideoFormState | null>(() => initialDraft?.agnesVideo ?? null)
  const [wan30State, setWan30State] = useState<Wan30FormState | null>(
    () => initialDraft?.wan30 ?? null
  )
  const [genericState, setGenericState] = useState<GenericFormState | null>(
    () => initialDraft?.generic ?? null
  )

  const [tokens, setTokens] = useState<TokenOption[]>([])
  const [inheritedAutoGroups, setInheritedAutoGroups] = useState<string[]>([])
  const [selectedTokenId, setSelectedTokenId] = useState<string>(
    () =>
      initialDraft?.tokenId ||
      loadStoredTokenId(STORAGE_KEYS_VIDEO.TOKEN_ID) ||
      ''
  )
  const [isLoadingTokens, setIsLoadingTokens] = useState(true)

  const selectedModel = useMemo(
    () =>
      videoModels.find((m) => m.model === selectedModelName) ?? videoModels[0],
    [videoModels, selectedModelName]
  )

  const selectedTokenName = useMemo(() => {
    if (!selectedTokenId) return ''
    return tokens.find((tk) => String(tk.id) === selectedTokenId)?.name ?? ''
  }, [tokens, selectedTokenId])

  const compatibleTokens = useMemo(
    () =>
      getCompatibleTokens(
        tokens,
        selectedModel?.groups ?? [],
        userGroup,
        inheritedAutoGroups
      ),
    [tokens, selectedModel, userGroup, inheritedAutoGroups]
  )

  useEffect(() => {
    setIsLoadingTokens(true)
    Promise.all([
      getUserTokens(),
      getInheritedTokenAutoGroups().catch(() => []),
    ])
      .then(([list, autoGroups]) => {
        setTokens(list)
        setInheritedAutoGroups(autoGroups)
        if (list.length === 0) {
          setSelectedTokenId('')
        }
      })
      .finally(() => setIsLoadingTokens(false))
      .catch(() => setTokens([]))
  }, [])

  useEffect(() => {
    if (isLoadingTokens || !selectedModel) return
    const saved = loadStoredTokenId(STORAGE_KEYS_VIDEO.TOKEN_ID)
    setSelectedTokenId((current) =>
      selectCompatibleTokenId(compatibleTokens, current, saved)
    )
  }, [compatibleTokens, isLoadingTokens, selectedModel])

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
      setHappyHorseState((current) =>
        current?.model === selectedModel.model
          ? current
          : getDefaultHappyHorseFormState(selectedModel)
      )
      setSeedanceState(null)
      setMiniMaxH3State(null)
      setAgnesVideoState(null)
      setWan30State(null)
      setGenericState(null)
      return
    }
    if (selectedModel.profile === 'seedance') {
      setSeedanceState((current) =>
        current?.model === selectedModel.model
          ? current
          : getDefaultSeedanceFormState(selectedModel)
      )
      setHappyHorseState(null)
      setMiniMaxH3State(null)
      setAgnesVideoState(null)
      setWan30State(null)
      setGenericState(null)
      return
    }
    if (selectedModel.profile === 'minimax_h3') {
      setMiniMaxH3State((current) =>
        current?.model === selectedModel.model
          ? current
          : getDefaultMiniMaxH3FormState(selectedModel)
      )
      setHappyHorseState(null)
      setSeedanceState(null)
      setAgnesVideoState(null)
      setWan30State(null)
      setGenericState(null)
      return
    }
    if (selectedModel.profile === 'agnes_video') {
      setAgnesVideoState((current) =>
        current?.model === selectedModel.model
          ? current
          : getDefaultAgnesVideoFormState(selectedModel)
      )
      setHappyHorseState(null)
      setSeedanceState(null)
      setMiniMaxH3State(null)
      setWan30State(null)
      setGenericState(null)
      return
    }
    if (selectedModel.profile === 'wan30_video') {
      setWan30State((current) =>
        current?.model === selectedModel.model
          ? current
          : getDefaultWan30FormState(selectedModel)
      )
      setHappyHorseState(null)
      setSeedanceState(null)
      setMiniMaxH3State(null)
      setAgnesVideoState(null)
      setGenericState(null)
      return
    }
    setGenericState((current) =>
      current?.model === selectedModel.model
        ? current
        : getDefaultGenericFormState(selectedModel)
    )
    setHappyHorseState(null)
    setSeedanceState(null)
    setMiniMaxH3State(null)
    setAgnesVideoState(null)
    setWan30State(null)
  }, [selectedModel])

  useEffect(() => {
    saveStoredTokenId(STORAGE_KEYS_VIDEO.TOKEN_ID, selectedTokenId)
  }, [selectedTokenId])

  useEffect(() => {
    saveVideoDraft({
      prompt,
      model: selectedModelName,
      tokenId: selectedTokenId,
      happyHorse: happyHorseState,
      seedance: seedanceState,
      miniMaxH3: miniMaxH3State,
      agnesVideo: agnesVideoState,
      wan30: wan30State,
      generic: genericState,
    })
  }, [
    prompt,
    selectedModelName,
    selectedTokenId,
    happyHorseState,
    seedanceState,
    miniMaxH3State,
    agnesVideoState,
    wan30State,
    genericState,
  ])

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
  } else if (selectedModel?.profile === 'minimax_h3') {
    hasProfileState = miniMaxH3State != null
  } else if (selectedModel?.profile === 'agnes_video') {
    hasProfileState = agnesVideoState != null
  } else if (selectedModel?.profile === 'wan30_video') {
    hasProfileState = wan30State != null
  } else if (selectedModel) {
    hasProfileState = genericState != null
  }

  let hasVideoInput = !!prompt.trim()
  if (selectedModel?.profile === 'wan30_video' && wan30State) {
    if (wan30State.mode === 'first_frame') {
      hasVideoInput = !!wan30State.firstFrameUrl?.trim()
    } else if (wan30State.mode === 'first_last_frame') {
      hasVideoInput =
        !!wan30State.firstFrameUrl?.trim() && !!wan30State.lastFrameUrl?.trim()
    } else if (wan30State.mode === 'reference') {
      hasVideoInput =
        hasVideoInput || wan30State.references.some((item) => !!item.url.trim())
    } else if (wan30State.mode === 'file') {
      hasVideoInput = !!wan30State.fileUrl?.trim()
    } else if (wan30State.mode === 'link') {
      hasVideoInput = !!wan30State.linkUrl?.trim()
    }
  }

  const canSubmit =
    !isSubmitting &&
    hasVideoInput &&
    !!selectedTokenId &&
    compatibleTokens.some((token) => String(token.id) === selectedTokenId) &&
    !!selectedModel &&
    hasProfileState

  const handleSubmit = async () => {
    if (isSubmitting || !selectedModel) return
    if (!hasVideoInput) return
    if (!selectedTokenId) return

    const selectedToken = compatibleTokens.find(
      (token) => String(token.id) === selectedTokenId
    )
    if (!selectedToken) return

    const realKey = await fetchTokenKey(selectedToken.id)
    if (!realKey) return

    const profile = selectedModel.profile
    let formState:
      | HappyHorseFormState
      | SeedanceFormState
      | MiniMaxH3FormState
      | AgnesVideoFormState
      | Wan30FormState
      | GenericFormState
    if (profile === 'happyhorse') {
      formState = { ...(happyHorseState as HappyHorseFormState), prompt }
    } else if (profile === 'seedance') {
      formState = { ...(seedanceState as SeedanceFormState), prompt }
    } else if (profile === 'minimax_h3') {
      formState = { ...(miniMaxH3State as MiniMaxH3FormState), prompt }
    } else if (profile === 'agnes_video') {
      formState = { ...(agnesVideoState as AgnesVideoFormState), prompt }
    } else if (profile === 'wan30_video') {
      formState = { ...(wan30State as Wan30FormState), prompt }
    } else {
      formState = { ...(genericState as GenericFormState), prompt }
    }

    const req = buildVideoRequest(profile, formState)

    let sizeMeta: string | undefined
    if ('size' in formState && formState.size) {
      sizeMeta = formState.size
    } else if (profile === 'minimax_h3' && 'resolution' in formState) {
      sizeMeta = formState.resolution
    }

    const meta = {
      duration: formState.duration,
      profile,
      ...(sizeMeta ? { size: sizeMeta } : {}),
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
          disabled={isLoadingTokens || compatibleTokens.length === 0}
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
            {compatibleTokens.map((token) => (
              <SelectItem key={token.id} value={String(token.id)}>
                {token.name} ({token.group || userGroup})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {compatibleTokens.length === 0 && !isLoadingTokens && selectedModel && (
          <div className='border-warning/40 bg-warning/5 flex items-center justify-between gap-3 rounded-md border p-2'>
            <p className='text-muted-foreground text-xs'>
              {t(
                'No API key can access this model. Create a key for one of these groups: {{groups}}.',
                { groups: selectedModel.groups.join(', ') }
              )}
            </p>
            <Button
              size='sm'
              variant='outline'
              className='shrink-0'
              render={<Link to='/keys' />}
            >
              {t('Create API Key')}
            </Button>
          </div>
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
            {t(PROFILE_LABELS[selectedModel.profile])}
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

      {selectedModel?.profile === 'minimax_h3' &&
        miniMaxH3State &&
        isMiniMaxH3Capabilities(selectedModel.capabilities) && (
          <MiniMaxH3VideoFields
            capabilities={selectedModel.capabilities}
            state={miniMaxH3State}
            onChange={(patch) =>
              setMiniMaxH3State((current) =>
                current ? { ...current, ...patch } : current
              )
            }
          />
        )}

      {selectedModel?.profile === 'agnes_video' &&
        agnesVideoState &&
        isAgnesVideoCapabilities(selectedModel.capabilities) && (
          <AgnesVideoFields
            capabilities={selectedModel.capabilities}
            state={agnesVideoState}
            onChange={(patch) =>
              setAgnesVideoState((current) =>
                current ? { ...current, ...patch } : current
              )
            }
          />
        )}

      {selectedModel?.profile === 'wan30_video' &&
        wan30State &&
        isWan30VideoCapabilities(selectedModel.capabilities) && (
          <Wan30VideoFields
            capabilities={selectedModel.capabilities}
            state={wan30State}
            onChange={(patch) =>
              setWan30State((current) =>
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
