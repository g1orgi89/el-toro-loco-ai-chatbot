/**
 * API маршруты для работы с чатом
 * @file server/api/chat.js
 * 🍄 ИСПРАВЛЕНО: Убран двойной поиск RAG с fallback, добавлена проверка релевантности
 */

const express = require('express');
const claude = require('../services/claude'); // Вернули обратно к claude.js
const messageService = require('../services/message');
const conversationService = require('../services/conversation');
const languageDetectService = require('../services/languageDetect');
const vectorStoreService = require('../services/vectorStore');
const ticketService = require('../services/ticketing');
const logger = require('../utils/logger');

const router = express.Router();

/**
 * Проверяет, относится ли запрос к проекту Shrooms
 * @param {string} message - Сообщение пользователя
 * @param {string} language - Язык сообщения
 * @returns {boolean} Относится ли к проекту
 */
function _checkProjectRelevance(message, language) {
  const shroomsKeywords = {
    en: ['shrooms', 'wallet', 'token', 'farming', 'staking', 'xverse', 'hiro', 'stacks', 'bitcoin', 'crypto', 'connect', 'transaction', 'balance', 'btc', 'stx'],
    ru: ['шрумс', 'кошелек', 'токен', 'фарминг', 'стейкинг', 'xverse', 'hiro', 'stacks', 'биткоин', 'крипто', 'подключ', 'транзакция', 'баланс', 'btc', 'stx'],
    es: ['shrooms', 'billetera', 'token', 'farming', 'staking', 'xverse', 'hiro', 'stacks', 'bitcoin', 'crypto', 'conectar', 'transacción', 'balance', 'btc', 'stx']
  };
  
  const keywords = shroomsKeywords[language] || shroomsKeywords.en;
  const messageWords = message.toLowerCase().split(/\s+/);
  
  // Проверяем наличие ключевых слов проекта
  const hasProjectKeywords = keywords.some(keyword => 
    messageWords.some(word => word.includes(keyword.toLowerCase()))
  );
  
  // Проверяем на вопросительные слова + общая тематика
  const questionWords = {
    en: ['what', 'how', 'where', 'when', 'why', 'can', 'help', 'support', 'problem', 'issue', 'error'],
    ru: ['что', 'как', 'где', 'когда', 'почему', 'можно', 'помощь', 'поддержка', 'проблема', 'ошибка'],
    es: ['qué', 'cómo', 'dónde', 'cuándo', 'por qué', 'puedo', 'ayuda', 'soporte', 'problema', 'error']
  };
  
  const currentQuestionWords = questionWords[language] || questionWords.en;
  const hasQuestionWords = currentQuestionWords.some(word => 
    messageWords.includes(word.toLowerCase())
  );
  
  // Считаем релевантным если есть ключевые слова ИЛИ если это вопрос поддержки
  const isRelevant = hasProjectKeywords || (hasQuestionWords && messageWords.length > 2);
  
  logger.debug(`🍄 Project relevance check: ${isRelevant} (keywords: ${hasProjectKeywords}, questions: ${hasQuestionWords}) for: "${message.substring(0, 30)}..."`);
  
  return isRelevant;
}

/**
 * @route POST /api/chat и POST /api/chat/message
 * @desc Обработка сообщения пользователя через REST API
 * @access Public
 */
