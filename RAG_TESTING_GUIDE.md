# 🍄 Shrooms Support Bot - RAG Testing Guide

Это руководство описывает, как использовать новую систему тестирования RAG (Retrieval-Augmented Generation) в Shrooms Support Bot.

## 📊 Анализ текущего состояния

### ✅ Что уже было реализовано:
- **Vector Store Service** с Qdrant интеграцией
- **Базовый Chat API** с поддержкой RAG
- **Многоязычность** (EN, RU, ES)
- **Endpoint для тестирования RAG** (`/api/chat/test-rag`)

### 🚀 Что добавлено для полноценного тестирования RAG:

1. **Интерактивный веб-интерфейс** (`test-chat-rag.html`)
2. **Автоматизированные качественные тесты** (`tests/integration/rag-quality.test.js`)
3. **Bash-скрипт для комплексного тестирования** (`test-rag.sh`)
4. **Обновленные npm скрипты** для удобного запуска тестов

## 🎯 Новые возможности тестирования

### 1. Веб-интерфейс для тестирования RAG

Откройте `http://localhost:3000/test-chat-rag.html` для доступа к расширенному интерфейсу тестирования:

**Функции:**
- 💬 **Интерактивный чат** с индикаторами использования RAG
- 🧠 **Анализ RAG** - показывает найденные документы и их релевантность
- 📊 **Метрики производительности** - отслеживание использования RAG
- 🔄 **Сравнение режимов** - ответы с RAG и без RAG
- 🌍 **Многоязычное тестирование** - автоматические сценарии
- 🎯 **Предустановленные тесты** - кошелек, стейкинг, токеномика

### 2. Автоматизированные тесты качества

Запустите качественные тесты RAG:

```bash
# Запуск всех тестов качества RAG
npm run test:rag

# Или прямо через Node.js
node tests/integration/rag-quality.test.js
```

**Что тестируется:**
- ✅ **Поиск релевантных документов** для вопросов из базы знаний
- ❌ **Фильтрация off-topic запросов** (погода, общие крипто-вопросы)
- 🌍 **Многоязычность** - одинаковые результаты на разных языках
- 🔄 **Сравнение качества** ответов с RAG и без RAG
- ⚡ **Производительность** - время ответа с RAG

### 3. Bash-скрипт для комплексного тестирования

Сделайте скрипт исполняемым и запустите:

```bash
chmod +x test-rag.sh

# Полное тестирование RAG
./test-rag.sh all

# Или используйте npm скрипты:
npm run test:rag:all
```

**Доступные команды:**

```bash
# Базовые тесты API
./test-rag.sh basic
npm run test:rag:basic

# Тестирование многоязычности
./test-rag.sh multilingual
npm run test:rag:multilingual

# Тестирование производительности
./test-rag.sh performance
npm run test:rag:performance

# Открыть веб-интерфейс
./test-rag.sh interface
npm run test:rag:interface

# Статистика базы знаний
./test-rag.sh stats
npm run diagnose:rag
```

## 📈 Интерпретация результатов

### Метрики качества RAG:

1. **RAG Usage Rate** - процент запросов, использующих RAG
   - **Хорошо**: 60-80% для релевантных вопросов
   - **Плохо**: <30% или >95%

2. **Average Documents Found** - среднее количество найденных документов
   - **Хорошо**: 2-5 документов
   - **Плохо**: 0 или >10 документов

3. **Average Relevance Score** - средний score релевантности
   - **Хорошо**: >0.7 для вопросов из базы знаний
   - **Плохо**: <0.5

4. **Response Time** - время ответа
   - **Хорошо**: <3 секунд
   - **Приемлемо**: 3-5 секунд
   - **Плохо**: >5 секунд

### Пороги релевантности по языкам:

```javascript
const languageThresholds = {
  'ru': 0.75,  // Снижен для лучшего покрытия русских документов
  'en': 0.7,   // Стандартный порог
  'es': 0.7    // Стандартный порог
};
```

## 🔧 Диагностика проблем

### Если RAG не работает:

