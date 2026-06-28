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
import { useEffect, useMemo, useRef, useState } from 'react'
import * as z from 'zod'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { formatTimestampToDate } from '@/lib/format'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Separator } from '@/components/ui/separator'
import { Switch } from '@/components/ui/switch'
import { DateTimePicker } from '@/components/datetime-picker'
import { deleteLogsBefore } from '../api'
import {
  SettingsControlGroup,
  SettingsForm,
  SettingsSwitchContent,
  SettingsSwitchItem,
} from '../components/settings-form-layout'
import { SettingsPageFormActions } from '../components/settings-page-context'
import { SettingsSection } from '../components/settings-section'
import { useUpdateOption } from '../hooks/use-update-option'
import { safeNumberFieldProps } from '../utils/numeric-field'

const logSettingsSchema = z.object({
  LogConsumeEnabled: z.boolean(),
  request_log_setting: z.object({
    enabled: z.boolean(),
    max_body_kb: z.coerce.number().min(0),
    retention_days: z.coerce.number().min(0),
    store_headers: z.boolean(),
    redact_headers: z.string(),
  }),
})

type LogSettingsFormInput = z.input<typeof logSettingsSchema>
type LogSettingsFormValues = z.output<typeof logSettingsSchema>

export type RequestLogSettingDefaults = {
  'request_log_setting.enabled': boolean
  'request_log_setting.max_body_kb': number
  'request_log_setting.retention_days': number
  'request_log_setting.store_headers': boolean
  'request_log_setting.redact_headers': string
}

type LogSettingsSectionProps = {
  defaultEnabled: boolean
  defaultRequestLogSettings: RequestLogSettingDefaults
}

const HOURS_IN_DAY = 24

const getDateHoursAgo = (hours: number) => {
  const date = new Date()
  date.setHours(date.getHours() - hours)
  return date
}

const getDateDaysAgo = (days: number) => getDateHoursAgo(days * HOURS_IN_DAY)

const quickSelectOptions = [
  {
    label: '24 hours ago',
    getValue: () => getDateHoursAgo(24),
  },
  {
    label: '7 days ago',
    getValue: () => getDateDaysAgo(7),
  },
  {
    label: '30 days ago',
    getValue: () => getDateDaysAgo(30),
  },
]

const buildFormDefaults = (
  defaultEnabled: boolean,
  requestLogDefaults: RequestLogSettingDefaults
): LogSettingsFormInput => ({
  LogConsumeEnabled: defaultEnabled,
  request_log_setting: {
    enabled: requestLogDefaults['request_log_setting.enabled'],
    max_body_kb: requestLogDefaults['request_log_setting.max_body_kb'],
    retention_days: requestLogDefaults['request_log_setting.retention_days'],
    store_headers: requestLogDefaults['request_log_setting.store_headers'],
    redact_headers: requestLogDefaults['request_log_setting.redact_headers'],
  },
})

const buildFlatDefaults = (
  defaultEnabled: boolean,
  requestLogDefaults: RequestLogSettingDefaults
): Record<string, string | number | boolean> => ({
  LogConsumeEnabled: defaultEnabled,
  'request_log_setting.enabled': requestLogDefaults['request_log_setting.enabled'],
  'request_log_setting.max_body_kb':
    requestLogDefaults['request_log_setting.max_body_kb'],
  'request_log_setting.retention_days':
    requestLogDefaults['request_log_setting.retention_days'],
  'request_log_setting.store_headers':
    requestLogDefaults['request_log_setting.store_headers'],
  'request_log_setting.redact_headers':
    requestLogDefaults['request_log_setting.redact_headers'],
})

const flattenFormValues = (
  values: LogSettingsFormValues
): Record<string, string | number | boolean> => ({
  LogConsumeEnabled: values.LogConsumeEnabled,
  'request_log_setting.enabled': values.request_log_setting.enabled,
  'request_log_setting.max_body_kb': values.request_log_setting.max_body_kb,
  'request_log_setting.retention_days':
    values.request_log_setting.retention_days,
  'request_log_setting.store_headers': values.request_log_setting.store_headers,
  'request_log_setting.redact_headers':
    values.request_log_setting.redact_headers,
})

