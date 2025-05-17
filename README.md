# Shrooms Support Bot 🍄

AI Support Bot для проекта "Shrooms" с грибной тематикой, построенный на базе Claude API с поддержкой RAG.

## 🚀 Быстрый старт

### Предварительные требования

1. **Node.js 18+** и **npm**
2. **MongoDB** (локально или в облаке)
3. **API ключ Anthropic Claude** (обязательно)
4. **Qdrant** (опционально, для RAG)
5. **OpenAI API ключ** (опционально, для эмбеддингов)

### Установка

1. **Клонируйте репозиторий:**
```bash
git clone https://github.com/g1orgi89/shrooms-support-bot.git
cd shrooms-support-bot
```

2. **Установите зависимости:**
```bash
npm install
```

3. **Настройте переменные окружения:**
```bash
cp .env.example .env
```

Отредактируйте `.env` файл и добавьте как минимум:
```env
MONGODB_URI=mongodb://localhost:27017/shrooms-support
ANTHROPIC_API_KEY=ваш_ключ_claude_api
```

4. **Убедитесь, что MongoDB запущен**

5. **Запустите бота:**
```bash
npm start
```

## 🧠 RAG (Retrieval-Augmented Generation)

### Что такое RAG?

RAG (Retrieval-Augmented Generation) - это технология, которая улучшает генерацию ответов AI, дополняя её информацией из внешней базы знаний. Это позволяет боту давать более точные и контекстно-релевантные ответы на вопросы пользователей.

### Настройка RAG

1. **Установите Qdrant:**
```bash
docker run -d -p 6333:6333 -v $(pwd)/qdrant_data:/qdrant/storage qdrant/qdrant
```

2. **Настройте переменные окружения для RAG:**
```env
ENABLE_RAG=true
OPENAI_API_KEY=ваш_ключ_openai
VECTOR_DB_URL=http://localhost:6333
VECTOR_COLLECTION_NAME=shrooms_knowledge
EMBEDDING_MODEL=text-embedding-ada-002
```

3. **Подготовьте базу знаний:**
   - Создайте Markdown (.md) или текстовые (.txt) файлы в директории `knowledge/`
   - Рекомендуемая структура:
     ```
     knowledge/
     ├── general/           # Общая информация о проекте
     ├── tokenomics/        # Информация о токенах
     ├── user-guide/        # Руководство пользователя
     └── troubleshooting/   # Решение проблем
     ```
   - Для многоязычной поддержки, добавьте суффикс к имени файла:
     - Английский: `file.md` или `file-en.md`
     - Русский: `file-ru.md`
     - Испанский: `file-es.md`

4. **Загрузите базу знаний в Qdrant:**
```bash
npm run load-kb
```

Дополнительные опции:
```bash
# Очистка существующей базы перед загрузкой
npm run load-kb -- --clear

# Тестирование поиска после загрузки
npm run load-kb -- --test

# Дополнительная информация
npm run load-kb -- --verbose

# Указание другой директории
npm run load-kb -- --dir ./custom-knowledge
```

### Тестирование RAG

После настройки RAG, вы можете протестировать его с помощью API или веб-интерфейса:

```bash
curl -X POST http://localhost:3000/api/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "Как подключить кошелек?", "userId": "test-user"}'
```

В ответе будет информация из базы знаний, а затем ответ от бота. Вы также можете отключить RAG для определенного запроса:

```bash
curl -X POST http://localhost:3000/api/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "Как подключить кошелек?", "userId": "test-user", "useRag": false}'
```

## 🔧 Конфигурация

### Обязательные настройки

