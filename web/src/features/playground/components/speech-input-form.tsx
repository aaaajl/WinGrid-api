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
import { Link } from '@tanstack/react-router'
import { KeyRoundIcon, Loader2Icon, Volume2Icon } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { ComboboxInput } from '@/components/ui/combobox-input'
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
import { STORAGE_KEYS_SPEECH } from '../constants'
import {
  getCompatibleTokens,
  selectCompatibleTokenId,
} from '../lib/api-key-selection'
import {
  buildSpeechRequest,
  getDefaultSpeechFormState,
  type SpeechFormState,
} from '../lib/speech/build-speech-request'
import {
  loadSpeechDraft,
  loadStoredTokenId,
  saveSpeechDraft,
  saveStoredTokenId,
} from '../lib/storage/ui-draft'
import type {
  PlaygroundSpeechModel,
  SpeechGenerationRequest,
  SpeechRequestProfile,
  TokenOption,
} from '../types'

interface SpeechInputFormProps {
  speechModels: PlaygroundSpeechModel[]
  onSubmit: (
    req: SpeechGenerationRequest,
    apiKey: string,
    meta?: { profile?: SpeechRequestProfile }
  ) => Promise<void>
  isSubmitting?: boolean
  onReuseInput?: string | null
  reuseInputNonce?: number
}