1. **Проверьте базу знаний:**
   ```bash
   npm run diagnose:rag
   ```

2. **Проверьте переменные окружения:**
   ```bash
   # Убедитесь, что установлены:
   OPENAI_API_KEY=your-key
   VECTOR_DB_URL=http://localhost:6333
   ENABLE_RAG=true
   ```

3. **Загрузите документы в базу знаний:**
   ```bash
   npm run load-kb
   ```

4. **Проверьте Qdrant:**
   ```bash
   curl http://localhost:6333/collections
   ```

### Если тесты падают:

1. **Убедитесь, что сервер запущен:**
   ```bash
   npm start
   ```

2. **Проверьте health endpoint:**
   ```bash
   curl http://localhost:3000/api/health
   ```

3. **Посмотрите логи:**
   ```bash
   npm run logs
   ```

## 🧪 Примеры тестовых сценариев

### Тесты для базы знаний (должны находить документы):

```javascript
// Английский
"How do I connect Xverse wallet?"
"What is SHROOMS staking?"
"How does farming work?"

// Русский  
"Как подключить кошелек Xverse?"
"Что такое стейкинг SHROOMS?"
"Как работает фарминг?"

// Испанский
"¿Cómo conectar billetera Xverse?"
```

### Off-topic тесты (НЕ должны находить документы):

```javascript
// Общие вопросы
"What's the weather today?"
"Tell me about Bitcoin price"
"How to cook pasta?"

// Русские off-topic
"Какая сегодня погода?"
"Расскажи о цене биткоина"
```

## 📝 Добавление новых тестов

### 1. Добавить тестовые сценарии:

Отредактируйте `tests/integration/rag-quality.test.js`:

```javascript
const RAG_TEST_SCENARIOS = {
  knowledgeBaseQuestions: {
    en: [
      {
        query: "Your new test question",
        expectedTopics: ["keyword1", "keyword2"],
        category: "user-guide",
        shouldFindDocs: true
      }
    ]
  }
};
```

### 2. Добавить в веб-интерфейс:

Отредактируйте `test-chat-rag.html`, добавьте новую кнопку:

```javascript
async function testYourNewScenario() {
    const queries = [
        "Your test query 1",
        "Your test query 2"
    ];
    for (const query of queries) {
        await sendMessage(query);
        await new Promise(resolve => setTimeout(resolve, 2000));
    }
}
```

### 3. Добавить в bash-скрипт:

Отредактируйте `test-rag.sh`, добавьте новую функцию:

```bash
test_your_scenario() {
    echo "🧪 Testing your scenario..."
    # Ваш код тестирования
}
```

## 🔍 Мониторинг в Production

### Рекомендуемый мониторинг:

1. **Ежедневные автоматические тесты:**
   ```bash
   # Добавьте в cron:
   0 6 * * * cd /path/to/shrooms-bot && npm run test:rag:basic
   ```

2. **Мониторинг метрик:**
   - RAG usage rate
   - Average response time
   - Document retrieval success rate
   - Language detection accuracy

3. **Алерты:**
   - RAG success rate <70%
   - Response time >5 секунд
   - Vector DB недоступен

## 🎉 Заключение

Теперь у вас есть полноценная система тестирования RAG, которая включает:

- ✅ **Визуальное тестирование** через веб-интерфейс
- ✅ **Автоматизированные тесты качества**
- ✅ **Скрипты для CI/CD**
- ✅ **Мониторинг производительности**
- ✅ **Многоязычное тестирование**
- ✅ **Сравнение режимов с/без RAG**

Это позволяет полноценно тестировать и мониторить качество RAG системы в Shrooms Support Bot! 🍄

## 🔗 Полезные ссылки

- **Веб-интерфейс**: `http://localhost:3000/test-chat-rag.html`
- **Базовый чат**: `http://localhost:3000/test-chat.html`
- **Debug чат**: `http://localhost:3000/test-chat-debug.html`
- **Health check**: `http://localhost:3000/api/health`
- **API документация**: `http://localhost:3000/api/chat/health`