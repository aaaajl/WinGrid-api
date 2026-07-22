import fs from 'node:fs/promises'
import path from 'node:path'

const LOCALES_DIR = path.resolve('src/i18n/locales')

function stableStringify(obj) {
  return JSON.stringify(obj, null, 2) + '\n'
}

const newKeys = {
  en: {
    From: 'From',
    'No size prices configured.': 'No size prices configured.',
    'Per Duration': 'Per Duration',
    sec: 'sec',
    'Starting price per second; final charge = rate × duration':
      'Starting price per second; final charge = rate × duration',
  },
  zh: {
    From: '起',
    'No size prices configured.': '尚未配置分辨率单价。',
    'Per Duration': '按时长',
    sec: '秒',
    'Starting price per second; final charge = rate × duration':
      '展示起步价（美元/秒）；实际扣费 = 单价 × 时长',
  },
  'zh-TW': {
    From: '起',
    'No size prices configured.': '尚未設定解析度單價。',
    'Per Duration': '按時長',
    sec: '秒',
    'Starting price per second; final charge = rate × duration':
      '顯示起步價（美元/秒）；實際扣費 = 單價 × 時長',
  },
  fr: {
    From: 'À partir de',
    'No size prices configured.':
      'Aucun prix par résolution n’est configuré.',
    'Per Duration': 'Par durée',
    sec: 's',
    'Starting price per second; final charge = rate × duration':
      'Prix de départ par seconde ; montant final = tarif × durée',
  },
  ja: {
    From: 'から',
    'No size prices configured.': '解像度単価が設定されていません。',
    'Per Duration': '時間課金',
    sec: '秒',
    'Starting price per second; final charge = rate × duration':
      '秒単価の最低価格を表示します。実際の請求 = 単価 × 秒数',
  },
  ru: {
    From: 'От',
    'No size prices configured.': 'Цены по разрешению не настроены.',
    'Per Duration': 'По длительности',
    sec: 'с',
    'Starting price per second; final charge = rate × duration':
      'Стартовая цена за секунду; итог = ставка × длительность',
  },
  vi: {
    From: 'Từ',
    'No size prices configured.': 'Chưa cấu hình đơn giá theo độ phân giải.',
    'Per Duration': 'Theo thời lượng',
    sec: 'giây',
    'Starting price per second; final charge = rate × duration':
      'Giá khởi điểm mỗi giây; phí thực tế = đơn giá × thời lượng',
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
      } else if (json.translation[key] != value) {
        json.translation[key] = value
        count++
      }
    }

    if (count > 0) {
      json.translation = Object.fromEntries(
        Object.entries(json.translation).sort(([a], [b]) => a.localeCompare(b))
      )
      await fs.writeFile(filePath, stableStringify(json), 'utf8')
    }

    console.log(`${locale}: ${count} translations applied`)
    totalAdded += count
  }

  console.log(`\nTotal: ${totalAdded} translations applied`)
}

main().catch((err) => {
  console.error(err)
  process.exitCode = 1
})