export function SpeechInputForm(props: SpeechInputFormProps) {
  const { t } = useTranslation()
  const userGroup = useAuthStore((state) => state.auth.user?.group ?? '')
  const initialDraft = useMemo(() => loadSpeechDraft(), [])

  const [selectedModelName, setSelectedModelName] = useState(
    () => initialDraft?.model || props.speechModels[0]?.model || ''
  )
  const [formState, setFormState] = useState<SpeechFormState | null>(
    () => initialDraft?.form ?? null
  )
  const [tokens, setTokens] = useState<TokenOption[]>([])
  const [inheritedAutoGroups, setInheritedAutoGroups] = useState<string[]>([])
  const [selectedTokenId, setSelectedTokenId] = useState(
    () =>
      initialDraft?.tokenId ||
      loadStoredTokenId(STORAGE_KEYS_SPEECH.TOKEN_ID) ||
      ''
  )
  const [isLoadingTokens, setIsLoadingTokens] = useState(true)

  const selectedModel = useMemo(
    () =>
      props.speechModels.find((m) => m.model === selectedModelName) ??
      props.speechModels[0],
    [props.speechModels, selectedModelName]
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
    const saved = loadStoredTokenId(STORAGE_KEYS_SPEECH.TOKEN_ID)
    setSelectedTokenId((current) =>
      selectCompatibleTokenId(compatibleTokens, current, saved)
    )
  }, [compatibleTokens, isLoadingTokens, selectedModel])

  useEffect(() => {
    if (props.speechModels.length === 0) return
    const exists = props.speechModels.some((m) => m.model === selectedModelName)
    if (!exists) {
      setSelectedModelName(props.speechModels[0].model)
    }
  }, [props.speechModels, selectedModelName])

  useEffect(() => {
    if (!selectedModel) return
    setFormState((current) => {
      if (current?.model === selectedModel.model) {
        return current
      }
      const next = getDefaultSpeechFormState(selectedModel)
      if (current?.input) {
        next.input = current.input
      }
      return next
    })
  }, [selectedModel])

  useEffect(() => {
    const reused = props.onReuseInput
    if (!reused) return
    setFormState((current) =>
      current ? { ...current, input: reused } : current
    )
  }, [props.onReuseInput, props.reuseInputNonce])

  useEffect(() => {
    saveStoredTokenId(STORAGE_KEYS_SPEECH.TOKEN_ID, selectedTokenId)
  }, [selectedTokenId])

  useEffect(() => {
    saveSpeechDraft({
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

  const capabilities = selectedModel?.capabilities
  const voices = useMemo(() => capabilities?.voices ?? [], [capabilities])
  const voiceOptions = useMemo(
    () => voices.map((voice) => ({ value: voice, label: voice })),
    [voices]
  )
  const responseFormats = capabilities?.response_formats ?? []
  const speedRange = capabilities?.speed_range ?? [0, 0]
  const fields = capabilities?.fields ?? []
  const allowCustomVoice = capabilities?.allow_custom_voice ?? false
  const showSpeed = fields.includes('speed')
  const showInstructions = fields.includes('instructions')

  const canSubmit =
    !!formState?.input.trim() &&
    !!selectedTokenId &&
    compatibleTokens.some((token) => String(token.id) === selectedTokenId) &&
    !!selectedModel &&
    !!formState

  const handleSubmit = async () => {
    if (!selectedModel || !formState) return
    if (!formState.input.trim()) return
    if (!selectedTokenId) return

    const selectedToken = compatibleTokens.find(
      (token) => String(token.id) === selectedTokenId
    )
    if (!selectedToken) return

    const realKey = await fetchTokenKey(selectedToken.id)
    if (!realKey) return

    const req = buildSpeechRequest(formState)
    await props.onSubmit(req, realKey, { profile: selectedModel.profile })
  }

  if (props.speechModels.length === 0) {
    return (
      <div className='text-muted-foreground flex flex-col gap-2 p-4 text-sm'>
        <p>{t('No text-to-speech models available')}</p>
        <p className='text-xs'>
          {t(
            'Add enabled catalog models with the t2a tag and ensure your group has access.'
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
            {props.speechModels.map((model) => (
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
      </div>

      <div className='flex flex-col gap-1.5'>
        <Label htmlFor='speech-input'>{t('Text to synthesize')}</Label>
        <Textarea
          id='speech-input'
          className='min-h-[100px] resize-none'
          placeholder={t('Enter the text you want to convert to speech...')}
          value={formState?.input ?? ''}
          onChange={(e) =>
            setFormState((current) =>
              current ? { ...current, input: e.target.value } : current
            )
          }
        />
      </div>

      <div className='flex flex-col gap-1.5'>
        <Label htmlFor='speech-voice'>{t('Voice')}</Label>
        {allowCustomVoice || voices.length === 0 ? (
          <ComboboxInput
            id='speech-voice'
            options={voiceOptions}
            value={formState?.voice ?? ''}
            onValueChange={(value) =>
              setFormState((current) =>
                current ? { ...current, voice: value } : current
              )
            }
            allowCustomValue
            placeholder={t('Select voice')}
            emptyText={t('No voices found.')}
          />
        ) : (
          <Select
            value={formState?.voice || undefined}
            onValueChange={(v) => {
              if (v != null) {
                setFormState((current) =>
                  current ? { ...current, voice: v } : current
                )
              }
            }}
          >
            <SelectTrigger>
              <SelectValue placeholder={t('Select voice')} />
            </SelectTrigger>
            <SelectContent>
              {voices.map((voice) => (
                <SelectItem key={voice} value={voice}>
                  {voice}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      {responseFormats.length > 0 && (
        <div className='flex flex-col gap-1.5'>
          <Label>{t('Response format')}</Label>
          <Select
            value={formState?.responseFormat || undefined}
            onValueChange={(v) => {
              if (v != null) {
                setFormState((current) =>
                  current ? { ...current, responseFormat: v } : current
                )
              }
            }}
          >
            <SelectTrigger>
              <SelectValue placeholder={t('Select response format')} />
            </SelectTrigger>
            <SelectContent>
              {responseFormats.map((format) => (
                <SelectItem key={format} value={format}>
                  {format}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {showSpeed && (
        <div className='flex flex-col gap-1.5'>
          <Label htmlFor='speech-speed'>{t('Speed')}</Label>
          <Input
            id='speech-speed'
            type='number'
            min={speedRange[0]}
            max={speedRange[1]}
            step={0.05}
            value={formState?.speed ?? 1}
            onChange={(e) => {
              const parsed = Number.parseFloat(e.target.value)
              if (Number.isNaN(parsed)) return
              setFormState((current) =>
                current
                  ? {
                      ...current,
                      speed: Math.min(
                        Math.max(parsed, speedRange[0]),
                        speedRange[1]
                      ),
                    }
                  : current
              )
            }}
          />
          <p className='text-muted-foreground text-xs'>
            {t('Allowed range')}: {speedRange[0]}–{speedRange[1]}
          </p>
        </div>
      )}

      {showInstructions && (
        <div className='flex flex-col gap-1.5'>
          <Label htmlFor='speech-instructions'>{t('Instructions')}</Label>
          <Textarea
            id='speech-instructions'
            className='min-h-[60px] resize-none'
            placeholder={t('Optional voice style instructions...')}
            value={formState?.instructions ?? ''}
            onChange={(e) => {
              const value = e.target.value
              setFormState((current) =>
                current ? { ...current, instructions: value } : current
              )
            }}
          />
        </div>
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
            <Volume2Icon className='mr-2 size-4' />
            {t('Generate Speech')}
          </>
        )}
      </Button>
    </div>
  )
}
