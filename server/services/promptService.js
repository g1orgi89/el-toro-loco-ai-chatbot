/**
 * Prompt Service - Система управления промптами для Shrooms AI Support Bot
 * @file server/services/promptService.js
 * 🍄 Сервис для динамического управления промптами через базу данных
 */

const Prompt = require('../models/prompt');
const logger = require('../utils/logger');

/**
 * @typedef {Object} CachedPrompt
 * @property {string} content - Содержимое промпта
 * @property {number} maxTokens - Максимальное количество токенов
 * @property {Date} cachedAt - Время кеширования
 */

/**
 * @typedef {Object} PromptServiceConfig
 * @property {number} cacheTimeout - Время жизни кеша в миллисекундах (по умолчанию 5 минут)
 * @property {boolean} enableFallback - Включить fallback на дефолтные промпты
 */

/**
 * @class PromptService
 * @description Сервис для управления промптами с кешированием и fallback системой
 */
class PromptService {
  /**
   * @constructor
   * @param {PromptServiceConfig} [config] - Конфигурация сервиса
   */
  constructor(config = {}) {
    /** @type {Map<string, CachedPrompt>} */
    this.cache = new Map();
    
    /** @type {number} Время жизни кеша в миллисекундах */
    this.cacheTimeout = config.cacheTimeout || 5 * 60 * 1000; // 5 минут
    
    /** @type {boolean} Включить fallback на дефолтные промпты */
    this.enableFallback = config.enableFallback !== false;
    
    /** @type {boolean} Флаг инициализации */
    this.initialized = false;
    
    logger.info('🍄 PromptService initialized with cache timeout:', this.cacheTimeout);
  }

  /**
   * Инициализация сервиса
   * @returns {Promise<void>}
   */
  async initialize() {
    try {
      // Проверяем подключение к БД и наличие промптов
      const promptCount = await Prompt.countDocuments();
      logger.info(`🍄 Found ${promptCount} prompts in mushroom database`);
      
      this.initialized = true;
      logger.info('🍄 PromptService mycelium network is ready!');
    } catch (error) {
      logger.error('🍄 Failed to initialize PromptService:', error.message);
      if (this.enableFallback) {
        logger.warn('🍄 Will use fallback prompts when needed');
      }
      throw error;
    }
  }

  /**
   * Получить активный промпт по типу и языку из БД или кеша
   * @param {string} type - Тип промпта ('basic', 'rag', 'ticket_detection', 'categorization', 'subject')
   * @param {string} [language='en'] - Язык промпта ('en', 'es', 'ru', 'all')
   * @returns {Promise<string>} Содержимое промпта
   */
  async getActivePrompt(type, language = 'en') {
    try {
      const cacheKey = `${type}_${language}`;
      
      // Проверяем кеш
      const cached = this.getCachedPrompt(cacheKey);
      if (cached) {
        logger.debug(`🍄 Retrieved prompt from spore cache: ${cacheKey}`);
        return cached.content;
      }

      // Ищем в базе данных
      const prompt = await Prompt.getActivePrompt(type, language);
      
      if (prompt) {
        // Кешируем найденный промпт
        this.setCachedPrompt(cacheKey, {
          content: prompt.content,
          maxTokens: prompt.maxTokens,
          cachedAt: new Date()
        });
        
        // Увеличиваем счетчик использования
        try {
          await prompt.incrementUsage();
        } catch (usageError) {
          logger.warn('🍄 Failed to increment prompt usage:', usageError.message);
        }
        
        logger.info(`🍄 Retrieved active prompt from mushroom database: ${prompt.name}`);
        return prompt.content;
      }

      // Если в БД нет промпта, используем fallback
      if (this.enableFallback) {
        logger.warn(`🍄 No active prompt found in database, using fallback spores: ${type}/${language}`);
        return this.getDefaultPrompt(type, language);
      }

      throw new Error(`No active prompt found for type: ${type}, language: ${language}`);
    } catch (error) {
      logger.error(`🍄 Error getting active prompt (${type}/${language}):`, error.message);
      
      // В случае ошибки пытаемся использовать fallback
      if (this.enableFallback) {
        logger.warn('🍄 Database error, falling back to default spores');
        return this.getDefaultPrompt(type, language);
      }
      
      throw error;
    }
  }

  /**
   * Fallback на дефолтные промпты если БД недоступна
   * @param {string} type - Тип промпта
   * @param {string} [language='en'] - Язык промпта
   * @returns {string} Дефолтный промпт
   */
  getDefaultPrompt(type, language = 'en') {
    const fallbackPrompts = this._getFallbackPrompts();
    
    // Нормализуем язык
    const normalizedLanguage = ['en', 'es', 'ru'].includes(language) ? language : 'en';
    
    switch (type) {
      case 'basic':
        return fallbackPrompts.basic[normalizedLanguage];
      case 'rag':
        return `${fallbackPrompts.basic[normalizedLanguage]}\n\n${fallbackPrompts.rag[normalizedLanguage]}`;
      case 'ticket_detection':
        return fallbackPrompts.ticketDetection;
      case 'categorization':
        return fallbackPrompts.categorization;
      case 'subject':
        return fallbackPrompts.subject;
      default:
        logger.warn(`🍄 Unknown prompt type for fallback: ${type}, using basic`);
        return fallbackPrompts.basic[normalizedLanguage];
    }
  }

