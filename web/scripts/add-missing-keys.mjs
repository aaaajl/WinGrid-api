import fs from 'node:fs/promises'
import path from 'node:path'

const LOCALES_DIR = path.resolve('src/i18n/locales')

function stableStringify(obj) {
  return JSON.stringify(obj, null, 2) + '\n'
}

const newKeys = {
  en: {
    'Add enabled catalog models with the t2i tag and ensure your group has access.':
      'Add enabled catalog models with the t2i tag and ensure your group has access.',
    'Allowed range': 'Allowed range',
    'Describe the image you want to generate...':
      'Describe the image you want to generate...',
    'Failed to generate image': 'Failed to generate image',
    'Failed to load playground image models':
      'Failed to load playground image models',
    'Generate Image': 'Generate Image',
    'Generated images will appear here': 'Generated images will appear here',
    History: 'History',
    'Image generation completed': 'Image generation completed',
    'No image history yet': 'No image history yet',
    'No images returned from server': 'No images returned from server',
    'No text-to-image models available': 'No text-to-image models available',
    'Number of images': 'Number of images',
    Reuse: 'Reuse',
    Size: 'Size',
    'This model only supports generating 1 image per request.':
      'This model only supports generating 1 image per request.',
  },
  zh: {
    'Add enabled catalog models with the t2i tag and ensure your group has access.':
      '请添加已启用且带有 t2i 标签的目录模型，并确保当前分组可用。',
    'Allowed range': '允许范围',
    'Describe the image you want to generate...': '描述你想生成的图片…',
    'Failed to generate image': '图片生成失败',
    'Failed to load playground image models': '加载游乐场图片模型失败',
    'Generate Image': '生成图片',
    'Generated images will appear here': '生成的图片将显示在这里',
    History: '历史记录',
    'Image generation completed': '图片生成完成',
    'No image history yet': '暂无图片历史',
    'No images returned from server': '服务器未返回图片',
    'No text-to-image models available': '暂无可用的文生图模型',
    'Number of images': '生成数量',
    Reuse: '复用',
    Size: '尺寸',
    'This model only supports generating 1 image per request.':
      '该模型每次请求仅支持生成 1 张图片。',
  },
  'zh-TW': {
    'Add enabled catalog models with the t2i tag and ensure your group has access.':
      '請新增已啟用且帶有 t2i 標籤的目錄模型，並確保目前分組可用。',
    'Allowed range': '允許範圍',
    'Describe the image you want to generate...': '描述你想產生的圖片…',
    'Failed to generate image': '圖片產生失敗',
    'Failed to load playground image models': '載入遊樂場圖片模型失敗',
    'Generate Image': '產生圖片',
    'Generated images will appear here': '產生的圖片將顯示在這裡',
    History: '歷史紀錄',
    'Image generation completed': '圖片產生完成',
    'No image history yet': '尚無圖片歷史',
    'No images returned from server': '伺服器未回傳圖片',
    'No text-to-image models available': '尚無可用的文生圖模型',
    'Number of images': '產生數量',
    Reuse: '重用',
    Size: '尺寸',
    'This model only supports generating 1 image per request.':
      '此模型每次請求僅支援產生 1 張圖片。',
  },
  fr: {
    'Add enabled catalog models with the t2i tag and ensure your group has access.':
      'Ajoutez des modèles catalogue activés avec le tag t2i et assurez-vous que votre groupe y a accès.',
    'Allowed range': 'Plage autorisée',
    'Describe the image you want to generate...':
      "Décrivez l'image que vous souhaitez générer…",
    'Failed to generate image': "Échec de la génération d'image",
    'Failed to load playground image models':
      'Échec du chargement des modèles image du playground',
    'Generate Image': 'Générer une image',
    'Generated images will appear here':
      'Les images générées apparaîtront ici',
    History: 'Historique',
    'Image generation completed': "Génération d'image terminée",
    'No image history yet': "Pas encore d'historique d'images",
    'No images returned from server': 'Aucune image renvoyée par le serveur',
    'No text-to-image models available':
      'Aucun modèle texte-vers-image disponible',
    'Number of images': "Nombre d'images",
    Reuse: 'Réutiliser',
    Size: 'Taille',
    'This model only supports generating 1 image per request.':
      'Ce modèle ne prend en charge qu’une seule image par requête.',
  },
  ja: {
    'Add enabled catalog models with the t2i tag and ensure your group has access.':
      't2i タグ付きの有効なカタログモデルを追加し、グループから利用できることを確認してください。',
    'Allowed range': '許可範囲',
    'Describe the image you want to generate...':
      '生成したい画像を説明してください…',
    'Failed to generate image': '画像の生成に失敗しました',
    'Failed to load playground image models':
      'プレイグラウンドの画像モデルの読み込みに失敗しました',
    'Generate Image': '画像を生成',
    'Generated images will appear here': '生成した画像がここに表示されます',
    History: '履歴',
    'Image generation completed': '画像生成が完了しました',
    'No image history yet': '画像履歴はまだありません',
    'No images returned from server': 'サーバーから画像が返されませんでした',
    'No text-to-image models available':
      '利用可能なテキスト画像生成モデルがありません',
    'Number of images': '画像数',
    Reuse: '再利用',
    Size: 'サイズ',
    'This model only supports generating 1 image per request.':
      'このモデルは 1 回のリクエストで 1 枚のみ生成できます。',
  },
  ru: {
    'Add enabled catalog models with the t2i tag and ensure your group has access.':
      'Добавьте включённые модели каталога с тегом t2i и убедитесь, что у группы есть доступ.',
    'Allowed range': 'Допустимый диапазон',
    'Describe the image you want to generate...':
      'Опишите изображение, которое хотите сгенерировать…',
    'Failed to generate image': 'Не удалось сгенерировать изображение',
    'Failed to load playground image models':
      'Не удалось загрузить модели изображений playground',
    'Generate Image': 'Сгенерировать изображение',
    'Generated images will appear here':
      'Сгенерированные изображения появятся здесь',
    History: 'История',
    'Image generation completed': 'Генерация изображения завершена',
    'No image history yet': 'Истории изображений пока нет',
    'No images returned from server': 'Сервер не вернул изображения',
    'No text-to-image models available':
      'Нет доступных моделей текст-в-изображение',
    'Number of images': 'Количество изображений',
    Reuse: 'Повторить',
    Size: 'Размер',
    'This model only supports generating 1 image per request.':
      'Эта модель поддерживает только 1 изображение за запрос.',
  },
  vi: {
    'Add enabled catalog models with the t2i tag and ensure your group has access.':
      'Thêm các mô hình catalog đã bật với thẻ t2i và đảm bảo nhóm của bạn có quyền truy cập.',
    'Allowed range': 'Phạm vi cho phép',
    'Describe the image you want to generate...':
      'Mô tả hình ảnh bạn muốn tạo…',
    'Failed to generate image': 'Tạo hình ảnh thất bại',
    'Failed to load playground image models':
      'Không tải được mô hình hình ảnh playground',
    'Generate Image': 'Tạo hình ảnh',
    'Generated images will appear here':
      'Hình ảnh đã tạo sẽ xuất hiện tại đây',
    History: 'Lịch sử',
    'Image generation completed': 'Tạo hình ảnh hoàn tất',
    'No image history yet': 'Chưa có lịch sử hình ảnh',
    'No images returned from server': 'Máy chủ không trả về hình ảnh',
    'No text-to-image models available':
      'Không có mô hình tạo ảnh từ văn bản',
    'Number of images': 'Số lượng hình ảnh',
    Reuse: 'Dùng lại',
    Size: 'Kích thước',
    'This model only supports generating 1 image per request.':
      'Mô hình này chỉ hỗ trợ tạo 1 hình ảnh mỗi yêu cầu.',
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
