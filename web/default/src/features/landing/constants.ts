export const LANDING_CODE_LANGUAGES = [
  { id: 'python', labelKey: 'Python' },
  { id: 'javascript', labelKey: 'JavaScript' },
  { id: 'curl', labelKey: 'cURL' },
] as const

export const LANDING_FEATURES = [
  {
    color: 'emerald',
    titleKey: 'Ultra-Low Latency',
    descKey:
      'Anycast routing across worldwide nodes. Bypasses international network congestion for rapid inference execution.',
  },
  {
    color: 'indigo',
    titleKey: 'Enterprise Privacy',
    descKey:
      'Strict zero-retention data privacy standards. Zero query logs saved, ensuring comprehensive IP safety and GDPR compliance.',
  },
  {
    color: 'purple',
    titleKey: 'Unified Matrix',
    descKey:
      'Consolidate multiple API keys. Maintain full direct access to DeepSeek, Qwen, Claude, and GPT in one balance wallet.',
  },
] as const

export const LANDING_PRICING_ROWS = [
  { model: 'deepseek-r1 / v3', input: '$0.14', output: '$0.28', status: '99.98%' },
  { model: 'claude-sonnet-4-6', input: '$3.00', output: '$15.00', status: '99.95%' },
  { model: 'gpt-4o', input: '$2.50', output: '$10.00', status: '99.97%' },
  { model: 'gemini-2.5-flash', input: '$0.15', output: '$0.60', status: '99.96%' },
] as const

export const LANDING_METRICS = [
  {
    value: '120ms',
    labelKey: 'Average Edge TTFB',
    subKey: 'Standard API: ~1800ms',
    color: 'emerald',
  },
  {
    value: '75 T/s',
    labelKey: 'Token Delivery Speed',
    subKey: 'Concurrent optimization enabled',
    color: 'indigo',
  },
  {
    value: '< 0.01%',
    labelKey: 'Network Packet Loss',
    subKey: 'Multi-route fallback protection',
    color: 'purple',
  },
] as const

export const LANDING_FAQS = [
  {
    questionKey: 'How does the platform solve cross-border high network latency?',
    answerKey:
      'We maintain high-bandwidth pipelines backed by global Anycast edge clusters. User endpoints route queries dynamically to the nearest regional network node, cutting standard response hops significantly.',
  },
  {
    questionKey: 'What payment methods are supported?',
    answerKey:
      'We fully support Alipay, WeChat Pay for domestic users, and Stripe, PayPal, USDT crypto for international users. Corporate invoicing is also available.',
  },
  {
    questionKey: 'Are my prompts and application inputs secure on your platform?',
    answerKey:
      'Absolutely. We enforce TLS 1.3 encryption for all data in transit. No query logging mechanisms record text values permanently; all prompt processing runs entirely stateless in memory.',
  },
] as const