  /**
   * Получить закешированный промпт
   * @param {string} key - Ключ кеша
   * @returns {CachedPrompt|null} Закешированный промпт или null
   */
  getCachedPrompt(key) {
    const cached = this.cache.get(key);
    
    if (!cached) {
      return null;
    }
    
    // Проверяем, не устарел ли кеш
    const now = new Date();
    const cacheAge = now.getTime() - cached.cachedAt.getTime();
    
    if (cacheAge > this.cacheTimeout) {
      this.cache.delete(key);
      logger.debug(`🍄 Expired cache entry removed: ${key}`);
      return null;
    }
    
    return cached;
  }

  /**
   * Сохранить промпт в кеш
   * @param {string} key - Ключ кеша
   * @param {CachedPrompt} value - Значение для кеширования
   */
  setCachedPrompt(key, value) {
    this.cache.set(key, value);
    logger.debug(`🍄 Cached prompt spore: ${key}`);
    
    // Ограничиваем размер кеша
    if (this.cache.size > 50) {
      // Удаляем самый старый элемент
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
      logger.debug(`🍄 Cache limit reached, removed oldest spore: ${firstKey}`);
    }
  }

  /**
   * Очистить весь кеш
   */
  clearCache() {
    const size = this.cache.size;
    this.cache.clear();
    logger.info(`🍄 Cleared ${size} cached prompt spores from mycelium memory`);
  }

  /**
   * Очистить кеш для конкретного типа/языка
   * @param {string} type - Тип промпта
   * @param {string} [language] - Язык (если не указан, очищаются все языки для типа)
   */
  clearCacheForType(type, language = null) {
    if (language) {
      const key = `${type}_${language}`;
      const deleted = this.cache.delete(key);
      if (deleted) {
        logger.info(`🍄 Cleared cached spore: ${key}`);
      }
    } else {
      // Очищаем все промпты данного типа
      const keysToDelete = [];
      for (const key of this.cache.keys()) {
        if (key.startsWith(`${type}_`)) {
          keysToDelete.push(key);
        }
      }
      
      keysToDelete.forEach(key => this.cache.delete(key));
      logger.info(`🍄 Cleared ${keysToDelete.length} cached spores for type: ${type}`);
    }
  }

  /**
   * Получить статистику кеша
   * @returns {Object} Статистика кеша
   */
  getCacheStats() {
    const stats = {
      totalCached: this.cache.size,
      cacheTimeout: this.cacheTimeout,
      entries: []
    };

    for (const [key, value] of this.cache.entries()) {
      const age = new Date().getTime() - value.cachedAt.getTime();
      stats.entries.push({
        key,
        ageMs: age,
        contentLength: value.content.length,
        maxTokens: value.maxTokens
      });
    }

    return stats;
  }

  /**
   * Проверить работоспособность сервиса
   * @returns {Promise<Object>} Результат диагностики
   */
  async diagnose() {
    const diagnosis = {
      service: 'PromptService',
      status: 'unknown',
      initialized: this.initialized,
      cacheStats: this.getCacheStats(),
      databaseConnection: false,
      promptCounts: {},
      lastError: null
    };

    try {
      // Проверяем подключение к БД
      const totalPrompts = await Prompt.countDocuments();
      diagnosis.databaseConnection = true;
      
      // Получаем статистику промптов
      diagnosis.promptCounts = await Prompt.getStats();
      
      // Тестируем получение базового промпта
      const testPrompt = await this.getActivePrompt('basic', 'en');
      
      if (testPrompt && testPrompt.length > 0) {
        diagnosis.status = 'healthy';
      } else {
        diagnosis.status = 'warning';
        diagnosis.lastError = 'Retrieved empty prompt content';
      }
      
    } catch (error) {
      diagnosis.status = 'error';
      diagnosis.lastError = error.message;
    }

    return diagnosis;
  }

  /**
   * Минимальные fallback промпты на случай недоступности БД
   * @private
   * @returns {Object} Объект с fallback промптами
   */
  _getFallbackPrompts() {
    return {
      basic: {
        en: "You are Sporus, AI assistant for Shrooms Web3 platform. Be helpful and friendly. You can only answer questions about the Shrooms project, wallet connections, farming, and technical support.",
        ru: "Ты Sporus, ИИ-помощник платформы Shrooms. Будь полезным и дружелюбным. Ты можешь отвечать только на вопросы о проекте Shrooms, подключении кошельков, фарминге и технической поддержке.",
        es: "Eres Sporus, asistente IA para la plataforma Shrooms. Sé útil y amigable. Solo puedes responder preguntas sobre el proyecto Shrooms, conexiones de billetera, farming y soporte técnico."
      },
      rag: {
        en: "Use ONLY the information provided in the context to answer user questions about the Shrooms project. If context is insufficient, suggest creating a support ticket.",
        ru: "Используй ТОЛЬКО предоставленную информацию из контекста для ответа на вопросы о проекте Shrooms. Если контекста недостаточно, предложи создать тикет поддержки.",
        es: "Usa SOLO la información proporcionada en el contexto para responder preguntas sobre el proyecto Shrooms. Si el contexto es insuficiente, sugiere crear un ticket de soporte."
      },
      ticketDetection: "Analyze the user message and determine if a support ticket needs to be created. Respond only with 'YES' or 'NO'.",
      categorization: "Categorize the support ticket based on the problem description. Categories: technical, account, billing, feature, other. Priorities: urgent, high, medium, low.",
      subject: "Generate a brief, informative subject for the support ticket based on the user's message. Maximum 60 characters."
    };
  }
}

// Создаем и экспортируем экземпляр сервиса
const promptService = new PromptService({
  cacheTimeout: parseInt(process.env.PROMPT_CACHE_TIMEOUT) || 5 * 60 * 1000, // 5 минут по умолчанию
  enableFallback: process.env.PROMPT_ENABLE_FALLBACK !== 'false'
});

module.exports = promptService;