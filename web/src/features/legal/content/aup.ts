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
import { resolveLocalizedContent } from '../resolve-localized-content'

const AUP_BY_LANGUAGE = {
  en: `**Last Updated:** July 28, 2026

This Acceptable Use Policy ("Policy") governs your use of Unified API Calling Service for Large Language Models Service, provided by Shanghai WinGrid Technology Co., Ltd. By accessing or using the Service, you agree to comply with this Policy at all times. This Policy is incorporated by reference into our Terms of Service.

## 1. Prohibited Content

You must not use the Service to input, generate, store, or distribute any content that falls into the following categories:

- **Not Suitable for Work (NSFW), Explicit, or Sexually Suggestive Content**: Content that is not suitable for the workplace (NSFW), sexually explicit, or sexually suggestive — including nudity, pornography, sexually suggestive poses, graphic sexual acts, erotic roleplay, or any content intended to be sexually arousing — is strictly prohibited.

- **Violence and Gore**: Extreme violence, blood, mutilation, self-harm, suicide, or graphic depictions of physical abuse.

- **Hate Speech & Harassment**: Content that attacks, demeans, promotes discrimination, or incites hatred against individuals or groups based on race, ethnicity, religion, gender, sexual orientation, disability, nationality, or any other protected characteristic.

- **Exploitation of Minors**: Any content depicting, abusing, or exploiting minors under the age of 18.

- **Impersonation & Deception**: Creating deepfakes, highly realistic likenesses of real individuals without their explicit consent, or content designed to mislead, defraud, or spread disinformation.

- **Illegal Activities**: Content promoting, facilitating, or explaining how to commit illegal acts, including cyberattacks, weapon manufacturing, drug trafficking, or any violation of applicable laws.

- **Harassment & Bullying**: Content that harasses, bullies, threatens, or intimidates any individual or group.

## 2. Intellectual Property & Brand Rights

You agree not to:

- Submit prompts or reference materials that intentionally violate third-party copyrights, trademarks, or trade secrets.

- Generate content designed to copy or infringe upon proprietary characters, trademarked corporate logos, or protected intellectual property.

- Use the Service in any way that infringes upon the intellectual property rights of others.

## 3. Compliance & Automated Moderation

To maintain a safe environment for all users, we utilize automated content moderation technologies:

- **Content Moderation**: All prompts and inputs submitted to the Service are inspected through automated filtering systems.

- **Real-Time Blocking**: Any generation request containing policy-violating content will be automatically denied before generation.

- **Monitoring**: We conduct ongoing compliance monitoring and may test AI generation outputs at any time.

## 4. Prohibited Use Cases

The following use cases are strictly prohibited:

- Face-swap, deepfake, and face-manipulation tools.

- Generating or distributing content that is not suitable for the workplace (NSFW), sexually explicit, or sexually suggestive.

- Creating content for dating or adult entertainment platforms.

- Any use that violates applicable laws or regulations.

## 5. Consequences of Violation

If we detect that your account has violated this Policy, we reserve the right to take corrective action, including but not limited to:

- Immediate cancellation of the pending generation task.

- Issuance of a formal warning.

- Temporary suspension or permanent termination of your account without refund of unused credits.

- Reporting illegal activities to law enforcement when appropriate.

## 6. Contact Us & Appeals

If you believe your generation prompt was incorrectly flagged or blocked, you may request an appeal by contacting our support team:

**Email:** carmine.joint@gmail.com

Please include your user ID, timestamp, and details of the blocked prompt. We will review your case and respond as soon as possible.
`,

  zhCN: `**最后更新：** 2026年7月28日

本《可接受使用政策》（以下简称“本政策”）适用于您对上海赢格科技有限公司提供的大语言模型统一 API 调用服务（以下简称“本服务”）的使用。访问或使用本服务，即表示您同意在任何时候遵守本政策。本政策通过引用并入我们的服务条款。

## 1. 禁止内容

您不得使用本服务输入、生成、存储或分发属于以下类别的任何内容：

- **不适合工作场所（NSFW）、露骨或带有性暗示的内容**：严禁生成或传播不适合工作场所（NSFW）、色情露骨或带有性暗示的内容，包括裸露、色情、性暗示姿势、露骨性行为、情色角色扮演，或任何旨在引起性兴奋的内容。

- **暴力与血腥**：极端暴力、血液、肢解、自残、自杀，或对人身虐待的露骨描绘。

- **仇恨言论与骚扰**：基于种族、民族、宗教、性别、性取向、残疾、国籍或其他受保护特征，攻击、贬低、宣扬歧视或煽动仇恨个人或群体的内容。

- **未成年人剥削**：任何描绘、虐待或剥削未满 18 岁未成年人的内容。

- **冒充与欺骗**：在未经明确同意的情况下制作深度伪造（deepfake）、高度逼真的真实个人肖像，或旨在误导、欺诈或传播虚假信息的内容。

- **非法活动**：宣扬、协助或说明如何实施非法行为的内容，包括网络攻击、武器制造、毒品贩运，或任何违反适用法律的行为。

- **骚扰与霸凌**：骚扰、霸凌、威胁或恐吓任何个人或群体的内容。

## 2. 知识产权与品牌权利

您同意不得：

- 提交故意侵犯第三方版权、商标或商业秘密的提示词或参考材料。

- 生成旨在复制或侵犯专有角色、商标企业标识或受保护知识产权的内容。

- 以任何侵犯他人知识产权的方式使用本服务。

## 3. 合规与自动审核

为维护所有用户的安全环境，我们采用自动化内容审核技术：

- **内容审核**：提交至本服务的所有提示词与输入均会通过自动过滤系统检查。

- **实时拦截**：任何包含违反政策内容的生成请求将在生成前被自动拒绝。

- **持续监控**：我们持续进行合规监控，并可随时抽检 AI 生成输出。

## 4. 禁止的使用场景

严格禁止以下使用场景：

- 换脸、深度伪造与人脸操纵工具。

- 生成或分发不适合工作场所（NSFW）、色情露骨或带有性暗示的内容。

- 为约会或成人娱乐平台创建内容。

- 任何违反适用法律法规的使用。

## 5. 违规后果

若我们检测到您的账户违反本政策，我们有权采取纠正措施，包括但不限于：

- 立即取消待处理的生成任务。

- 发出正式警告。

- 临时暂停或永久终止您的账户，且未使用额度不予退还。

- 在适当时向执法机关报告非法活动。

## 6. 联系我们与申诉

如果您认为生成提示词被错误标记或拦截，可通过联系我们的支持团队申请申诉：

**邮箱：** carmine.joint@gmail.com

请提供您的用户 ID、时间戳以及被拦截提示词的详细信息。我们将审核您的情况并尽快回复。
`,

  zhTW: `**最後更新：** 2026年7月28日

本《可接受使用政策》（以下簡稱「本政策」）適用於您對上海贏格科技有限公司提供的大型語言模型統一 API 呼叫服務（以下簡稱「本服務」）的使用。存取或使用本服務，即表示您同意在任何時候遵守本政策。本政策透過引用併入我們的服務條款。

## 1. 禁止內容

您不得使用本服務輸入、生成、儲存或分發屬於以下類別的任何內容：

- **不適合工作場所（NSFW）、露骨或帶有性暗示的內容**：嚴禁生成或傳播不適合工作場所（NSFW）、色情露骨或帶有性暗示的內容，包括裸露、色情、性暗示姿勢、露骨性行為、情色角色扮演，或任何旨在引起性興奮的內容。

- **暴力與血腥**：極端暴力、血液、肢解、自殘、自殺，或對人身虐待的露骨描繪。

- **仇恨言論與騷擾**：基於種族、民族、宗教、性別、性取向、身心障礙、國籍或其他受保護特徵，攻擊、貶低、宣揚歧視或煽動仇恨個人或群體的內容。

- **未成年人剝削**：任何描繪、虐待或剝削未滿 18 歲未成年人的內容。

- **冒充與欺騙**：在未經明確同意的情況下製作深度偽造（deepfake）、高度逼真的真實個人肖像，或旨在誤導、欺詐或傳播虛假資訊的內容。

- **非法活動**：宣揚、協助或說明如何實施非法行為的內容，包括網路攻擊、武器製造、毒品販運，或任何違反適用法律的行為。

- **騷擾與霸凌**：騷擾、霸凌、威脅或恐嚇任何個人或群體的內容。

## 2. 智慧財產權與品牌權利

您同意不得：

- 提交故意侵犯第三方著作權、商標或營業秘密的提示詞或參考材料。

- 生成旨在複製或侵犯專有角色、商標企業識別或受保護智慧財產權的內容。

- 以任何侵犯他人智慧財產權的方式使用本服務。

## 3. 合規與自動審核

為維護所有使用者的安全環境，我們採用自動化內容審核技術：

- **內容審核**：提交至本服務的所有提示詞與輸入均會透過自動過濾系統檢查。

- **即時攔截**：任何包含違反政策內容的生成請求將在生成前被自動拒絕。

- **持續監控**：我們持續進行合規監控，並可隨時抽檢 AI 生成輸出。

## 4. 禁止的使用場景

嚴格禁止以下使用場景：

- 換臉、深度偽造與人臉操縱工具。

- 生成或分發不適合工作場所（NSFW）、色情露骨或帶有性暗示的內容。

- 為約會或成人娛樂平台建立內容。

- 任何違反適用法律法規的使用。

## 5. 違規後果

若我們偵測到您的帳戶違反本政策，我們有權採取糾正措施，包括但不限於：

- 立即取消待處理的生成任務。

- 發出正式警告。

- 暫時暫停或永久終止您的帳戶，且未使用額度不予退還。

- 在適當時向執法機關報告非法活動。

## 6. 聯絡我們與申訴

如果您認為生成提示詞被錯誤標記或攔截，可透過聯絡我們的支援團隊申請申訴：

**電子郵件：** carmine.joint@gmail.com

請提供您的使用者 ID、時間戳以及被攔截提示詞的詳細資訊。我們將審核您的情況並儘快回覆。
`,

  fr: `**Dernière mise à jour :** 28 juillet 2026

La présente Politique d'utilisation acceptable (« Politique ») régit votre utilisation du service d'appel d'API unifié pour grands modèles de langage, fourni par Shanghai WinGrid Technology Co., Ltd. En accédant au Service ou en l'utilisant, vous acceptez de respecter cette Politique à tout moment. Cette Politique est incorporée par référence dans nos Conditions d'utilisation.

## 1. Contenus interdits

Vous ne devez pas utiliser le Service pour saisir, générer, stocker ou diffuser tout contenu relevant des catégories suivantes :

- **Contenu non adapté au lieu de travail (NSFW), explicite ou sexuellement suggestif** : tout contenu non adapté au lieu de travail (NSFW), sexuellement explicite ou sexuellement suggestif — y compris la nudité, la pornographie, les poses sexuellement suggestives, les actes sexuels graphiques, les jeux de rôle érotiques, ou tout contenu destiné à susciter une excitation sexuelle — est strictement interdit.

- **Violence et gore** : violence extrême, sang, mutilation, automutilation, suicide, ou représentations graphiques de maltraitance physique.

- **Discours haineux et harcèlement** : contenu qui attaque, dénigre, promeut la discrimination ou incite à la haine contre des personnes ou des groupes sur la base de la race, de l'ethnicité, de la religion, du genre, de l'orientation sexuelle, du handicap, de la nationalité ou de toute autre caractéristique protégée.

- **Exploitation de mineurs** : tout contenu représentant, abusant ou exploitant des mineurs de moins de 18 ans.

- **Usurpation d'identité et tromperie** : création de deepfakes, de ressemblances très réalistes de personnes réelles sans leur consentement explicite, ou de contenu conçu pour tromper, frauder ou diffuser de la désinformation.

- **Activités illégales** : contenu promouvant, facilitant ou expliquant comment commettre des actes illégaux, y compris les cyberattaques, la fabrication d'armes, le trafic de drogue, ou toute violation des lois applicables.

- **Harcèlement et intimidation** : contenu qui harcèle, intimide, menace ou intimide toute personne ou tout groupe.

## 2. Propriété intellectuelle et droits de marque

Vous acceptez de ne pas :

- Soumettre des invites ou des documents de référence qui violent intentionnellement des droits d'auteur, des marques ou des secrets commerciaux de tiers.

- Générer du contenu conçu pour copier ou porter atteinte à des personnages propriétaires, des logos d'entreprise protégés ou une propriété intellectuelle protégée.

- Utiliser le Service d'une manière qui porte atteinte aux droits de propriété intellectuelle d'autrui.

## 3. Conformité et modération automatisée

Pour maintenir un environnement sûr pour tous les utilisateurs, nous utilisons des technologies de modération de contenu automatisées :

- **Modération de contenu** : toutes les invites et entrées soumises au Service sont inspectées via des systèmes de filtrage automatisés.

- **Blocage en temps réel** : toute demande de génération contenant un contenu contraire à la politique sera automatiquement refusée avant la génération.

- **Surveillance** : nous effectuons une surveillance continue de la conformité et pouvons tester les sorties générées par l'IA à tout moment.

## 4. Cas d'utilisation interdits

Les cas d'utilisation suivants sont strictement interdits :

- Outils de face-swap, deepfake et de manipulation faciale.

- Génération ou diffusion de contenu non adapté au lieu de travail (NSFW), sexuellement explicite ou sexuellement suggestif.

- Création de contenu pour des plateformes de rencontres ou de divertissement pour adultes.

- Toute utilisation contraire aux lois ou réglementations applicables.

## 5. Conséquences d'une violation

Si nous détectons que votre compte a violé cette Politique, nous nous réservons le droit de prendre des mesures correctives, notamment :

- Annulation immédiate de la tâche de génération en cours.

- Émission d'un avertissement formel.

- Suspension temporaire ou résiliation permanente de votre compte sans remboursement des crédits non utilisés.

- Signalement des activités illégales aux autorités compétentes le cas échéant.

## 6. Nous contacter et recours

Si vous estimez que votre invite de génération a été incorrectement signalée ou bloquée, vous pouvez demander un recours en contactant notre équipe d'assistance :

**E-mail :** carmine.joint@gmail.com

Veuillez indiquer votre identifiant utilisateur, l'horodatage et les détails de l'invite bloquée. Nous examinerons votre dossier et répondrons dans les meilleurs délais.
`,

  ja: `**最終更新日：** 2026年7月28日

本利用規約（「本ポリシー」）は、Shanghai WinGrid Technology Co., Ltd.（上海赢格科技有限公司）が提供する大規模言語モデル向け統合 API 呼び出しサービス（「本サービス」）のご利用に適用されます。本サービスにアクセスまたは利用することにより、お客様は常に本ポリシーを遵守することに同意したものとみなされます。本ポリシーは、参照により利用規約に組み込まれます。

## 1. 禁止コンテンツ

お客様は、以下のカテゴリに該当するコンテンツを本サービスに入力、生成、保存、または配布してはなりません。

- **職場に不適切な（NSFW）、露骨、または性的示唆のあるコンテンツ**：職場に不適切（NSFW）、性的に露骨、または性的示唆のあるコンテンツ — 裸体、ポルノ、性的示唆のあるポーズ、露骨な性行為、エロティックなロールプレイ、または性的興奮を目的とするあらゆるコンテンツを含む — の生成・配布は厳禁です。

- **暴力および残虐表現**：極度の暴力、流血、切断、自傷、自殺、または身体的虐待の露骨な描写。

- **ヘイトスピーチおよびハラスメント**：人種、民族、宗教、性別、性的指向、障害、国籍、その他保護される特性に基づき、個人または集団を攻撃、軽蔑、差別を助長、または憎悪を扇動するコンテンツ。

- **未成年者の搾取**：18歳未満の未成年者を描写、虐待、または搾取するあらゆるコンテンツ。

- **なりすましおよび欺瞞**：明示的な同意なく実在の人物のディープフェイクや極めてリアルな肖像を作成すること、または誤導、詐欺、偽情報の拡散を目的とするコンテンツ。

- **違法行為**：サイバー攻撃、武器製造、麻薬密売を含む違法行為の促進・助長・実行方法の説明、または適用法令への違反。

- **ハラスメントおよびいじめ**：個人または集団を괴롭め、いじめ、脅迫、または威圧するコンテンツ。

## 2. 知的財産およびブランド権

お客様は以下を行わないことに同意します。

- 第三者の著作権、商標、または営業秘密を故意に侵害するプロンプトや参考資料の提出。

- 独自キャラクター、商標登録された企業ロゴ、または保護された知的財産をコピーまたは侵害するよう設計されたコンテンツの生成。

- 他者の知的財産権を侵害する形での本サービスの利用。

## 3. コンプライアンスと自動モデレーション

すべてのユーザーにとって安全な環境を維持するため、当社は自動コンテンツモデレーション技術を使用します。

- **コンテンツモデレーション**：本サービスに提出されたすべてのプロンプトおよび入力は、自動フィルタリングシステムにより検査されます。

- **リアルタイムブロック**：ポリシー違反コンテンツを含む生成リクエストは、生成前に自動的に拒否されます。

- **監視**：当社は継続的なコンプライアンス監視を行い、いつでも AI 生成出力をテストできます。

## 4. 禁止される利用ケース

以下の利用は厳禁です。

- 顔交換、ディープフェイク、顔操作ツール。

- 職場に不適切な（NSFW）、性的に露骨、または性的示唆のあるコンテンツの生成または配布。

- 出会い系またはアダルトエンターテインメント向けプラットフォーム用コンテンツの作成。

- 適用法令に違反するあらゆる利用。

## 5. 違反の結果

お客様のアカウントが本ポリシーに違反したことが検出された場合、当社は以下を含む是正措置を取る権利を留保します。

- 保留中の生成タスクの即時キャンセル。

- 正式な警告の発行。

- 未使用クレジットの返金なしでのアカウントの一時停止または永久停止。

- 適切な場合、違法行為の法執行機関への報告。

## 6. お問い合わせと異議申立

生成プロンプトが誤ってフラグ付けまたはブロックされたと思われる場合は、サポートチームに連絡して異議を申し立てることができます。

**メール：** carmine.joint@gmail.com

ユーザー ID、タイムスタンプ、ブロックされたプロンプトの詳細を含めてください。内容を確認し、できるだけ早く回答します。
`,

  ru: `**Последнее обновление:** 28 июля 2026 г.

Настоящая Политика допустимого использования («Политика») регулирует использование вами Единого API-сервиса вызова больших языковых моделей, предоставляемого Shanghai WinGrid Technology Co., Ltd. Получая доступ к Сервису или используя его, вы соглашаетесь всегда соблюдать настоящую Политику. Настоящая Политика включена в Условия обслуживания посредством ссылки.

## 1. Запрещённый контент

Вы не должны использовать Сервис для ввода, генерации, хранения или распространения контента, относящегося к следующим категориям:

- **Контент, непригодный для рабочего места (NSFW), откровенный или сексуально вызывающий**: контент, непригодный для рабочего места (NSFW), сексуально откровенный или сексуально вызывающий — включая наготу, порнографию, сексуально вызывающие позы, графические сексуальные акты, эротическую ролевую игру или любой контент, предназначенный для сексуального возбуждения — строго запрещён.

- **Насилие и жестокость**: крайнее насилие, кровь, увечья, членовредительство, самоубийство или графические изображения физического насилия.

- **Разжигание ненависти и преследование**: контент, который атакует, унижает, пропагандирует дискриминацию или разжигает ненависть к лицам или группам по признаку расы, этнической принадлежности, религии, пола, сексуальной ориентации, инвалидности, национальности или иной защищаемой характеристики.

- **Эксплуатация несовершеннолетних**: любой контент, изображающий, насилующий или эксплуатирующий лиц младше 18 лет.

- **Выдача себя за другое лицо и обман**: создание дипфейков, крайне реалистичных изображений реальных лиц без их явного согласия, или контента, предназначенного для введения в заблуждение, мошенничества или распространения дезинформации.

- **Незаконная деятельность**: контент, пропагандирующий, способствующий или объясняющий совершение незаконных действий, включая кибератаки, изготовление оружия, незаконный оборот наркотиков или любое нарушение применимого законодательства.

- **Преследование и травля**: контент, который преследует, травит, угрожает или запугивает любое лицо или группу.

## 2. Интеллектуальная собственность и права на бренд

Вы соглашаетесь не:

- Отправлять запросы или справочные материалы, намеренно нарушающие авторские права, товарные знаки или коммерческую тайну третьих лиц.

- Генерировать контент, предназначенный для копирования или нарушения прав на проприетарных персонажей, товарные знаки корпоративных логотипов или охраняемую интеллектуальную собственность.

- Использовать Сервис любым способом, нарушающим права интеллектуальной собственности других лиц.

## 3. Соответствие требованиям и автоматическая модерация

Для поддержания безопасной среды для всех пользователей мы используем технологии автоматической модерации контента:

- **Модерация контента**: все запросы и входные данные, отправляемые в Сервис, проверяются автоматическими системами фильтрации.

- **Блокировка в реальном времени**: любой запрос на генерацию, содержащий контент, нарушающий политику, будет автоматически отклонён до генерации.

- **Мониторинг**: мы проводим постоянный мониторинг соответствия и можем в любое время проверять результаты генерации ИИ.

## 4. Запрещённые сценарии использования

Строго запрещены следующие сценарии использования:

- Инструменты замены лиц, дипфейки и манипуляции с лицами.

- Генерация или распространение контента, непригодного для рабочего места (NSFW), сексуально откровенного или сексуально вызывающего.

- Создание контента для сайтов знакомств или платформ развлечений для взрослых.

- Любое использование, нарушающее применимые законы или нормативные акты.

## 5. Последствия нарушения

Если мы обнаружим, что ваш аккаунт нарушил настоящую Политику, мы оставляем за собой право принять корректирующие меры, включая, но не ограничиваясь:

- Немедленную отмену ожидающей задачи генерации.

- Вынесение официального предупреждения.

- Временную приостановку или постоянное прекращение действия вашего аккаунта без возврата неиспользованных кредитов.

- Сообщение о незаконной деятельности правоохранительным органам при необходимости.

## 6. Связь с нами и апелляции

Если вы считаете, что ваш запрос на генерацию был ошибочно отмечен или заблокирован, вы можете подать апелляцию, связавшись с нашей службой поддержки:

**Электронная почта:** carmine.joint@gmail.com

Укажите свой идентификатор пользователя, временную метку и сведения о заблокированном запросе. Мы рассмотрим ваш случай и ответим как можно скорее.
`,

  vi: `**Cập nhật lần cuối:** 28 tháng 7 năm 2026

Chính sách sử dụng chấp nhận được này (“Chính sách”) điều chỉnh việc bạn sử dụng Dịch vụ gọi API thống nhất cho các mô hình ngôn ngữ lớn, do Shanghai WinGrid Technology Co., Ltd. cung cấp. Bằng cách truy cập hoặc sử dụng Dịch vụ, bạn đồng ý tuân thủ Chính sách này mọi lúc. Chính sách này được đưa vào Điều khoản dịch vụ của chúng tôi bằng cách tham chiếu.

## 1. Nội dung bị cấm

Bạn không được sử dụng Dịch vụ để nhập, tạo, lưu trữ hoặc phân phối bất kỳ nội dung nào thuộc các danh mục sau:

- **Nội dung không phù hợp nơi làm việc (NSFW), lộ liễu hoặc gợi dục**: nội dung không phù hợp nơi làm việc (NSFW), khiêu dâm rõ ràng hoặc mang tính gợi dục — bao gồm khỏa thân, khiêu dâm, tư thế gợi dục, hành vi tình dục lộ liễu, nhập vai khiêu dâm, hoặc bất kỳ nội dung nào nhằm khêu gợi tình dục — đều bị nghiêm cấm.

- **Bạo lực và máu me**: bạo lực cực đoan, máu, cắt xẻ, tự hại, tự sát, hoặc mô tả lộ liễu về lạm dụng thể chất.

- **Phát ngôn thù địch và quấy rối**: nội dung tấn công, hạ thấp, thúc đẩy phân biệt đối xử hoặc kích động thù hận đối với cá nhân hoặc nhóm dựa trên chủng tộc, dân tộc, tôn giáo, giới tính, khuynh hướng tình dục, khuyết tật, quốc tịch hoặc bất kỳ đặc điểm được bảo vệ nào khác.

- **Bóc lột trẻ vị thành niên**: bất kỳ nội dung nào mô tả, lạm dụng hoặc bóc lột trẻ em dưới 18 tuổi.

- **Mạo danh và lừa dối**: tạo deepfake, hình ảnh giống thật cao của cá nhân thực mà không có sự đồng ý rõ ràng của họ, hoặc nội dung nhằm gây hiểu nhầm, gian lận hoặc lan truyền thông tin sai lệch.

- **Hoạt động bất hợp pháp**: nội dung thúc đẩy, hỗ trợ hoặc hướng dẫn cách thực hiện hành vi bất hợp pháp, bao gồm tấn công mạng, chế tạo vũ khí, buôn bán ma túy, hoặc bất kỳ hành vi nào vi phạm luật hiện hành.

- **Quấy rối và bắt nạt**: nội dung quấy rối, bắt nạt, đe dọa hoặc uy hiếp bất kỳ cá nhân hoặc nhóm nào.

## 2. Sở hữu trí tuệ và quyền thương hiệu

Bạn đồng ý không:

- Gửi prompt hoặc tài liệu tham chiếu cố ý vi phạm bản quyền, nhãn hiệu hoặc bí mật thương mại của bên thứ ba.

- Tạo nội dung nhằm sao chép hoặc xâm phạm nhân vật độc quyền, logo doanh nghiệp đã đăng ký nhãn hiệu, hoặc sở hữu trí tuệ được bảo vệ.

- Sử dụng Dịch vụ theo bất kỳ cách nào xâm phạm quyền sở hữu trí tuệ của người khác.

## 3. Tuân thủ và kiểm duyệt tự động

Để duy trì môi trường an toàn cho tất cả người dùng, chúng tôi sử dụng công nghệ kiểm duyệt nội dung tự động:

- **Kiểm duyệt nội dung**: mọi prompt và đầu vào gửi tới Dịch vụ đều được kiểm tra qua hệ thống lọc tự động.

- **Chặn theo thời gian thực**: mọi yêu cầu tạo nội dung chứa nội dung vi phạm chính sách sẽ bị từ chối tự động trước khi tạo.

- **Giám sát**: chúng tôi tiến hành giám sát tuân thủ liên tục và có thể kiểm tra đầu ra do AI tạo ra bất cứ lúc nào.

## 4. Các trường hợp sử dụng bị cấm

Các trường hợp sử dụng sau bị nghiêm cấm:

- Công cụ đổi mặt, deepfake và thao tác khuôn mặt.

- Tạo hoặc phân phối nội dung không phù hợp nơi làm việc (NSFW), khiêu dâm rõ ràng hoặc mang tính gợi dục.

- Tạo nội dung cho nền tảng hẹn hò hoặc giải trí người lớn.

- Bất kỳ việc sử dụng nào vi phạm luật hoặc quy định hiện hành.

## 5. Hậu quả của vi phạm

Nếu chúng tôi phát hiện tài khoản của bạn đã vi phạm Chính sách này, chúng tôi có quyền thực hiện biện pháp khắc phục, bao gồm nhưng không giới hạn ở:

- Hủy ngay nhiệm vụ tạo đang chờ.

- Phát hành cảnh báo chính thức.

- Tạm ngưng hoặc chấm dứt vĩnh viễn tài khoản của bạn mà không hoàn lại tín dụng chưa sử dụng.

- Báo cáo hoạt động bất hợp pháp cho cơ quan thực thi pháp luật khi thích hợp.

## 6. Liên hệ và kháng cáo

Nếu bạn tin rằng prompt tạo nội dung của mình bị gắn cờ hoặc chặn nhầm, bạn có thể yêu cầu kháng cáo bằng cách liên hệ đội ngũ hỗ trợ của chúng tôi:

**Email:** carmine.joint@gmail.com

Vui lòng cung cấp ID người dùng, dấu thời gian và chi tiết về prompt bị chặn. Chúng tôi sẽ xem xét trường hợp của bạn và phản hồi sớm nhất có thể.
`,
} as const

export function getAcceptableUsePolicyContent(language: string): string {
  return resolveLocalizedContent(JSON.stringify(AUP_BY_LANGUAGE), language)
}
