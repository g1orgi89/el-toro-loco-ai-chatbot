# Инструкции по внедрению улучшений

## Обзор

Данное руководство содержит пошаговые инструкции по внедрению улучшений в Shrooms Support Bot на основе результатов тестирования.

## 1. Обновление системных промптов

### Замена файла промптов

```bash
# Создать резервную копию текущих промптов
cp server/config/prompts.js server/config/prompts-backup.js

# Заменить на улучшенную версию
cp server/config/prompts-fixed.js server/config/prompts.js
```

### Изменения в prompts.js:
- ✅ Унифицированное имя бота: **Sporus**
- ✅ Стандартизированные приветствия для всех языков
- ✅ Улучшенная логика создания тикетов
- ✅ Диагностические вопросы для типичных проблем
- ✅ Быстрые решения для самостоятельного устранения проблем

## 2. Интеграция сервиса диагностики

### Добавление нового сервиса

1. Сервис диагностики уже создан в `server/services/diagnostics.js`
2. Обновить основной ChatService для использования диагностики:

```javascript
// server/services/chatService.js
const diagnosticsService = require('./diagnostics');

// Заменить логику обработки сообщений на улучшенную версию
// Можно скопировать из server/services/chatService-improved.js
```

### Инструкции по интеграции:

1. **Сохранить текущую версию**:
   ```bash
   cp server/services/chatService.js server/services/chatService-original.js
   ```

2. **Обновить chatService.js**:
   - Добавить импорт `diagnosticsService`
   - Интегрировать диагностику в метод `processMessage`
   - Добавить логику предварительных решений

3. **Примеры изменений**:
   ```javascript
   // В начало файла добавить
   const diagnosticsService = require('./diagnostics');
   
   // В методе processMessage добавить после определения языка
   const diagnosis = await diagnosticsService.diagnose(message, language);
   
   // Проверить, предоставляет ли диагностика решения
   if (diagnosis.problemType && diagnosis.solutions.length > 0 && !diagnosis.needsTicket) {
     return this.handleDiagnosticResponse(diagnosis, userId, context, language);
   }
   ```

## 3. Обновление Claude Service

### Использование исправленных промптов

```javascript
// server/services/claude.js
// Обновить импорт промптов
const { SYSTEM_PROMPTS, BOT_NAME } = require('../config/prompts'); // Теперь это prompts-fixed.js

// Обновить системные промпты в конструкторе
constructor() {
  this.systemPrompt = SYSTEM_PROMPTS.basic;
  this.ragPrompt = SYSTEM_PROMPTS.rag;
  // ...
}
```

## 4. Тестирование изменений

### Локальное тестирование

1. **Запустить сервер**:
   ```bash
   npm run dev
   ```

2. **Открыть тестовую страницу чата**:
   ```
   http://localhost:3000/test-chat.html
   ```

3. **Протестировать основные сценарии**:
   - Приветствие (короткие сообщения): "hi", "?", ""
   - Обычные вопросы: "What is Shrooms?", "How does staking work?"
   - Проблемы с диагностикой: "wallet connection failed", "transaction stuck"
   - Многоязычность: протестировать на EN, RU, ES

### Ожидаемые результаты после обновления

1. **Консистентное имя**: Все ответы используют имя "Sporus"
2. **Диагностика перед тикетами**: Для проблем предлагаются решения
3. **Улучшенные приветствия**: Единообразные шаблоны для всех языков
4. **Быстрые решения**: Пользователи получают советы до создания тикетов

## 5. Мониторинг результатов

### Метрики для отслеживания

1. **Консистентность имени бота**: 100% ответов с именем "Sporus"
2. **Эффективность диагностики**: % проблем, решенных без тикетов
3. **Удовлетворенность пользователей**: Обратная связь по качеству ответов
4. **Время ответа**: Должно остаться < 2 секунд

### Логирование

