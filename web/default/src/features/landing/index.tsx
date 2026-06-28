import { useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'
import { PublicLayout } from '@/components/layout'
import {
  LANDING_CODE_LANGUAGES,
  LANDING_FAQS,
  LANDING_FEATURES,
  LANDING_METRICS,
  LANDING_PRICING_ROWS,
} from './constants'

const API_BASE = 'https://ai.wormholexyz.xyz/v1'
const CONSOLE_URL = '/login'

const codeSnippets: Record<string, string> = {
  python: `import openai

client = openai.OpenAI(
    # One line to change your global API gateway
    base_url="${API_BASE}",
    api_key="sk-your-api-key"
)

response = client.chat.completions.create(
    model="deepseek-r1",
    messages=[{"role": "user", "content": "Hello AI!"}]
)`,
  javascript: `const { OpenAI } = require("openai");

const openai = new OpenAI({
    baseURL: "${API_BASE}",
    apiKey: "sk-your-api-key"
});

async function main() {
    const completion = await openai.chat.completions.create({
        model: "deepseek-r1",
        messages: [{ role: "user", content: "Hello AI!" }],
    });
}`,
  curl: `curl ${API_BASE}/chat/completions \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer sk-your-api-key" \\
  -d '{
    "model": "deepseek-r1",
    "messages": [{"role": "user", "content": "Hello AI!"}]
  }'`,
}

const featureIcons = [
  (
    <svg className='w-6 h-6' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2'>
      <path d='M13 2L3 14h9l-1 8 10-12h-9l1-8z' />
    </svg>
  ),
  (
    <svg className='w-6 h-6' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2'>
      <path d='M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z' />
    </svg>
  ),
  (
    <svg className='w-6 h-6' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2'>
      <rect x='2' y='2' width='20' height='8' rx='2' ry='2' />
      <rect x='2' y='14' width='20' height='8' rx='2' ry='2' />
      <path d='M6 6h.01M6 18h.01' />
    </svg>
  ),
]

function featureColorClass(color: string) {
  if (color === 'emerald') return 'bg-emerald-500/10 text-emerald-400'
  if (color === 'indigo') return 'bg-indigo-500/10 text-indigo-400'
  return 'bg-purple-500/10 text-purple-400'
}

function metricValueColorClass(color: string) {
  if (color === 'emerald') return 'text-emerald-400'
  if (color === 'indigo') return 'text-indigo-400'
  return 'text-purple-400'
}

export function Landing() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [activeLang, setActiveLang] = useState('python')
  const currentYear = new Date().getFullYear()

  return (
    <PublicLayout showMainContainer={false}>
      <div className='bg-[#0F172A] text-slate-200 antialiased min-h-screen flex flex-col transition-colors duration-300'>
        <section className='max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-16 pb-24 grid grid-cols-1 lg:grid-cols-12 gap-12 items-center'>
          <div className='lg:col-span-6 space-y-6'>
            <div className='inline-flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/20 px-3 py-1 rounded-full text-xs font-medium text-emerald-400 animate-pulse'>
              <span className='w-2 h-2 rounded-full bg-emerald-400' />{' '}
              {t('Global Edge Optimization Live')}
            </div>
            <h1 className='text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-white leading-tight'>
              {t('Empower Your Apps with Elite AI Models —')}{' '}
              <span className='bg-clip-text text-transparent bg-gradient-to-r from-emerald-400 to-indigo-400'>
                {t('Globally, Instantly.')}
              </span>
            </h1>
            <p className='text-lg text-slate-400 max-w-xl'>
              {t(
                'Deploy cost-effective, high-concurrency applications globally. Zero setup, 100% OpenAI SDK compatible backend.'
              )}
            </p>
            <div className='pt-4 flex flex-wrap gap-4'>
              <button
                onClick={() => navigate({ to: '/register' })}
                className='bg-white text-slate-900 font-semibold px-6 py-3 rounded-md hover:bg-slate-100 transition-all shadow-xl shadow-white/5 cursor-pointer'
              >
                {t('Get Started Free')}
              </button>
              <a
                href={CONSOLE_URL}
                className='border border-slate-700 hover:border-slate-500 text-slate-300 font-medium px-6 py-3 rounded-md transition-all'
              >
                {t('Sign In')}
              </a>
            </div>
          </div>

          <div className='lg:col-span-6 bg-slate-900 border border-slate-800 rounded-xl shadow-2xl p-6 relative overflow-hidden'>
            <div className='absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-slate-700 to-transparent' />
            <div className='flex items-center justify-between pb-4 border-b border-slate-800 mb-4'>
              <div className='flex items-center gap-2'>
                <span className='w-3 h-3 rounded-full bg-rose-500' />
                <span className='w-3 h-3 rounded-full bg-amber-500' />
                <span className='w-3 h-3 rounded-full bg-emerald-500' />
              </div>
              <div className='flex gap-1.5 bg-slate-950 p-1 rounded-md border border-slate-800'>
                {LANDING_CODE_LANGUAGES.map((lang) => (
                  <button
                    key={lang.id}
                    onClick={() => setActiveLang(lang.id)}
                    className={`text-xs font-semibold px-2.5 py-1 rounded cursor-pointer transition-all ${
                      activeLang === lang.id
                        ? 'bg-slate-800 text-emerald-400 border border-slate-700'
                        : 'text-slate-500 hover:text-slate-300'
                    }`}
                  >
                    {t(lang.labelKey)}
                  </button>
                ))}
              </div>
            </div>
            <div className='overflow-y-auto max-h-[320px]'>
              <pre className='text-xs md:text-sm text-slate-300 overflow-x-auto leading-relaxed font-mono'>
                <code>{codeSnippets[activeLang]}</code>
              </pre>
            </div>
          </div>
        </section>

        <section className='bg-slate-900/50 border-y border-slate-800/60 py-20'>
          <div className='max-w-7xl mx-auto px-4 sm:px-6 lg:px-8'>
            <div className='text-center max-w-3xl mx-auto space-y-4 mb-16'>
              <h2 className='text-3xl font-bold tracking-tight text-white'>
                {t('Engineered for Global Scale & Ultimate Stability')}
              </h2>
              <p className='text-slate-400 text-sm md:text-base'>
                {t(
                  'Why global technical teams and elite developers choose Wormhole Infrastructure.'
                )}
              </p>
            </div>
            <div className='grid grid-cols-1 md:grid-cols-3 gap-8'>
              {LANDING_FEATURES.map((feature, i) => (
                <div
                  key={feature.titleKey}
                  className='bg-slate-900 border border-slate-800 p-8 rounded-xl space-y-4 hover:border-slate-700 transition-all'
                >
                  <div
                    className={`w-10 h-10 rounded-lg flex items-center justify-center ${featureColorClass(feature.color)}`}
                  >
                    {featureIcons[i]}
                  </div>
                  <h3 className='text-lg font-bold text-white'>{t(feature.titleKey)}</h3>
                  <p className='text-sm text-slate-400 leading-relaxed'>{t(feature.descKey)}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className='max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20'>
          <div className='text-center max-w-3xl mx-auto space-y-4 mb-12'>
            <h2 className='text-3xl font-bold tracking-tight text-white'>
              {t('Transparent Pay-As-You-Go Pricing')}
            </h2>
            <p className='text-slate-400 text-sm'>
              {t(
                'No monthly minimum commitments. Pay precisely for what you use, mapped directly in USD.'
              )}
            </p>
          </div>

          <div className='bg-slate-900 border border-slate-800 rounded-xl overflow-hidden max-w-4xl mx-auto shadow-xl'>
            <table className='w-full text-left text-sm border-collapse'>
              <thead>
                <tr className='bg-slate-800/50 text-slate-300 font-semibold border-b border-slate-800'>
                  <th className='p-4'>{t('Model')}</th>
                  <th className='p-4'>{t('Input / 1M Tokens')}</th>
                  <th className='p-4'>{t('Output / 1M Tokens')}</th>
                  <th className='p-4'>{t('Status')}</th>
                </tr>
              </thead>
              <tbody className='divide-y divide-slate-800/60 text-slate-400'>
                {LANDING_PRICING_ROWS.map((row) => (
                  <tr key={row.model} className='hover:bg-slate-800/20'>
                    <td className='p-4 font-medium text-white'>{row.model}</td>
                    <td className='p-4'>{row.input}</td>
                    <td className='p-4'>{row.output}</td>
                    <td className='p-4 text-emerald-400 font-medium'>● {row.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className='p-6 bg-slate-950/40 border-t border-slate-800 flex flex-wrap items-center justify-between gap-4'>
              <div className='text-xs text-slate-400'>
                {t('Supported: Alipay, WeChat Pay, USDT Crypto, Stripe')}
              </div>
              <button
                onClick={() => navigate({ to: '/register' })}
                className='text-xs bg-slate-800 hover:bg-slate-700 text-white font-semibold px-4 py-2 rounded border border-slate-700 transition-all cursor-pointer'
              >
                {t('Activate Developer Free Tier')}
              </button>
            </div>
          </div>
        </section>

        <section className='bg-slate-900/30 border-y border-slate-800/60 py-20'>
          <div className='max-w-7xl mx-auto px-4 sm:px-6 lg:px-8'>
            <div className='text-center max-w-3xl mx-auto space-y-4 mb-12'>
              <h2 className='text-2xl font-bold text-white'>
                {t('Technical Performance Metrics')}
              </h2>
              <p className='text-slate-400 text-xs md:text-sm'>
                {t('Actual production diagnostics measuring global routing efficiency.')}
              </p>
            </div>
            <div className='max-w-3xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-4 text-center'>
              {LANDING_METRICS.map((metric) => (
                <div key={metric.labelKey} className='bg-slate-900 p-6 rounded-lg border border-slate-800'>
                  <div className='text-xs font-semibold text-slate-500 uppercase tracking-wider'>
                    {t(metric.labelKey)}
                  </div>
                  <div
                    className={`text-3xl font-bold mt-2 ${metricValueColorClass(metric.color)}`}
                  >
                    {metric.value}
                  </div>
                  <div className='text-xs text-slate-500 mt-1'>{t(metric.subKey)}</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className='max-w-4xl mx-auto px-4 py-20 space-y-8'>
          <h2 className='text-3xl font-bold text-white text-center mb-12'>
            {t('Frequently Asked Questions')}
          </h2>

          <div className='space-y-6'>
            {LANDING_FAQS.map((faq) => (
              <div key={faq.questionKey} className='bg-slate-900 border border-slate-800 p-6 rounded-lg'>
                <h3 className='font-semibold text-white mb-2 text-base flex gap-2'>
                  <span className='text-emerald-400 font-bold'>{t('Q:')}</span>{' '}
                  {t(faq.questionKey)}
                </h3>
                <p className='text-sm text-slate-400 pl-6 leading-relaxed'>
                  <span className='text-indigo-400 font-medium'>{t('A:')}</span> {t(faq.answerKey)}
                </p>
              </div>
            ))}
          </div>
        </section>

        <footer className='bg-slate-950 border-t border-slate-900 text-xs text-slate-500 py-12'>
          <div className='max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row items-center justify-between gap-6'>
            <div className='space-y-2 text-center md:text-left'>
              <p className='text-slate-400 font-medium text-sm'>{t('Wormhole API')}</p>
              <p>{t('© {{year}} Wormhole. All rights reserved.', { year: currentYear })}</p>
            </div>
            <div className='flex gap-6 text-slate-400'>
              <a href='/privacy-policy' className='hover:text-emerald-400 transition-colors'>
                {t('Privacy Policy')}
              </a>
              <a href='/user-agreement' className='hover:text-emerald-400 transition-colors'>
                {t('Terms of Service')}
              </a>
              <a href='mailto:support@wormholexyz.xyz' className='hover:text-emerald-400 transition-colors'>
                support@wormholexyz.xyz
              </a>
            </div>
          </div>
        </footer>
      </div>
    </PublicLayout>
  )
}
