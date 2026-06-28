import { useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'
import { PublicLayout } from '@/components/layout'

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

export function Landing() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [activeLang, setActiveLang] = useState('python')

  return (
    <PublicLayout showMainContainer={false}>
      <div className='bg-[#0F172A] text-slate-200 antialiased min-h-screen flex flex-col transition-colors duration-300'>
        {/* Hero Section */}
        <section className='max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-16 pb-24 grid grid-cols-1 lg:grid-cols-12 gap-12 items-center'>
          <div className='lg:col-span-6 space-y-6'>
            <div className='inline-flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/20 px-3 py-1 rounded-full text-xs font-medium text-emerald-400 animate-pulse'>
              <span className='w-2 h-2 rounded-full bg-emerald-400' /> Global Edge Optimization Live
            </div>
            <h1 className='text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-white leading-tight'>
              Empower Your Apps with Elite AI Models —{' '}
              <span className='bg-clip-text text-transparent bg-gradient-to-r from-emerald-400 to-indigo-400'>
                Globally, Instantly.
              </span>
            </h1>
            <p className='text-lg text-slate-400 max-w-xl'>
              Deploy cost-effective, high-concurrency applications globally. Zero setup, 100% OpenAI SDK compatible backend.
            </p>
            <div className='pt-4 flex flex-wrap gap-4'>
              <button
                onClick={() => navigate({ to: '/register' })}
                className='bg-white text-slate-900 font-semibold px-6 py-3 rounded-md hover:bg-slate-100 transition-all shadow-xl shadow-white/5 cursor-pointer'
              >
                Get Started Free
              </button>
              <a
                href={CONSOLE_URL}
                className='border border-slate-700 hover:border-slate-500 text-slate-300 font-medium px-6 py-3 rounded-md transition-all'
              >
                Sign In
              </a>
            </div>
          </div>

          {/* Code Terminal */}
          <div className='lg:col-span-6 bg-slate-900 border border-slate-800 rounded-xl shadow-2xl p-6 relative overflow-hidden'>
            <div className='absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-slate-700 to-transparent' />
            <div className='flex items-center justify-between pb-4 border-b border-slate-800 mb-4'>
              <div className='flex items-center gap-2'>
                <span className='w-3 h-3 rounded-full bg-rose-500' />
                <span className='w-3 h-3 rounded-full bg-amber-500' />
                <span className='w-3 h-3 rounded-full bg-emerald-500' />
              </div>
              <div className='flex gap-1.5 bg-slate-950 p-1 rounded-md border border-slate-800'>
                {['python', 'javascript', 'curl'].map((lang) => (
                  <button
                    key={lang}
                    onClick={() => setActiveLang(lang)}
                    className={`text-xs font-semibold px-2.5 py-1 rounded cursor-pointer transition-all ${
                      activeLang === lang
                        ? 'bg-slate-800 text-emerald-400 border border-slate-700'
                        : 'text-slate-500 hover:text-slate-300'
                    }`}
                  >
                    {lang === 'javascript' ? 'JavaScript' : lang.charAt(0).toUpperCase() + lang.slice(1)}
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

        {/* Features Section */}
        <section className='bg-slate-900/50 border-y border-slate-800/60 py-20'>
          <div className='max-w-7xl mx-auto px-4 sm:px-6 lg:px-8'>
            <div className='text-center max-w-3xl mx-auto space-y-4 mb-16'>
              <h2 className='text-3xl font-bold tracking-tight text-white'>
                Engineered for Global Scale & Ultimate Stability
              </h2>
              <p className='text-slate-400 text-sm md:text-base'>
                Why global technical teams and elite developers choose Wormhole Infrastructure.
              </p>
            </div>
            <div className='grid grid-cols-1 md:grid-cols-3 gap-8'>
              {[
                {
                  icon: (
                    <svg className='w-6 h-6' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2'>
                      <path d='M13 2L3 14h9l-1 8 10-12h-9l1-8z' />
                    </svg>
                  ),
                  color: 'emerald',
                  title: 'Ultra-Low Latency',
                  desc: 'Anycast routing across worldwide nodes. Bypasses international network congestion for rapid inference execution.',
                },
                {
                  icon: (
                    <svg className='w-6 h-6' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2'>
                      <path d='M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z' />
                    </svg>
                  ),
                  color: 'indigo',
                  title: 'Enterprise Privacy',
                  desc: 'Strict zero-retention data privacy standards. Zero query logs saved, ensuring comprehensive IP safety and GDPR compliance.',
                },
                {
                  icon: (
                    <svg className='w-6 h-6' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2'>
                      <rect x='2' y='2' width='20' height='8' rx='2' ry='2' />
                      <rect x='2' y='14' width='20' height='8' rx='2' ry='2' />
                      <path d='M6 6h.01M6 18h.01' />
                    </svg>
                  ),
                  color: 'purple',
                  title: 'Unified Matrix',
                  desc: 'Consolidate multiple API keys. Maintain full direct access to DeepSeek, Qwen, Claude, and GPT in one balance wallet.',
                },
              ].map((feature, i) => (
                <div
                  key={i}
                  className='bg-slate-900 border border-slate-800 p-8 rounded-xl space-y-4 hover:border-slate-700 transition-all'
                >
                  <div
                    className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                      feature.color === 'emerald'
                        ? 'bg-emerald-500/10 text-emerald-400'
                        : feature.color === 'indigo'
                          ? 'bg-indigo-500/10 text-indigo-400'
                          : 'bg-purple-500/10 text-purple-400'
                    }`}
                  >
                    {feature.icon}
                  </div>
                  <h3 className='text-lg font-bold text-white'>{feature.title}</h3>
                  <p className='text-sm text-slate-400 leading-relaxed'>{feature.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Pricing Section */}
        <section className='max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20'>
          <div className='text-center max-w-3xl mx-auto space-y-4 mb-12'>
            <h2 className='text-3xl font-bold tracking-tight text-white'>
              Transparent Pay-As-You-Go Pricing
            </h2>
            <p className='text-slate-400 text-sm'>
              No monthly minimum commitments. Pay precisely for what you use, mapped directly in USD.
            </p>
          </div>

          <div className='bg-slate-900 border border-slate-800 rounded-xl overflow-hidden max-w-4xl mx-auto shadow-xl'>
            <table className='w-full text-left text-sm border-collapse'>
              <thead>
                <tr className='bg-slate-800/50 text-slate-300 font-semibold border-b border-slate-800'>
                  <th className='p-4'>Model</th>
                  <th className='p-4'>Input / 1M Tokens</th>
                  <th className='p-4'>Output / 1M Tokens</th>
                  <th className='p-4'>Status</th>
                </tr>
              </thead>
              <tbody className='divide-y divide-slate-800/60 text-slate-400'>
                {[
                  { model: 'deepseek-r1 / v3', input: '$0.14', output: '$0.28', status: '99.98%' },
                  { model: 'claude-sonnet-4-6', input: '$3.00', output: '$15.00', status: '99.95%' },
                  { model: 'gpt-4o', input: '$2.50', output: '$10.00', status: '99.97%' },
                  { model: 'gemini-2.5-flash', input: '$0.15', output: '$0.60', status: '99.96%' },
                ].map((row, i) => (
                  <tr key={i} className='hover:bg-slate-800/20'>
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
                Supported: Alipay, WeChat Pay, USDT Crypto, Stripe
              </div>
              <button
                onClick={() => navigate({ to: '/register' })}
                className='text-xs bg-slate-800 hover:bg-slate-700 text-white font-semibold px-4 py-2 rounded border border-slate-700 transition-all cursor-pointer'
              >
                Activate Developer Free Tier
              </button>
            </div>
          </div>
        </section>

        {/* Benchmark Section */}
        <section className='bg-slate-900/30 border-y border-slate-800/60 py-20'>
          <div className='max-w-7xl mx-auto px-4 sm:px-6 lg:px-8'>
            <div className='text-center max-w-3xl mx-auto space-y-4 mb-12'>
              <h2 className='text-2xl font-bold text-white'>
                Technical Performance Metrics
              </h2>
              <p className='text-slate-400 text-xs md:text-sm'>
                Actual production diagnostics measuring global routing efficiency.
              </p>
            </div>
            <div className='max-w-3xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-4 text-center'>
              {[
                { value: '120ms', label: 'Average Edge TTFB', sub: 'Standard API: ~1800ms', color: 'emerald' },
                { value: '75 T/s', label: 'Token Delivery Speed', sub: 'Concurrent optimization enabled', color: 'indigo' },
                { value: '< 0.01%', label: 'Network Packet Loss', sub: 'Multi-route fallback protection', color: 'purple' },
              ].map((metric, i) => (
                <div key={i} className='bg-slate-900 p-6 rounded-lg border border-slate-800'>
                  <div className='text-xs font-semibold text-slate-500 uppercase tracking-wider'>
                    {metric.label}
                  </div>
                  <div
                    className={`text-3xl font-bold mt-2 ${
                      metric.color === 'emerald'
                        ? 'text-emerald-400'
                        : metric.color === 'indigo'
                          ? 'text-indigo-400'
                          : 'text-purple-400'
                    }`}
                  >
                    {metric.value}
                  </div>
                  <div className='text-xs text-slate-500 mt-1'>{metric.sub}</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* FAQ Section */}
        <section className='max-w-4xl mx-auto px-4 py-20 space-y-8'>
          <h2 className='text-3xl font-bold text-white text-center mb-12'>
            Frequently Asked Questions
          </h2>

          <div className='space-y-6'>
            {[
              {
                q: 'How does the platform solve cross-border high network latency?',
                a: 'We maintain high-bandwidth pipelines backed by global Anycast edge clusters. User endpoints route queries dynamically to the nearest regional network node, cutting standard response hops significantly.',
              },
              {
                q: 'What payment methods are supported?',
                a: 'We fully support Alipay, WeChat Pay for domestic users, and Stripe, PayPal, USDT crypto for international users. Corporate invoicing is also available.',
              },
              {
                q: 'Are my prompts and application inputs secure on your platform?',
                a: 'Absolutely. We enforce TLS 1.3 encryption for all data in transit. No query logging mechanisms record text values permanently; all prompt processing runs entirely stateless in memory.',
              },
            ].map((faq, i) => (
              <div key={i} className='bg-slate-900 border border-slate-800 p-6 rounded-lg'>
                <h3 className='font-semibold text-white mb-2 text-base flex gap-2'>
                  <span className='text-emerald-400 font-bold'>Q:</span> {faq.q}
                </h3>
                <p className='text-sm text-slate-400 pl-6 leading-relaxed'>
                  <span className='text-indigo-400 font-medium'>A:</span> {faq.a}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* Footer */}
        <footer className='bg-slate-950 border-t border-slate-900 text-xs text-slate-500 py-12'>
          <div className='max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row items-center justify-between gap-6'>
            <div className='space-y-2 text-center md:text-left'>
              <p className='text-slate-400 font-medium text-sm'>Wormhole API</p>
              <p>&copy; 2026 Wormhole. All rights reserved.</p>
            </div>
            <div className='flex gap-6 text-slate-400'>
              <a href='/privacy-policy' className='hover:text-emerald-400 transition-colors'>
                Privacy Policy
              </a>
              <a href='/user-agreement' className='hover:text-emerald-400 transition-colors'>
                Terms of Service
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
