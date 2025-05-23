# Shrooms Support Bot - RAG Testing

## 🚀 Быстрый запуск тестирования

Проверьте, что файл создан правильно и исправьте все проблемы с доступностью:

### 1. Открыть веб-интерфейс
```
http://localhost:3000/test-chat-rag.html
```

**Исправленные проблемы:**
- ✅ Добавлен `lang="ru"` атрибут
- ✅ Добавлен `<title>` элемент
- ✅ Добавлен viewport meta-тег
- ✅ Все form elements имеют `id` и `name`

### 2. Быстрый тест через командную строку
```bash
npm run test:rag
```

### 3. Полные интеграционные тесты
```bash
npm run test:rag:quality
```

## 🧪 Что было добавлено

### 1. Веб-интерфейс тестирования
- **Файл**: `client/test-chat-rag.html`
- **Возможности**: 
  - 🍄 Грибная тематика дизайна
  - 🌍 Многоязычное тестирование (RU/EN/ES)
  - 🧠 Визуализация RAG анализа
  - 📊 Метрики производительности

### 2. Интеграционные тесты качества
- **Файл**: `tests/integration/rag-quality.test.js`
- **Тесты**:
  - Релевантность поиска документов
  - Фильтрация off-topic запросов
  - Многоязычная консистентность
  - Производительность RAG
  - Создание тикетов

### 3. Быстрый тестовый скрипт
- **Файл**: `scripts/test-rag-quick.js`
- **Функции**:
  - Базовый чат тест
  - RAG поиск тест
  - Тест создания тикетов
  - Многоязычный тест
  - Тест производительности

## 📋 Использование

### Веб-интерфейс
1. Запустите сервер: `npm run dev`
2. Откройте: `http://localhost:3000/test-chat-rag.html`
3. Выберите язык и тестовый сценарий
4. Анализируйте результаты RAG

### Командная строка
```bash
# Быстрое тестирование
npm run test:rag

# Детальные Jest тесты
npm run test:rag:quality

# Все интеграционные тесты
npm run test:integration
```

## 📊 Метрики

Интерфейс отслеживает:
- **Всего запросов** - количество отправленных сообщений
- **Среднее время ответа** - производительность системы
- **RAG Hit Rate** - процент успешных поисков в базе знаний
- **Документов найдено** - общее количество найденных документов

## 🔧 Настройка

Перед тестированием убедитесь:
1. Сервер запущен: `npm run dev`
2. База знаний загружена: `npm run load-kb`
3. Переменные окружения настроены в `.env`

## 📚 Документация

Подробное руководство: [docs/RAG_TESTING.md](docs/RAG_TESTING.md)

---
🍄 **Happy Testing!**