- `MONGODB_URI` - URI подключения к MongoDB
- `ANTHROPIC_API_KEY` - API ключ Claude (получить на [console.anthropic.com](https://console.anthropic.com))

### Дополнительные настройки

- `OPENAI_API_KEY` - для эмбеддингов и RAG
- `VECTOR_DB_URL` - URL Qdrant для векторного поиска (по умолчанию `http://localhost:6333`)
- `ENABLE_RAG` - включить/выключить RAG функциональность (по умолчанию `true`)

## 📋 Команды

```bash
# Разработка
npm run dev              # Запуск в режиме разработки с автоперезагрузкой
npm run dev:debug        # Запуск с отладкой

# Тестирование
npm test                 # Запуск всех тестов
npm run test:db          # Тест подключения к MongoDB
npm run test:claude      # Тест Claude API

# Данные
npm run load-kb          # Загрузка базы знаний в векторную БД

# Продакшн
npm run start:prod       # Запуск в production режиме
```

## 🧪 Тестирование

### 1. Тест MongoDB соединения
```bash
npm run test:db
```

### 2. Тест веб-интерфейса
Запустите сервер и откройте в браузере:
- http://localhost:3000/test-chat.html

### 3. Тест API
```bash
curl -X POST http://localhost:3000/api/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "Привет!", "userId": "test-user"}'
```

## 🏗️ Архитектура

```
shrooms-support-bot/
├── server/              # Серверная часть
│   ├── api/            # REST API эндпоинты
│   ├── services/       # Бизнес-логика
│   ├── models/         # Модели данных
│   ├── middleware/     # Express middleware
│   ├── utils/          # Утилиты
│   └── types/          # TypeScript типы (JSDoc)
├── client/             # Клиентская часть
├── tests/              # Тесты
└── scripts/            # Скрипты для обслуживания
```

## 🔌 API Endpoints

### Chat API
- `POST /api/chat` - Отправка сообщения
- `GET /api/chat/conversations/:userId` - Получение разговоров
- `GET /api/chat/health` - Проверка здоровья API

### Tickets API
- `GET /api/tickets` - Получение списка тикетов
- `POST /api/tickets` - Создание тикета
- `GET /api/tickets/:id` - Получение тикета

## 📊 Мониторинг

- **Health Check**: `GET /api/health`
- **Логи**: Доступны в папке `logs/`
- **Метрики**: Встроенный дашборд (если включен)

## 🔍 Устранение проблем

### Ошибки подключения к MongoDB

1. Убедитесь, что MongoDB запущен:
```bash
# MongoDB Community
sudo systemctl start mongod

# MongoDB в Docker
docker run -d -p 27017:27017 mongo:latest
```

2. Проверьте URI подключения в `.env`

### Ошибки Claude API

1. Проверьте корректность API ключа
2. Убедитесь, что у вас есть кредиты в аккаунте Anthropic
3. Проверьте лимиты запросов

### RAG не работает

1. Убедитесь, что Qdrant запущен:
```bash
docker run -p 6333:6333 qdrant/qdrant
```

2. Проверьте переменные
  - `ENABLE_RAG=true`
  - `OPENAI_API_KEY` должен быть правильным
  - `VECTOR_DB_URL` должен указывать на работающий Qdrant

3. Проверьте логи на наличие ошибок инициализации
```bash
tail -f logs/error.log
```

4. Перезагрузите базу знаний
```bash
npm run load-kb -- --clear --test
```

## 🔒 Безопасность

- API ключи хранятся в `.env` файле
- Логи не содержат чувствительной информации
- Rate limiting настроен по умолчанию

## 📝 Логирование

Логи сохраняются в папке `logs/`:
- `combined.log` - все логи
- `error.log` - только ошибки
- `exceptions.log` - необработанные исключения

## 🤝 Участие в разработке

1. Форкните проект
2. Создайте ветку для фичи (`git checkout -b feature/amazing-feature`)
3. Закоммитьте изменения (`git commit -m 'Add amazing feature'`)
4. Запушьте в ветку (`git push origin feature/amazing-feature`)
5. Откройте Pull Request

## 📄 Лицензия

MIT License - см. файл [LICENSE](LICENSE)

## 🐛 Сообщение об ошибках

Если вы нашли ошибку, пожалуйста:
1. Проверьте [существующие issues](https://github.com/g1orgi89/shrooms-support-bot/issues)
2. Создайте новый issue с подробным описанием
3. Приложите логи из `logs/error.log`

---

**Создано с 🍄 для сообщества Shrooms**