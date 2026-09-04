import { Link } from '@tanstack/react-router'
import { ImageIcon, KeyRoundIcon, Loader2Icon } from 'lucide-react'
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
import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
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
  fetchTokenKey,
  getInheritedTokenAutoGroups,
  getUserTokens,
} from '../api'
import { STORAGE_KEYS_IMAGE } from '../constants'
import {
  getCompatibleTokens,
  selectCompatibleTokenId,
} from '../lib/api-key-selection'
import {
  buildImageRequest,
  getDefaultImageFormState,
  type ImageFormState,
} from '../lib/image/build-image-request'
import {
  loadImageDraft,
  loadStoredTokenId,
  saveImageDraft,
  saveStoredTokenId,
} from '../lib/storage/ui-draft'
import type {
  ImageGenerationRequest,
  ImageRequestProfile,
  PlaygroundImageModel,
  TokenOption,
} from '../types'

const PROFILE_LABELS: Record<ImageRequestProfile, string> = {
  dalle2: 'DALL·E 2',
  dalle3: 'DALL·E 3',
  gpt_image: 'GPT Image',
  agnes_image: 'Agnes Image',
  generic: 'Image',
}

interface ImageInputFormProps {
  imageModels: PlaygroundImageModel[]
  onSubmit: (
    req: ImageGenerationRequest,
    apiKey: string,
    meta?: { profile?: ImageRequestProfile }
  ) => Promise<void>
  isSubmitting?: boolean
  onReusePrompt?: string | null
  reusePromptNonce?: number
}