export function LogSettingsSection({
  defaultEnabled,
  defaultRequestLogSettings,
}: LogSettingsSectionProps) {
  const { t } = useTranslation()
  const updateOption = useUpdateOption()
  const baselineRef = useRef(
    buildFlatDefaults(defaultEnabled, defaultRequestLogSettings)
  )

  const form = useForm<LogSettingsFormInput, unknown, LogSettingsFormValues>({
    resolver: zodResolver(logSettingsSchema),
    defaultValues: buildFormDefaults(defaultEnabled, defaultRequestLogSettings),
  })

  const requestLogEnabled = form.watch('request_log_setting.enabled')

  const [purgeDate, setPurgeDate] = useState<Date | undefined>(() =>
    getDateDaysAgo(30)
  )
  const [isCleaning, setIsCleaning] = useState(false)
  const [showConfirmDialog, setShowConfirmDialog] = useState(false)

  useEffect(() => {
    const defaults = buildFormDefaults(defaultEnabled, defaultRequestLogSettings)
    baselineRef.current = buildFlatDefaults(
      defaultEnabled,
      defaultRequestLogSettings
    )
    form.reset(defaults)
  }, [defaultEnabled, defaultRequestLogSettings, form])

  const purgeTimestamp = useMemo(() => {
    if (!purgeDate) return null
    return Math.floor(purgeDate.getTime() / 1000)
  }, [purgeDate])

  const formattedPurgeDate = useMemo(() => {
    if (!purgeDate) return ''
    return formatTimestampToDate(purgeDate.getTime(), 'milliseconds')
  }, [purgeDate])

  const onSubmit = async (values: LogSettingsFormValues) => {
    const normalized = flattenFormValues(values)
    const changedKeys = Object.keys(normalized).filter(
      (key) =>
        normalized[key] !==
        baselineRef.current[key as keyof typeof baselineRef.current]
    )

    if (changedKeys.length === 0) {
      toast.info(t('No changes to save'))
      return
    }

    for (const key of changedKeys) {
      await updateOption.mutateAsync({
        key,
        value: normalized[key as keyof typeof normalized],
      })
    }

    baselineRef.current = normalized
    form.reset(buildFormDefaults(values.LogConsumeEnabled, {
      'request_log_setting.enabled': values.request_log_setting.enabled,
      'request_log_setting.max_body_kb': values.request_log_setting.max_body_kb,
      'request_log_setting.retention_days':
        values.request_log_setting.retention_days,
      'request_log_setting.store_headers':
        values.request_log_setting.store_headers,
      'request_log_setting.redact_headers':
        values.request_log_setting.redact_headers,
    }))
  }

  const handleRequestCleanLogs = () => {
    if (!purgeTimestamp) {
      toast.error(t('Select a timestamp before clearing logs.'))
      return
    }

    setShowConfirmDialog(true)
  }

  const handleCleanLogs = async () => {
    if (!purgeTimestamp) {
      toast.error(t('Select a timestamp before clearing logs.'))
      return
    }

    setIsCleaning(true)
    try {
      const res = await deleteLogsBefore(purgeTimestamp)
      if (!res.success) {
        throw new Error(res.message || t('Failed to clean logs'))
      }
      const count = res.data ?? 0
      toast.success(
        count > 0
          ? t('{{count}} log entries removed.', { count })
          : t('No log entries matched the selected time.')
      )
    } catch (error) {
      const message =
        error instanceof Error ? error.message : t('Failed to clean logs')
      toast.error(message)
    } finally {
      setIsCleaning(false)
      setShowConfirmDialog(false)
    }
  }

  return (
    <SettingsSection title={t('Log Maintenance')}>
      <Form {...form}>
        <SettingsForm onSubmit={form.handleSubmit(onSubmit)}>
          <SettingsPageFormActions
            onSave={form.handleSubmit(onSubmit)}
            isSaving={updateOption.isPending}
            saveLabel='Save log settings'
          />
          <FormField
            control={form.control}
            name='LogConsumeEnabled'
            render={({ field }) => (
              <SettingsSwitchItem>
                <SettingsSwitchContent>
                  <FormLabel>{t('Record quota usage')}</FormLabel>
                  <FormDescription>
                    {t(
                      'Track per-request consumption to power usage analytics. Keeping this on increases database writes.'
                    )}
                  </FormDescription>
                </SettingsSwitchContent>
                <FormControl>
                  <Switch
                    checked={field.value}
                    onCheckedChange={field.onChange}
                  />
                </FormControl>
                <FormMessage />
              </SettingsSwitchItem>
            )}
          />

          <Separator />

          <div className='space-y-4'>
            <div>
              <h4 className='text-sm font-medium'>{t('API request log')}</h4>
              <p className='text-muted-foreground text-sm'>
                {t(
                  'Configure persistence of AI API client request payloads in request_log.'
                )}
              </p>
            </div>

            <FormField
              control={form.control}
              name='request_log_setting.enabled'
              render={({ field }) => (
                <SettingsSwitchItem>
                  <SettingsSwitchContent>
                    <FormLabel>{t('Record API request bodies')}</FormLabel>
                    <FormDescription>
                      {t(
                        'Persist AI API client request payloads to the request_log table for auditing. Does not include model listing or task polling. May contain sensitive data.'
                      )}
                    </FormDescription>
                  </SettingsSwitchContent>
                  <FormControl>
                    <Switch
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                  <FormMessage />
                </SettingsSwitchItem>
              )}
            />

            <div className='grid gap-4 md:grid-cols-2'>
              <FormField
                control={form.control}
                name='request_log_setting.max_body_kb'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('Max request body size (KB)')}</FormLabel>
                    <FormControl>
                      <Input
                        type='number'
                        min={0}
                        step={1}
                        {...safeNumberFieldProps(field)}
                        disabled={!requestLogEnabled}
                      />
                    </FormControl>
                    <FormDescription>
                      {t(
                        'Requests larger than this store metadata only. Set to 0 to never store bodies.'
                      )}
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name='request_log_setting.retention_days'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('Retention days')}</FormLabel>
                    <FormControl>
                      <Input
                        type='number'
                        min={0}
                        step={1}
                        {...safeNumberFieldProps(field)}
                        disabled={!requestLogEnabled}
                      />
                    </FormControl>
                    <FormDescription>
                      {t(
                        '0 means request logs are kept until manually cleaned.'
                      )}
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name='request_log_setting.store_headers'
              render={({ field }) => (
                <SettingsSwitchItem>
                  <SettingsSwitchContent>
                    <FormLabel>{t('Store request headers')}</FormLabel>
                  </SettingsSwitchContent>
                  <FormControl>
                    <Switch
                      checked={field.value}
                      onCheckedChange={field.onChange}
                      disabled={!requestLogEnabled}
                    />
                  </FormControl>
                  <FormMessage />
                </SettingsSwitchItem>
              )}
            />

            <FormField
              control={form.control}
              name='request_log_setting.redact_headers'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('Headers to redact')}</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      disabled={!requestLogEnabled}
                      placeholder='Authorization,Cookie,x-api-key'
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <Separator />

          <SettingsControlGroup className='space-y-3'>
            <div>
              <h4 className='text-sm font-medium'>{t('Clean history logs')}</h4>
              <p className='text-muted-foreground text-sm'>
                {t(
                  'Remove all log entries created before the selected timestamp.'
                )}
              </p>
            </div>
            <DateTimePicker value={purgeDate} onChange={setPurgeDate} />
            <div className='flex flex-wrap gap-3'>
              {quickSelectOptions.map((option) => (
                <Button
                  key={option.label}
                  type='button'
                  variant='outline'
                  onClick={() => setPurgeDate(option.getValue())}
                >
                  {t(option.label)}
                </Button>
              ))}
              <Button
                type='button'
                variant='destructive'
                onClick={handleRequestCleanLogs}
                disabled={isCleaning}
              >
                {isCleaning ? t('Cleaning...') : t('Clean logs')}
              </Button>
            </div>
          </SettingsControlGroup>
        </SettingsForm>
      </Form>
      <AlertDialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('Confirm log cleanup')}</AlertDialogTitle>
            <AlertDialogDescription>
              {formattedPurgeDate
                ? t(
                    'This will permanently remove all log entries created before {{date}}.',
                    { date: formattedPurgeDate }
                  )
                : t(
                    'This will permanently remove log entries before the selected timestamp.'
                  )}{' '}
              {t('This action cannot be undone.')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isCleaning}>
              {t('Cancel')}
            </AlertDialogCancel>
            <AlertDialogAction onClick={handleCleanLogs} disabled={isCleaning}>
              {isCleaning ? t('Cleaning...') : t('Delete logs')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </SettingsSection>
  )
}
