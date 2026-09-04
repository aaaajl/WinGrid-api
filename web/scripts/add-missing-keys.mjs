import fs from 'node:fs/promises'
import path from 'node:path'

const LOCALES_DIR = path.resolve('src/i18n/locales')

function stableStringify(obj) {
  return JSON.stringify(obj, null, 2) + '\n'
}

const newKeys = {
  en: {
    'Billing time': 'Billing time',
  },
  zh: {
    'Billing time': '计费时刻',
  },
  'zh-TW': {
    'Billing time': '計費時刻',
  },
  fr: {
    'Billing time': 'Heure de facturation',
  },
  ja: {
    'Billing time': '課金時刻',
  },
  ru: {
    'Billing time': 'Время тарификации',
  },
  vi: {
    'Billing time': 'Thời điểm tính phí',
  },
}

async function main() {
  let totalAdded = 0

  for (const [locale, trans] of Object.entries(newKeys)) {
    const filePath = path.join(LOCALES_DIR, `${locale}.json`)
    const json = JSON.parse(await fs.readFile(filePath, 'utf8'))

    let count = 0
    for (const [key, value] of Object.entries(trans)) {
      if (!Object.prototype.hasOwnProperty.call(json.translation, key)) {
        json.translation[key] = value
        count++
      } else if (json.translation[key] !== value) {
        json.translation[key] = value
        count++
      }
    }

    if (count > 0) {
      const sorted = Object.keys(json.translation)
        .sort((a, b) => a.localeCompare(b))
        .reduce((acc, k) => {
          acc[k] = json.translation[k]
          return acc
        }, {})
      json.translation = sorted
      await fs.writeFile(filePath, stableStringify(json))
      console.log(`${locale}: wrote ${count} key(s)`)
      totalAdded += count
    } else {
      console.log(`${locale}: no changes`)
    }
  }

  console.log(`Done. Total keys touched: ${totalAdded}`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
