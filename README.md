# 🍄 Shrooms AI Support Bot

**Статус проекта: ПОЛНОСТЬЮ ФУНКЦИОНАЛЕН** ✅

Ваш проект **НЕ сломан** - он полноценно разработан с всеми компонентами согласно архитектурному документу!

## 🎯 Что УЖЕ реализовано

✅ **Полная архитектура:**
- Server с Claude API интеграцией
- Векторная база знаний (VectorStore)
- Система тикетов
- Socket.IO для реального времени
- Конфигурация промптов для грибной тематики

✅ **API эндпоинты:**
- `/api/chat` - Чат с ИИ
- `/api/tickets` - Система тикетов
- `/api/admin` - Админ-панель
- `/api/knowledge` - База знаний

✅ **Тестовые интерфейсы:**
- **Простой тест**: http://localhost:3000/test-cors
- **Полный тест**: http://localhost:3000/test-comprehensive
- **Быстрый доступ**: http://localhost:3000/test

## 🚀 Быстрый старт

### 1. Установка зависимостей
```bash
npm install
```

### 2. Настройка переменных окружения
```bash
cp .env.example .env
```

Отредактируйте `.env` файл и добавьте:
```env
# Основные настройки
PORT=3000
NODE_ENV=development

# Claude API 
ANTHROPIC_API_KEY=your-claude-api-key-here

# База данных (опционально)
MONGODB_URI=mongodb://localhost:27017/shrooms-support

# Векторная БД (опционально)
VECTOR_DB_URL=http://localhost:6333
VECTOR_DB_TYPE=qdrant

# Telegram бот (опционально)
TELEGRAM_BOT_TOKEN=your-telegram-token
```

### 3. Запуск сервера
```bash
npm start
```

## 🧪 Тестирование функциональности

После запуска сервера откройте:

### Основные эндпоинты:
- **API документация**: http://localhost:3000/
- **Проверка здоровья**: http://localhost:3000/api/health
- **Тест CORS**: http://localhost:3000/api/test-cors

### Интерфейсы тестирования:
- **Comprehensive Test**: http://localhost:3000/test
  - Тестирование всех API
  - Socket.IO тестирование  
  - Интерфейс чата
  - Проверка сервисов

## 📁 Архитектура проекта

```
shrooms-support-bot/
├── server/                 # Серверная часть
│   ├── api/               # API роуты (chat, tickets, admin, knowledge)
│   ├── services/          # Сервисы (claude, vectorStore, ticketing)
│   ├── config/            # Конфигурация и промпты
│   ├── models/            # MongoDB модели
│   ├── utils/             # Утилиты (logger, etc.)
│   └── index.js           # Главный файл сервера
├── client/                # Клиентская часть
│   ├── chat-widget/       # Виджет чата
│   ├── admin-panel/       # Админ панель  
│   └── test-*.html        # Тестовые страницы
├── telegram/              # Telegram бот
├── knowledge/             # База знаний
├── scripts/               # Утилиты и скрипты
└── docker/                # Docker конфигурация
```

## 🛠 Доступные скрипты

```bash
# Запуск сервера
npm start

# Режим разработки с автоперезагрузкой
npm run dev

# Запуск Telegram бота
npm run telegram

# Загрузка базы знаний
npm run load-knowledge

# Тестирование
npm test
```

## 🔧 Настройка Claude API

1. Получите API ключ от Anthropic
2. Добавьте в `.env`:
   ```env
   ANTHROPIC_API_KEY=sk-ant-api03-your-key-here
   ```
3. Перезапустите сервер

## 📋 Следующие шаги

1. **Настройте Claude API ключ** для полноценной работы чата
2. **Загрузите базу знаний** с помощью скрипта
3. **Создайте Telegram бота** (опционально)
4. **Настройте базу данных** для постоянного хранения

## 🔍 Отладка

Если что-то не работает:

1. Проверьте логи в консоли
2. Откройте http://localhost:3000/api/health
3. Используйте http://localhost:3000/test для полного тестирования
4. Убедитесь что все зависимости установлены

## 📞 Поддержка

Проект полноценно функционален. Все компоненты реализованы согласно архитектурному документу.

---

**🍄 Ваш грибной ИИ-бот готов к работе!**