router.post(['/', '/message'], async (req, res) => {
  try {
    const { message, userId, conversationId, language, useRag = true } = req.body;

    // Валидация входных данных
    if (!message || !userId) {
      return res.status(400).json({
        success: false,
        error: 'Message and userId are required',
        code: 'VALIDATION_ERROR'
      });
    }

    // Получение или создание разговора
    let conversation;
    if (conversationId) {
      conversation = await conversationService.getConversationById(conversationId);
      if (!conversation) {
        logger.warn(`Conversation ${conversationId} not found, creating new one`);
        // Создаем разговор с базовым языком
        conversation = await conversationService.createConversation(userId, {
          language: language || 'en',
          source: 'api'
        });
      }
    } else {
      // Создаем новый разговор с базовым языком
      conversation = await conversationService.createConversation(userId, {
        language: language || 'en',
        source: 'api'
      });
    }
    
    // Получение истории сообщений
    const history = await messageService.getRecentMessages(conversation._id, 10);
    const formattedHistory = history.map(msg => ({
      role: msg.role,
      content: msg.text
    }));

    // Определение языка сообщения с учетом контекста
    const detectedLanguage = language || 
      languageDetectService.detectLanguageWithContext(message, {
        userId,
        conversationId: conversation._id.toString(),
        history: formattedHistory,
        previousLanguage: conversation.language
      });
    
    // Обновляем язык разговора, если он изменился
    if (conversation.language !== detectedLanguage) {
      await conversationService.updateLanguage(conversation._id, detectedLanguage);
    }
    
    // 🍄 ИСПРАВЛЕНО: Улучшенная логика RAG с проверкой релевантности
    let context = [];
    let ragUsed = false;
    const enableRag = process.env.ENABLE_RAG !== 'false' && useRag !== false;
    
    if (enableRag) {
      try {
        // 🍄 НОВОЕ: Проверка релевантности запроса к проекту
        const isRelevantToProject = _checkProjectRelevance(message, detectedLanguage);
        
        if (isRelevantToProject) {
          logger.debug(`🍄 Searching for relevant documents for: "${message.substring(0, 30)}${message.length > 30 ? '...' : ''}"`);
          
          // 🍄 ИСПРАВЛЕНО: Убран двойной поиск, используем только один запрос
          // Не передаем score_threshold - пусть vectorStore использует свои адаптивные пороги
          const contextResults = await vectorStoreService.search(message, {
            limit: 5,
            language: detectedLanguage
            // Убрали score_threshold - vectorStore сам определит оптимальный порог
          });
          
          if (contextResults && contextResults.length > 0) {
            context = contextResults.map(result => result.content);
            ragUsed = true;
            logger.info(`🍄 Found ${context.length} relevant documents for project-related query`);
            
            // Логируем scores для отладки
            const scores = contextResults.map(r => r.score?.toFixed(3) || 'N/A').join(', ');
            logger.debug(`🍄 Document scores: [${scores}]`);
          } else {
            logger.info(`🍄 No relevant documents found for project-related query: "${message.substring(0, 30)}..."`);
          }
        } else {
          logger.info(`🍄 Query not relevant to Shrooms project, skipping RAG: "${message.substring(0, 30)}..."`);
        }
      } catch (error) {
        logger.warn('🍄 Failed to get context from vector store:', error.message);
        // Продолжаем без контекста
      }
    }
    
    // Сохранение сообщения пользователя
    const userMessage = await messageService.create({
      text: message,
      role: 'user',
      userId,
      conversationId: conversation._id,
      metadata: { 
        language: detectedLanguage,
        source: 'api',
        ragUsed // Добавляем информацию об использовании RAG
      }
    });
    
    // Генерация ответа через Claude
    const aiResponse = await claude.generateResponse(message, {
      context,
      history: formattedHistory,
      language: detectedLanguage,
      userId // Добавляем userId для логирования
    });
    
    // Проверка на создание тикета
    let ticketId = null;
    let ticketError = null;
    
    if (aiResponse.needsTicket) {
      try {
        const ticket = await ticketService.createTicket({
          userId,
          conversationId: conversation._id,
          initialMessage: message,  // Исправлено: message -> initialMessage
          context: JSON.stringify({
            aiResponse: aiResponse.message,
            userMessage: message,
            history: formattedHistory.slice(-3),
            aiProvider: aiResponse.provider,
            ragUsed // Добавляем информацию об использовании RAG
          }),
          language: detectedLanguage,
          subject: `Support request: ${message.substring(0, 50)}...`,
          category: 'technical',
          metadata: {
            source: 'api',
            aiProvider: aiResponse.provider,
            ragUsed
          }
        });
        ticketId = ticket.ticketId;
        logger.info(`🎫 Ticket created: ${ticketId}`);
      } catch (error) {
        logger.error('Failed to create ticket:', error);
        ticketError = error.message;
      }
    }
    
    // Замена TICKET_ID в ответе
    let botResponse = aiResponse.message;
    if (ticketId) {
      botResponse = botResponse.replace('#TICKET_ID', `#${ticketId}`);
    }
    
    // Сохранение ответа бота
    const botMessage = await messageService.create({
      text: botResponse,
      role: 'assistant',
      userId,
      conversationId: conversation._id,
      metadata: {
        language: detectedLanguage,
        tokensUsed: aiResponse.tokensUsed,
        ticketCreated: aiResponse.needsTicket,
        ticketId,
        source: 'api',
        aiProvider: aiResponse.provider, // Сохраняем информацию о провайдере
        ragUsed // Добавляем информацию об использовании RAG
      }
    });
    
    // Обновление разговора
    await conversationService.incrementMessageCount(conversation._id);
    
    // Подготовка ответа
    const response = {
      success: true,
      data: {
        message: botResponse,
        conversationId: conversation._id.toString(),
        messageId: botMessage._id.toString(),
        needsTicket: aiResponse.needsTicket,
        ticketId,
        ticketError,
        tokensUsed: aiResponse.tokensUsed,
        language: detectedLanguage,
        aiProvider: aiResponse.provider, // Добавляем информацию о провайдере
        timestamp: new Date().toISOString(),
        metadata: {
          knowledgeResultsCount: context.length,
          historyMessagesCount: formattedHistory.length,
          ragUsed // Добавляем информацию об использовании RAG
        }
      }
    };
    
    res.json(response);
    logger.info(`✅ Chat API response sent for user: ${userId} (via ${aiResponse.provider}, RAG: ${ragUsed})`);
    
  } catch (error) {
    logger.error(`❌ Chat API error:`, error);
    
    // Определяем тип ошибки и возвращаем соответствующий код
    let statusCode = 500;
    let errorCode = 'INTERNAL_SERVER_ERROR';
    let errorMessage = 'Service temporarily unavailable. Please try again.';
    
    if (error.message.includes('Database')) {
      statusCode = 503;
      errorCode = 'DATABASE_ERROR';
    } else if (error.message.includes('OpenAI') || error.message.includes('Anthropic') || error.message.includes('AI Service')) {
      statusCode = 503;
      errorCode = 'AI_SERVICE_ERROR';
    } else if (error.message.includes('not initialized')) {
      statusCode = 503;
      errorCode = 'SERVICE_NOT_INITIALIZED';
    }
    
    res.status(statusCode).json({
      success: false,
      error: errorMessage,
      code: errorCode,
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * @route GET /api/chat/conversations/:userId
 * @desc Получение разговоров пользователя
 * @access Public
 */
router.get('/conversations/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const { limit = 10, skip = 0, activeOnly = false } = req.query;

    const conversations = await conversationService.findByUserId(userId, {
      limit: parseInt(limit),
      skip: parseInt(skip),
      activeOnly: activeOnly === 'true'
    });

    res.json({
      success: true,
      data: {
        conversations,
        count: conversations.length
      }
    });
  } catch (error) {
    logger.error('❌ Error getting conversations:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get conversations',
      code: 'INTERNAL_SERVER_ERROR'
    });
  }
});

/**
 * @route GET /api/chat/conversations/:conversationId/messages
 * @desc Получение сообщений разговора
 * @access Public
 */
router.get('/conversations/:conversationId/messages', async (req, res) => {
  try {
    const { conversationId } = req.params;
    const { limit = 50, skip = 0 } = req.query;

    const messages = await messageService.getByConversation(conversationId, {
      limit: parseInt(limit),
      skip: parseInt(skip)
    });

    res.json({
      success: true,
      data: {
        messages,
        count: messages.length
      }
    });
  } catch (error) {
    logger.error('❌ Error getting messages:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get messages',
      code: 'INTERNAL_SERVER_ERROR'
    });
  }
});

/**
 * @route POST /api/chat/conversations/:conversationId/close
 * @desc Закрытие разговора
 * @access Public
 */
router.post('/conversations/:conversationId/close', async (req, res) => {
  try {
    const { conversationId } = req.params;

    const conversation = await conversationService.endConversation(conversationId);
    
    if (!conversation) {
      return res.status(404).json({
        success: false,
        error: 'Conversation not found',
        code: 'NOT_FOUND'
      });
    }

    res.json({
      success: true,
      data: {
        message: 'Conversation closed successfully',
        conversationId: conversation._id
      }
    });
  } catch (error) {
    logger.error('❌ Error closing conversation:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to close conversation',
      code: 'INTERNAL_SERVER_ERROR'
    });
  }
});