export function ImageInputForm(props: ImageInputFormProps) {
  const { t } = useTranslation()
  const userGroup = useAuthStore((state) => state.auth.user?.group ?? '')
  const initialDraft = useMemo(() => loadImageDraft(), [])

  const [selectedModelName, setSelectedModelName] = useState(
    () => initialDraft?.model || props.imageModels[0]?.model || ''
  )
  const [formState, setFormState] = useState<ImageFormState | null>(
    () => initialDraft?.form ?? null
  )
  const [tokens, setTokens] = useState<TokenOption[]>([])
  const [inheritedAutoGroups, setInheritedAutoGroups] = useState<string[]>([])
  const [selectedTokenId, setSelectedTokenId] = useState(
    () =>
      initialDraft?.tokenId ||
      loadStoredTokenId(STORAGE_KEYS_IMAGE.TOKEN_ID) ||
      ''
  )
  const [isLoadingTokens, setIsLoadingTokens] = useState(true)

  const selectedModel = useMemo(
    () =>
      props.imageModels.find((m) => m.model === selectedModelName) ??
      props.imageModels[0],
    [props.imageModels, selectedModelName]
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
    let cancelled = false
    const loadTokens = async () => {
      setIsLoadingTokens(true)
      try {
        const [list, autoGroups] = await Promise.all([
          getUserTokens(),
          getInheritedTokenAutoGroups().catch(() => []),
        ])
        if (cancelled) return
        setTokens(list)
        setInheritedAutoGroups(autoGroups)
        if (list.length === 0) {
          setSelectedTokenId('')
        }
      } catch {
        if (!cancelled) setTokens([])
      } finally {
        if (!cancelled) setIsLoadingTokens(false)
      }
    }
    void loadTokens()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (isLoadingTokens || !selectedModel) return
    const saved = loadStoredTokenId(STORAGE_KEYS_IMAGE.TOKEN_ID)
    setSelectedTokenId((current) =>
      selectCompatibleTokenId(compatibleTokens, current, saved)
    )
  }, [compatibleTokens, isLoadingTokens, selectedModel])

  useEffect(() => {
    if (props.imageModels.length === 0) return
    const exists = props.imageModels.some((m) => m.model === selectedModelName)
    if (!exists) {
      setSelectedModelName(props.imageModels[0].model)
    }
  }, [props.imageModels, selectedModelName])

  useEffect(() => {
    if (!selectedModel) return
    setFormState((current) => {
      if (current?.model === selectedModel.model) {
        return current
      }
      const next = getDefaultImageFormState(selectedModel)
      if (current?.prompt) {
        next.prompt = current.prompt
      }
      return next
    })
  }, [selectedModel])

  useEffect(() => {
    const reused = props.onReusePrompt
    if (!reused) return
    setFormState((current) =>
      current ? { ...current, prompt: reused } : current
    )
  }, [props.onReusePrompt, props.reusePromptNonce])

  useEffect(() => {
    saveStoredTokenId(STORAGE_KEYS_IMAGE.TOKEN_ID, selectedTokenId)
  }, [selectedTokenId])

  useEffect(() => {
    saveImageDraft({
      model: selectedModelName,
      tokenId: selectedTokenId,
      form: formState,
    })
  }, [selectedModelName, selectedTokenId, formState])

  const getKeyPlaceholder = () => {
    if (isLoadingTokens) return t('Loading...')
    if (tokens.length === 0) return t('No API keys available')
    return t('Select API key')
  }

  const nRange = selectedModel?.capabilities.n_range ?? [1, 1]
  const nLocked = nRange[0] === nRange[1]
  const showNField =
    selectedModel?.capabilities.fields.includes('n') === true && !nLocked

  const canSubmit =
    !!formState?.prompt.trim() &&
    !!selectedTokenId &&
    compatibleTokens.some((token) => String(token.id) === selectedTokenId) &&
    !!selectedModel &&
    !!formState

  const handleSubmit = async () => {
    if (!selectedModel || !formState) return
    if (!formState.prompt.trim()) return
    if (!selectedTokenId) return

    const selectedToken = compatibleTokens.find(
      (token) => String(token.id) === selectedTokenId
    )
    if (!selectedToken) return

    const realKey = await fetchTokenKey(selectedToken.id)
    if (!realKey) return

    const clampedN = Math.min(Math.max(formState.n, nRange[0]), nRange[1])
    const req = buildImageRequest(
      { ...formState, n: clampedN },
      selectedModel.profile
    )
    await props.onSubmit(req, realKey, { profile: selectedModel.profile })
  }

  if (props.imageModels.length === 0) {
    return (
      <div className='text-muted-foreground flex flex-col gap-2 p-4 text-sm'>
        <p>{t('No text-to-image models available')}</p>
        <p className='text-xs'>
          {t(
            'Add enabled catalog models with the t2i tag and ensure your group has access.'
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
            {props.imageModels.map((model) => (
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
        <Label htmlFor='image-prompt'>{t('Prompt')}</Label>
        <Textarea
          id='image-prompt'
          className='min-h-[100px] resize-none'
          placeholder={t('Describe the image you want to generate...')}
          value={formState?.prompt ?? ''}
          onChange={(e) =>
            setFormState((current) =>
              current ? { ...current, prompt: e.target.value } : current
            )
          }
        />
      </div>

      {selectedModel && formState && (
        <>
          <div className='flex flex-col gap-1.5'>
            <Label>{t('Size')}</Label>
            <div className='flex flex-wrap gap-2'>
              {selectedModel.capabilities.supported_sizes.map((size) => (
                <Button
                  key={size}
                  className='min-w-0 flex-1'
                  size='sm'
                  type='button'
                  variant={formState.size === size ? 'default' : 'outline'}
                  onClick={() =>
                    setFormState((current) =>
                      current ? { ...current, size } : current
                    )
                  }
                >
                  {size}
                </Button>
              ))}
            </div>
          </div>

          {showNField && (
            <div className='flex flex-col gap-1.5'>
              <Label htmlFor='image-n'>{t('Number of images')}</Label>
              <Input
                id='image-n'
                type='number'
                min={nRange[0]}
                max={nRange[1]}
                step={1}
                value={formState.n}
                onChange={(e) => {
                  const parsed = Number.parseInt(e.target.value, 10)
                  if (Number.isNaN(parsed)) return
                  setFormState((current) =>
                    current
                      ? {
                          ...current,
                          n: Math.min(Math.max(parsed, nRange[0]), nRange[1]),
                        }
                      : current
                  )
                }}
              />
              <p className='text-muted-foreground text-xs'>
                {t('Allowed range')}: {nRange[0]}–{nRange[1]}
              </p>
            </div>
          )}
        </>
      )}

      <Button
        className='w-full'
        disabled={!canSubmit}
        type='button'
        onClick={handleSubmit}
      >
        {props.isSubmitting ? (
          <>
            <Loader2Icon className='mr-2 size-4 animate-spin' />
            {t('Generating...')}
          </>
        ) : (
          <>
            <ImageIcon className='mr-2 size-4' />
            {t('Generate Image')}
          </>
        )}
      </Button>
    </div>
  )
}