```javascript
// Добавить в logger для отслеживания улучшений
logger.info('Diagnostic solution provided', { 
  problemType: diagnosis.problemType,
  solutionsCount: diagnosis.solutions.length,
  ticketAvoided: !diagnosis.needsTicket
});
```

## 6. Дополнительные улучшения

### 6.1 Контекстная память разговоров

Новый ChatService уже включает:
- Хранение истории разговоров в памяти
- Контекст последних 5 сообщений  
- Автоматическая очистка старых разговоров (24 часа)

### 6.2 Расширенная аналитика

Добавить сервис аналитики:

```javascript
// server/services/analytics.js
class AnalyticsService {
  async logInteraction(data) {
    // Логирование взаимодействий
  }
  
  async getLanguageStats() {
    // Статистика по языкам
  }
  
  async getProblemTypeStats() {
    // Статистика по типам проблем
  }
}
```

### 6.3 A/B тестирование ответов

```javascript
// server/utils/abTests.js
class ABTestService {
  getResponseVariant(userId, testName) {
    // Логика A/B тестирования
  }
}
```

## 7. План поэтапного развертывания

### Фаза 1: Базовые исправления (1-2 дня)
- [x] Исправление имени бота
- [x] Обновление промптов
- [x] Базовая диагностика

### Фаза 2: Улучшенная диагностика (3-5 дней)
- [x] Интеграция диагностического сервиса
- [x] Быстрые решения для типичных проблем
- [x] Предварительная помощь до создания тикетов

### Фаза 3: Контекстная память (5-7 дней)
- [x] Сохранение контекста разговоров
- [x] Ссылки на созданные тикеты
- [x] Персонализированные ответы

### Фаза 4: Аналитика и оптимизация (7-10 дней)
- [ ] Система сбора метрик
- [ ] Дашборд аналитики
- [ ] A/B тестирование

## 8. Критерии успеха

### Количественные метрики
- ⭐ **Консистентность**: 100% ответов с именем "Sporus"
- ⭐ **Сокращение тикетов**: 30% проблем решаются без тикетов
- ⭐ **Время ответа**: < 1.5 секунды в среднем
- ⭐ **Многоязычность**: корректные ответы на 3 языках

### Качественные показатели
- ⭐ **Персональность**: Стабильный характер "грибного ИИ"
- ⭐ **Полезность**: Практические советы для решения проблем
- ⭐ **Профессионализм**: Баланс между мемностью и качеством поддержки

## 9. Откат изменений (Rollback Plan)

### В случае проблем:

1. **Быстрый откат промптов**:
   ```bash
   cp server/config/prompts-backup.js server/config/prompts.js
   npm restart
   ```

2. **Откат ChatService**:
   ```bash
   cp server/services/chatService-original.js server/services/chatService.js
   npm restart
   ```

3. **Мониторинг ошибок**:
   - Проверить логи сервера
   - Мониторить время ответа
   - Отслеживать жалобы пользователей

## 10. Поддержка и обновления

### Регулярное обслуживание

1. **Еженедельно**:
   - Анализ логов на ошибки
   - Проверка метрик производительности
   - Обновление базы знаний при необходимости

2. **Ежемесячно**:
   - Анализ обратной связи пользователей
   - Оптимизация диагностических паттернов
   - A/B тестирование новых функций

3. **Постоянно**:
   - Мониторинг консистентности ответов
   - Отслеживание эффективности диагностики
   - Сбор данных для дальнейших улучшений

## Заключение

Внедрение этих улучшений значительно повысит качество работы Shrooms Support Bot:

- **Пользователи получат более консистентный опыт** с единым персонажем Sporus
- **Многие проблемы будут решаться быстрее** благодаря диагностике и быстрым решениям  
- **Снизится нагрузка на службу поддержки** за счет автоматической помощи
- **Улучшится общее впечатление** от взаимодействия с ботом

Следуйте плану поэтапно, тестируйте каждое изменение и мониторьте результаты для достижения оптимального качества поддержки пользователей.