/**
 * @route GET /api/chat/languages
 * @desc Получение списка поддерживаемых языков
 * @access Public
 */
router.get('/languages', async (req, res) => {
  try {
    const supportedLanguages = languageDetectService.getSupportedLanguages();
    const stats = languageDetectService.getStats();

    res.json({
      success: true,
      data: {
        supportedLanguages,
        defaultLanguage: stats.defaultLanguage,
        stats
      }
    });
  } catch (error) {
    logger.error('❌ Error getting language info:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get language information',
      code: 'INTERNAL_SERVER_ERROR'
    });
  }
});

/**
 * @route POST /api/chat/detect-language
 * @desc Определение языка текста
 * @access Public
 */
router.post('/detect-language', async (req, res) => {
  try {
    // Проверяем raw body и основной body
    const { text, userId, conversationId } = req.body;
    
    // Логируем входящий текст для отладки
    logger.info('Language detection request:', {
      originalText: text,
      rawBody: req.rawBody,
      headers: req.headers,
      contentType: req.headers['content-type']
    });

    if (!text || typeof text !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'Text is required and must be a string',
        code: 'VALIDATION_ERROR'
      });
    }

    // Проверяем, что текст не содержит знаки вопроса (признак неправильной кодировки)
    const hasQuestionMarks = /^\?+,?\s*\?+/.test(text.trim());
    if (hasQuestionMarks && req.rawBody) {
      // Пытаемся распарсить текст из rawBody
      try {
        const rawBodyParsed = JSON.parse(req.rawBody);
        if (rawBodyParsed.text && rawBodyParsed.text !== text) {
          logger.info('Using text from rawBody due to encoding issues');
          const correctedText = rawBodyParsed.text;
          req.body.text = correctedText;
        }
      } catch (parseError) {
        logger.warn('Failed to parse rawBody:', parseError.message);
      }
    }

    // Используем исправленный текст
    const processedText = req.body.text;
    let detectedLanguage;
    let method = 'basic';
    let history = [];

    // Если есть userId и conversationId, получаем историю для контекстного определения
    if (userId && conversationId) {
      try {
        const conversation = await conversationService.getConversationById(conversationId);
        if (conversation) {
          const recentMessages = await messageService.getRecentMessages(conversationId, 5);
          history = recentMessages.map(msg => ({
            role: msg.role,
            content: msg.text
          }));
          
          // Используем контекстное определение языка
          detectedLanguage = languageDetectService.detectLanguageWithContext(processedText, {
            userId,
            conversationId,
            history,
            previousLanguage: conversation.language
          });
          method = 'context-aware';
        } else {
          // Если разговор не найден, используем базовое определение
          detectedLanguage = languageDetectService.detectLanguage(processedText);
        }
      } catch (error) {
        logger.warn('Failed to get conversation history for language detection:', error);
        // Fallback к базовому определению
        detectedLanguage = languageDetectService.detectLanguage(processedText);
      }
    } else {
      // Используем базовое определение языка
      detectedLanguage = languageDetectService.detectLanguage(processedText);
    }

    // Подготавливаем безопасный вывод текста (ограничиваем длину)
    const safeText = processedText.substring(0, 50) + (processedText.length > 50 ? '...' : '');

    res.json({
      success: true,
      data: {
        detectedLanguage,
        text: safeText,
        method,
        metadata: {
          hasHistory: history.length > 0,
          historyCount: history.length,
          textLength: processedText.length,
          encoding: 'utf-8'
        }
      }
    });
  } catch (error) {
    logger.error('❌ Error detecting language:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to detect language',
      code: 'INTERNAL_SERVER_ERROR'
    });
  }
});

