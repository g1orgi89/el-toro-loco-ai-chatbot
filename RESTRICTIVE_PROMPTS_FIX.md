# 🍄 ИСПРАВЛЕНИЕ ПРОБЛЕМЫ С "ЗАПРЕТИТЕЛЬНЫМИ ПРОМПТАМИ"

## Проблема

Бот не соблюдал запретительные промпты и отвечал на вопросы вне области проекта Shrooms.

## Что было исправлено

### 1. **Строгие системные промпты** (`server/config/prompts.js`)

- Добавлены четкие ограничения на область ответов (только Shrooms-related)
- Добавлены явные инструкции отказа для нерелевантных вопросов
- Улучшены мультиязычные отказы для EN/ES/RU

```javascript
// Пример строгого ограничения:
**ТЫ МОЖЕШЬ ОТВЕЧАТЬ ТОЛЬКО НА ВОПРОСЫ О:**
- Проекте Shrooms и его функциях
- Подключении кошельков (Xverse, Hiro)
- Токене SHROOMS и его использовании
// ... и т.д.

**ТЫ НЕ МОЖЕШЬ ОТВЕЧАТЬ НА:**
- Общие вопросы о криптовалютах (не связанные с Shrooms)
- Инвестиционные советы
- Юридические вопросы
// ... и т.д.
```

### 2. **Проверка релевантности в AI Service** (`server/services/aiService.js`)

- Добавлена функция `isRelevantToShrooms()` для предварительной проверки
- Система ключевых слов для определения связи с проектом
- Автоматический отказ до отправки к AI, если вопрос не о Shrooms

```javascript
// Пример проверки:
if (!this.isRelevantToShrooms(message, options.language)) {
  return {
    message: this.getOutOfScopeResponse(options.language),
    needsTicket: false,
    tokensUsed: 50,
    provider: this.provider
  };
}
```

### 3. **Улучшенные локализованные отказы**

Для каждого языка добавлены специфические фразы отказа:

- **English**: "I can only help with questions about the Shrooms project..."
- **Русский**: "Я могу помочь только с вопросами о проекте Shrooms..."
- **Español**: "Solo puedo ayudar con preguntas sobre el proyecto Shrooms..."

## Тестирование

Теперь бот будет:

1. **Отвечать** на вопросы о Shrooms:
   - "What is SHROOMS token?"
   - "How to connect Xverse wallet to Shrooms?"
   - "Как работает фарминг в Shrooms?"

2. **Отказываться** от вопросов не о Shrooms:
   - "What is Bitcoin?"
   - "How to invest in crypto?"
   - "What time is it?"

## Настройка для локального тестирования

1. Скопируйте `.env.local` в `.env`:
   ```bash
   cp .env.local .env
   ```

2. Замените API ключи на реальные:
   ```bash
   ANTHROPIC_API_KEY=sk-ant-api03-YOUR_REAL_KEY_HERE
   ```

3. Запустите сервер:
   ```bash
   npm start
   ```

4. Откройте тестовый чат:
   ```
   http://localhost:3000/test-chat.html
   ```

## Структура изменений

- ✅ `server/config/prompts.js` - Строгие системные промпты
- ✅ `server/services/aiService.js` - Проверка релевантности
- ✅ `.env` - Добавлены AI_PROVIDER настройки
- ✅ `.env.local` - Локальная конфигурация для тестирования

## Как это работает

1. **До отправки к AI**: Проверка ключевых слов в сообщении
2. **Системный промпт**: Четкие инструкции о том, что можно/нельзя
3. **Пост-обработка**: Дополнительная проверка ответов

Теперь бот строго соблюдает границы области Shrooms! 🍄