/**
 * @route GET /api/chat/stats
 * @desc Получение статистики чата
 * @access Public
 */
router.get('/stats', async (req, res) => {
  try {
    // Объединяем статистику из разных сервисов
    const [messagesStats, conversationsStats, languageStats, aiStats] = await Promise.all([
      messageService.getStats(),
      conversationService.getConversationStats(),
      Promise.resolve(languageDetectService.getStats()),
      Promise.resolve(claude.getProviderInfo()) // Используем claude вместо aiService
    ]);

    res.json({
      success: true,
      data: {
        messages: messagesStats,
        conversations: conversationsStats,
        language: languageStats,
        ai: aiStats, // Добавляем информацию о провайдере AI
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    logger.error('❌ Error getting chat stats:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get chat statistics',
      code: 'INTERNAL_SERVER_ERROR'
    });
  }
});

/**
 * @route POST /api/chat/messages/:messageId/edit
 * @desc Редактирование сообщения
 * @access Public
 */
router.post('/messages/:messageId/edit', async (req, res) => {
  try {
    const { messageId } = req.params;
    const { newText, editedBy } = req.body;

    if (!newText) {
      return res.status(400).json({
        success: false,
        error: 'New text is required',
        code: 'VALIDATION_ERROR'
      });
    }

    const editedMessage = await messageService.editMessage(messageId, newText, editedBy);

    if (!editedMessage) {
      return res.status(404).json({
        success: false,
        error: 'Message not found',
        code: 'NOT_FOUND'
      });
    }

    res.json({
      success: true,
      data: {
        message: editedMessage,
        editHistory: editedMessage.editHistory
      }
    });
  } catch (error) {
    logger.error('❌ Error editing message:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to edit message',
      code: 'INTERNAL_SERVER_ERROR'
    });
  }
});

/**
 * @route GET /api/chat/search
 * @desc Поиск сообщений
 * @access Public
 */
router.get('/search', async (req, res) => {
  try {
    const { q, userId, conversationId, language, limit = 50 } = req.query;

    if (!q) {
      return res.status(400).json({
        success: false,
        error: 'Search query is required',
        code: 'VALIDATION_ERROR'
      });
    }

    const searchOptions = {
      limit: parseInt(limit),
      userId,
      conversationId,
      language
    };

    const messages = await messageService.searchMessages(q, searchOptions);

    res.json({
      success: true,
      data: {
        messages,
        query: q,
        count: messages.length,
        options: searchOptions
      }
    });
  } catch (error) {
    logger.error('❌ Error searching messages:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to search messages',
      code: 'INTERNAL_SERVER_ERROR'
    });
  }
});

/**
 * @route GET /api/chat/health
 * @desc Проверка здоровья API чата
 * @access Public
 */
router.get('/health', async (req, res) => {
  try {
    // Проверяем здоровье всех зависимых сервисов
    const healthChecks = await Promise.allSettled([
      // AI service health
      claude.isHealthy ? claude.isHealthy() : Promise.resolve(true),
      // Message service health
      messageService.healthCheck ? messageService.healthCheck() : Promise.resolve({ status: 'ok' }),
      // Conversation service health
      conversationService.healthCheck ? conversationService.healthCheck() : Promise.resolve({ status: 'ok' }),
      // Vector store health (optional, может не быть инициализирован)
      vectorStoreService.healthCheck ? vectorStoreService.healthCheck() : Promise.resolve({ status: 'ok' })
    ]);

    // Обрабатываем результаты проверок
    const [aiHealth, messageHealth, conversationHealth, vectorHealth] = healthChecks.map(result => 
      result.status === 'fulfilled' ? result.value : { status: 'error', error: result.reason?.message }
    );

    // Определяем общее состояние здоровья
    const isAiHealthy = aiHealth === true || aiHealth?.status === 'ok';
    const isMessageHealthy = messageHealth?.status === 'ok';
    const isConversationHealthy = conversationHealth?.status === 'ok';
    const isVectorHealthy = vectorHealth?.status === 'ok' || vectorHealth?.status === 'error'; // Vector store опциональный

    const overall = isAiHealthy && isMessageHealthy && isConversationHealthy;

    const services = {
      ai: isAiHealthy ? 'ok' : 'error',
      messages: messageHealth?.status || 'error',
      conversations: conversationHealth?.status || 'error',
      vectorStore: vectorHealth?.status || 'not_initialized'
    };

    // Добавляем информацию о текущем AI провайдере
    const aiProviderInfo = claude.getProviderInfo();

    res.status(overall ? 200 : 503).json({
      success: overall,
      status: overall ? 'healthy' : 'unhealthy',
      services,
      details: {
        ai: isAiHealthy ? `Service is responding (${aiProviderInfo.currentProvider})` : 'Service not available',
        messages: messageHealth?.message || 'Unknown status',
        conversations: conversationHealth?.message || 'Unknown status',
        vectorStore: vectorHealth?.status === 'error' ? 'Not initialized (RAG disabled)' : 'Available'
      },
      aiProvider: aiProviderInfo, // Добавляем детальную информацию о AI провайдере
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('❌ Chat health check failed:', error);
    res.status(503).json({
      success: false,
      status: 'error',
      error: 'Health check failed',
      details: process.env.NODE_ENV === 'development' ? error.message : 'Internal error',
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * @route POST /api/chat/users/:userId/clear-language-cache
 * @desc Очищает кеш языковых предпочтений пользователя
 * @access Public
 */
router.post('/users/:userId/clear-language-cache', async (req, res) => {
  try {
    const { userId } = req.params;
    
    languageDetectService.clearLanguageCache(userId);
    
    res.json({
      success: true,
      data: {
        message: `Language cache cleared for user: ${userId}`,
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    logger.error('❌ Error clearing language cache:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to clear language cache',
      code: 'INTERNAL_SERVER_ERROR'
    });
  }
});

/**
 * @route POST /api/chat/switch-ai-provider
 * @desc Переключение AI провайдера без перезапуска сервера
 * @access Public (в production должен требовать авторизации)
 */
router.post('/switch-ai-provider', async (req, res) => {
  try {
    const { provider } = req.body;
    
    if (!provider || !['openai', 'claude'].includes(provider)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid provider. Must be one of: openai, claude',
        code: 'VALIDATION_ERROR'
      });
    }
    
    // Переключаем провайдера
    claude.switchProvider(provider);
    
    // Получаем обновленную информацию
    const providerInfo = claude.getProviderInfo();
    
    res.json({
      success: true,
      data: {
        message: `AI provider switched to: ${provider}`,
        providerInfo,
        timestamp: new Date().toISOString()
      }
    });
    
    logger.info(`AI provider switched to: ${provider}`);
  } catch (error) {
    logger.error('❌ Error switching AI provider:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      code: 'PROVIDER_SWITCH_ERROR'
    });
  }
});

/**
 * 🍄 НОВОЕ: Тестирование RAG функциональности
 * @route POST /api/chat/test-rag
 * @desc Тестирование поиска в базе знаний с различными порогами
 * @access Public
 */
router.post('/test-rag', async (req, res) => {
  try {
    const { query, language = 'en', thresholds = [0.9, 0.8, 0.7, 0.6, 0.5, 0.4] } = req.body;

    if (!query) {
      return res.status(400).json({
        success: false,
        error: 'Query is required',
        code: 'VALIDATION_ERROR'
      });
    }

    // Проверка релевантности
    const isRelevant = _checkProjectRelevance(query, language);
    
    // Тестирование поиска с разными порогами
    const results = {};
    
    for (const threshold of thresholds) {
      try {
        const searchResults = await vectorStoreService.search(query, {
          limit: 10,
          language: language,
          score_threshold: threshold
        });
        
        results[threshold] = {
          count: searchResults.length,
          scores: searchResults.map(r => r.score?.toFixed(4) || 'N/A'),
          documents: searchResults.map(r => ({
            id: r.id,
            score: r.score?.toFixed(4) || 'N/A',
            preview: r.content?.substring(0, 100) + '...'
          }))
        };
      } catch (error) {
        results[threshold] = {
          error: error.message
        };
      }
    }

    // Автоматический поиск (без порога)
    let autoResults = {};
    try {
      const autoSearch = await vectorStoreService.search(query, {
        limit: 5,
        language: language
      });
      autoResults = {
        count: autoSearch.length,
        scores: autoSearch.map(r => r.score?.toFixed(4) || 'N/A'),
        documents: autoSearch.map(r => ({
          id: r.id,
          score: r.score?.toFixed(4) || 'N/A',
          preview: r.content?.substring(0, 100) + '...'
        }))
      };
    } catch (error) {
      autoResults = { error: error.message };
    }

    res.json({
      success: true,
      data: {
        query,
        language,
        isRelevantToProject: isRelevant,
        resultsByThreshold: results,
        automaticSearch: autoResults,
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    logger.error('❌ Error testing RAG:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to test RAG functionality',
      code: 'INTERNAL_SERVER_ERROR'
    });
  }
});

module.exports = router;