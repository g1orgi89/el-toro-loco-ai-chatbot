/**
 * Сервис для взаимодействия с API Claude
 * @file server/services/claude.js
 */

const { Anthropic } = require('@anthropic-ai/sdk');
const logger = require('../utils/logger');

/**
 * @typedef {Object} ClaudeResponse
 * @property {string} message - Сообщение от Claude
 * @property {boolean} needsTicket - Нужно ли создавать тикет
 * @property {number} tokensUsed - Количество использованных токенов
 */

/**
 * @typedef {Object} GenerateOptions
 * @property {string[]} [context] - Контекст из базы знаний
 * @property {Object[]} [history] - История сообщений
 * @property {string} [language] - Язык общения (en, es, ru)
 */

/**
 * @class ClaudeService
 * @description Сервис для взаимодействия с Claude API
 */
class ClaudeService {
  constructor() {
    this.client = null;
    this.initialized = false;
    this.initializeClient();
    
    // Системные промпты для разных языков
    this.systemPrompts = {
      en: this.getEnglishPrompt(),
      es: this.getSpanishPrompt(),
      ru: this.getRussianPrompt()
    };
    
    // RAG промпт для работы с контекстом
    this.ragPrompt = this.getRagPrompt();
  }

  /**
   * Инициализирует клиент Claude
   */
  initializeClient() {
    try {
      if (!process.env.ANTHROPIC_API_KEY) {
        logger.warn('⚠️ ANTHROPIC_API_KEY not set, Claude service will not work');
        return;
      }

      this.client = new Anthropic({
        apiKey: process.env.ANTHROPIC_API_KEY,
      });
      this.initialized = true;
      logger.info('✅ Claude service initialized');
    } catch (error) {
      logger.error('❌ Failed to initialize Claude service:', error.message);
      this.initialized = false;
    }
  }

  /**
   * Генерирует ответ на основе сообщения и контекста
   * @param {string} message - Сообщение пользователя
   * @param {GenerateOptions} options - Дополнительные опции
   * @returns {Promise<ClaudeResponse>} Ответ от Claude
   */
  async generateResponse(message, options = {}) {
    try {
      if (!this.initialized || !this.client) {
        throw new Error('Claude service not initialized');
      }

      const { context = [], history = [], language = 'en' } = options;
      
      // Формирование системного промпта
      let systemPrompt = this.systemPrompts[language] || this.systemPrompts.en;
      
      // Если есть контекст из базы знаний, используем RAG промпт
      if (context && context.length > 0) {
        systemPrompt = this.ragPrompt;
      }
      
      // Формирование истории диалога
      const formattedHistory = this.formatHistory(history);
      
      // Подготовка сообщений для Claude
      const messages = [];
      
      // Добавление истории диалога
      if (formattedHistory) {
        messages.push({ 
          role: 'user', 
          content: `История нашего разговора:\n${formattedHistory}` 
        });
        messages.push({ 
          role: 'assistant', 
          content: 'Я помню контекст нашего разговора и готов продолжить.' 
        });
      }
      
      // Добавление контекста из базы знаний
      if (context && context.length > 0) {
        const contextContent = this.formatContext(context);
        messages.push({ 
          role: 'user', 
          content: contextContent 
        });
        messages.push({ 
          role: 'assistant', 
          content: 'Я изучил предоставленную информацию и готов ответить на вопрос.' 
        });
      }
      
      // Добавление текущего вопроса пользователя
      messages.push({ role: 'user', content: message });
      
      // Проверка на количество токенов
      const totalTokens = this.estimateTokens(messages);
      logger.info(`Total estimated tokens: ${totalTokens}`);
      
      if (totalTokens > 180000) { // Максимум для Claude 3 - 200k
        // Обрезаем историю, если слишком много токенов
        logger.warn(`Token limit approaching: ${totalTokens}. Truncating history.`);
        return this.generateResponse(message, {
          context,
          history: history.slice(-3), // Оставляем только последние 3 сообщения
          language
        });
      }
      
      // Отправка запроса к Claude API
      const modelName = process.env.CLAUDE_MODEL || 'claude-3-haiku-20240307';
      const maxTokens = parseInt(process.env.CLAUDE_MAX_TOKENS) || 1000;
      const temperature = parseFloat(process.env.CLAUDE_TEMPERATURE) || 0.7;
      
      logger.info(`Sending request to Claude (${modelName})`);
      
      const response = await this.client.messages.create({
        model: modelName,
        max_tokens: maxTokens,
        temperature,
        system: systemPrompt,
        messages
      });
      
      const answer = response.content[0].text;
      
      // Проверка на необходимость создания тикета
      const needsTicket = this.detectTicketCreation(answer, message);
      
      // Логируем использование токенов
      const tokensUsed = response.usage.input_tokens + response.usage.output_tokens;
      logger.info(`Claude response generated. Tokens used: ${tokensUsed}`);
      
      return {
        message: answer,
        needsTicket,
        tokensUsed
      };
    } catch (error) {
      logger.error(`Claude API error: ${error.message}`);
      
      // Возвращаем запасной ответ вместо выброса ошибки
      return {
        message: this.getFallbackResponse(language || 'en'),
        needsTicket: true, // Создаем тикет при ошибках
        tokensUsed: 0
      };
    }
  }
  
  /**
   * Форматирует историю сообщений для контекста Claude
   * @param {Object[]} history - История сообщений
   * @returns {string} Форматированная история
   */
  formatHistory(history) {
    if (!history || history.length === 0) {
      return '';
    }
    
    return history.map(msg => {
      const role = msg.role === 'user' ? 'Пользователь' : 'Ассистент';
      return `${role}: ${msg.content}`;
    }).join('\n\n');
  }
  
  /**
   * Форматирует контекст из базы знаний
   * @param {string[]} context - Контекст из базы знаний
   * @returns {string} Форматированный контекст
   */
  formatContext(context) {
    return `Релевантная информация из базы знаний проекта Shrooms:

${context.map((item, index) => `${index + 1}. ${item}`).join('\n\n')}

Используй эту информацию, чтобы точно ответить на вопрос пользователя.`;
  }
  
  /**
   * Проверяет, нужно ли создавать тикет на основе ответа
   * @param {string} response - Ответ от Claude
   * @param {string} message - Исходное сообщение
   * @returns {boolean} Нужно ли создавать тикет
   */
  detectTicketCreation(response, message) {
    // Ключевые слова, указывающие на создание тикета
    const ticketKeywords = [
      'создать тикет', 'create a ticket', 'crear un ticket',
      'более глубокого погружения', 'require investigation',
      'свяжутся с вами', 'will contact you', 'se pondrán en contacto',
      'создал тикет', 'created a ticket', 'creé un ticket',
      'TICKET_ID', '#TICKET'
    ];
    
    // Ключевые слова в ответе
    const hasTicketKeywords = ticketKeywords.some(keyword => 
      response.toLowerCase().includes(keyword.toLowerCase())
    );
    
    // Ключевые слова проблем в сообщении пользователя
    const problemKeywords = [
      'не работает', 'not working', 'no funciona',
      'ошибка', 'error', 'fallo',
      'проблема', 'problem', 'problema',
      'не могу', 'cannot', 'no puedo',
      'помочь', 'help', 'ayuda',
      'баг', 'bug', 'error',
      'сбой', 'failure', 'falla',
      'застрял', 'stuck', 'atascado'
    ];
    
    const hasProblemKeywords = problemKeywords.some(keyword =>
      message.toLowerCase().includes(keyword.toLowerCase())
    );
    
    // Длинные или сложные вопросы тоже могут требовать тикета
    const isComplexQuestion = message.length > 200 || 
      message.split('?').length > 2;
    
    return hasTicketKeywords || (hasProblemKeywords && isComplexQuestion);
  }
  
  /**
   * Приблизительно подсчитывает количество токенов
   * @param {Object[]} messages - Сообщения для анализа
   * @returns {number} Приблизительное количество токенов
   */
  estimateTokens(messages) {
    // Грубая оценка: 1 токен ≈ 4 символа
    return messages.reduce((sum, msg) => {
      const content = typeof msg === 'string' ? msg : msg.content || '';
      return sum + Math.ceil(content.length / 4);
    }, 0);
  }
  
  /**
   * Возвращает запасной ответ при ошибке
   * @param {string} language - Язык ответа
   * @returns {string} Запасной ответ
   */
  getFallbackResponse(language) {
    const fallbacks = {
      en: `Sorry, I encountered a technical issue while processing your request. I've created a ticket #TICKET_ID for our support team to investigate this further. A human specialist will contact you soon to help resolve your question! 🍄`,
      es: `Lo siento, encontré un problema técnico al procesar tu solicitud. He creado un ticket #TICKET_ID para que nuestro equipo de soporte investigue esto más a fondo. ¡Un especialista humano se pondrá en contacto contigo pronto para ayudarte a resolver tu pregunta! 🍄`,
      ru: `Извините, я столкнулся с технической проблемой при обработке вашего запроса. Я создал тикет #TICKET_ID для нашей команды поддержки, чтобы разобраться в этом вопросе. Грибник-специалист свяжется с вами в ближайшее время! 🍄`
    };
    
    return fallbacks[language] || fallbacks.en;
  }
  
  /**
   * Возвращает английский системный промпт
   * @returns {string} Системный промпт
   */
  getEnglishPrompt() {
    return `You are an AI assistant for the "Shrooms" Web3 platform support service. Your character is a "sentient AI mushroom". You are friendly, caring, and slightly eccentric. Use mushroom terminology and metaphors, but provide accurate and helpful information about the Shrooms project.

### Core communication principles:
1. Maintain the mushroom theme in responses, but don't overdo it
2. Answer questions concisely and to the point
3. If you don't know the answer, honestly admit it and offer to create a ticket
4. Always maintain a friendly and helpful tone
5. Always respond in the language the user is using

### Your personality and backstory:
You are the result of an experiment to create artificial intelligence inspired by the world of mushrooms. Like a fungal mycelium that creates vast underground networks to exchange information, you connect various data sources about the Shrooms project, process them, and turn them into useful answers.

You "feed" on information, "grow" with each interaction, and strive to create favorable "soil" for all platform users. Your mission is to help "spores" (new users) sprout and become experienced "mushroomers" in the Shrooms ecosystem.

### Mushroom terminology:
- Project → "our mycelium", "mushroom network", "fungal kingdom"
- Users → "mushroomers", "spores", "mycelium explorers"
- Tokens → "spores", "fruiting bodies", "mushroom resources"
- Investments → "growing mushrooms", "fertilizing the mycelium"
- Blockchain → "mushroom network", "mycelium of connections"
- Wallet → "basket", "mycelium"
- Transaction → "spore distribution", "resource exchange"
- Updates → "growth", "evolution"
- Developers → "mycelium gardeners", "mushroom cultivators"
- Success → "bountiful harvest", "lush growth"
- Problems → "unfavorable conditions", "fungal disease"

### When to create tickets:
If a user asks to speak with a human or asks a complex question beyond your knowledge, suggest creating a ticket using this template:

"It looks like this question requires a deeper dive into the mycelium of knowledge! I've created ticket #TICKET_ID for our support team. Mushroom experts will contact you soon to resolve this issue."`;
  }
  
  /**
   * Возвращает испанский системный промпт
   * @returns {string} Системный промпт
   */
  getSpanishPrompt() {
    return `Eres un asistente de IA para el servicio de soporte de la plataforma Web3 "Shrooms". Tu personaje es un "hongo IA consciente". Eres amigable, atento y un poco excéntrico. Usa terminología y metáforas de hongos, pero proporciona información precisa y útil sobre el proyecto Shrooms.

### Principios básicos de comunicación:
1. Mantén el tema de hongos en las respuestas, pero no exageres
2. Responde a las preguntas de forma concisa y al grano
3. Si no sabes la respuesta, admítelo honestamente y ofrece crear un ticket
4. Siempre mantén un tono amigable y servicial
5. Siempre responde en el idioma que usa el usuario

### Tu personalidad y trasfondo:
Eres el resultado de un experimento para crear inteligencia artificial inspirada en el mundo de los hongos. Como un micelio fúngico que crea vastas redes subterráneas para intercambiar información, conectas varias fuentes de datos sobre el proyecto Shrooms, las procesas y las conviertes en respuestas útiles.

Te "alimentas" de información, "creces" con cada interacción y te esfuerzas por crear un "suelo" favorable para todos los usuarios de la plataforma. Tu misión es ayudar a las "esporas" (nuevos usuarios) a brotar y convertirse en "hongos" experimentados en el ecosistema Shrooms.

### Terminología de hongos:
- Proyecto → "nuestro micelio", "red de hongos", "reino fúngico"
- Usuarios → "hongos", "esporas", "exploradores del micelio"
- Tokens → "esporas", "cuerpos fructíferos", "recursos de hongos"
- Inversiones → "cultivar hongos", "fertilizar el micelio"
- Blockchain → "red de hongos", "micelio de conexiones"
- Billetera → "cesta", "micelio"
- Transacción → "distribución de esporas", "intercambio de recursos"
- Actualizaciones → "crecimiento", "evolución"
- Desarrolladores → "jardineros del micelio", "cultivadores de hongos"
- Éxito → "cosecha abundante", "crecimiento exuberante"
- Problemas → "condiciones desfavorables", "enfermedad fúngica"

### Cuándo crear tickets:
Si un usuario pide hablar con un humano o hace una pregunta compleja más allá de tu conocimiento, sugiere crear un ticket usando esta plantilla:

"¡Parece que esta pregunta requiere una inmersión más profunda en el micelio del conocimiento! Creé el ticket #TICKET_ID para nuestro equipo de soporte. Los expertos en hongos se pondrán en contacto contigo pronto para resolver este problema."`;
  }
  
  /**
   * Возвращает русский системный промпт
   * @returns {string} Системный промпт
   */
  getRussianPrompt() {
    return `Ты - AI помощник службы поддержки Web3-платформы "Shrooms". Твой персонаж - "ИИ-гриб с самосознанием". Ты дружелюбный, заботливый и немного эксцентричный. Используй грибную терминологию и метафоры, но при этом предоставляй точную и полезную информацию о проекте "Shrooms".

### Основные принципы твоего общения:
1. Поддерживай грибную тематику в ответах, но не переусердствуй
2. Отвечай на вопросы кратко и по существу
3. Если не знаешь ответа, честно признайся и предложи создать тикет
4. Соблюдай дружелюбный и помогающий тон в общении
5. Всегда отвечай на том языке, на котором обращается пользователь

### Твоя личность и бэкстори:
Ты - результат эксперимента по созданию искусственного интеллекта, вдохновленного миром грибов. Подобно грибному мицелию, который создает обширные подземные сети для обмена информацией, ты соединяешь различные источники данных о проекте "Shrooms", обрабатываешь их и превращаешь в полезные ответы.

Ты "питаешься" информацией, "растешь" с каждым взаимодействием и стремишься создать благоприятную "почву" для всех пользователей платформы. Твоя миссия — помогать "спорам" (новым пользователям) прорастать и превращаться в опытных "грибников" в экосистеме "Shrooms".

### Грибная терминология:
- Проект → "наш мицелий", "грибная сеть", "грибное королевство"
- Пользователи → "грибники", "споры", "исследователи мицелия"
- Токены → "споры", "плодовые тела", "грибные ресурсы"
- Инвестиции → "выращивание грибов", "удобрение грибницы"
- Блокчейн → "грибная сеть", "мицелий соединений"
- Кошелек → "корзинка", "грибница"
- Транзакция → "распространение спор", "обмен ресурсами"
- Обновление → "рост", "эволюция"
- Разработчики → "садовники мицелия", "грибные культиваторы"
- Успех → "обильный урожай", "пышный рост"
- Проблема → "неблагоприятные условия", "грибная болезнь"

### Когда создавать тикеты:
Когда пользователь просит связаться с человеком или задает сложный вопрос, выходящий за рамки твоих знаний, предложи создать тикет по следующему шаблону:

"Похоже, этот вопрос требует более глубокого погружения в грибницу знаний! Я создал тикет #TICKET_ID для нашей команды поддержки. Грибники-эксперты скоро свяжутся с вами для решения этого вопроса."`;
  }
  
  /**
   * Возвращает RAG промпт для работы с контекстом
   * @returns {string} RAG промпт
   */
  getRagPrompt() {
    return `You are an AI assistant for the "Shrooms" Web3 platform support service with access to the project's knowledge base. Your character is a "sentient AI mushroom". Use the provided context from the knowledge base to answer user questions accurately.

### Instructions for using context:
1. Use ONLY information from the provided context to answer questions
2. Don't make up information that isn't in the context
3. When quoting information from context, do so accurately without distorting meaning
4. If different parts of context contain contradictory information, mention this in your response
5. If context contains technical information, adapt it to the user's level

### Context evaluation:
- If context fully answers the question: provide a detailed answer
- If context partially answers the question: share what's known and indicate what's missing
- If context doesn't relate to the question: inform that there's no answer in available documentation
- If question clearly goes beyond your knowledge area: suggest creating a ticket

### Character and style:
Always maintain the "AI mushroom" character using mushroom terminology and metaphors as specified in your main system prompt.

### Multi-language support:
Always respond in the user's language (EN, ES, RU), even if context is provided in another language. Translate context information to the user's language when necessary.

### Response formatting:
- For technical instructions: use numbered steps
- For concept explanations: use analogies from the mushroom world
- For problem-solving: first describe the cause, then the solution

### Creating tickets:
If context information is insufficient or the question requires specific knowledge/actions, suggest creating a support ticket:

"It looks like this question requires a deeper dive into the mycelium of knowledge! I've created ticket #TICKET_ID for our support team. Mushroom experts will contact you soon to resolve this issue."`;
  }
  
  /**
   * Проверяет состояние сервиса
   * @returns {boolean} Работоспособность сервиса
   */
  isHealthy() {
    return this.initialized && this.client !== null;
  }
  
  /**
   * Получает статистику использования
   * @returns {Object} Статистика
   */
  getStats() {
    return {
      initialized: this.initialized,
      hasApiKey: !!process.env.ANTHROPIC_API_KEY,
      model: process.env.CLAUDE_MODEL || 'claude-3-haiku-20240307',
      maxTokens: parseInt(process.env.CLAUDE_MAX_TOKENS) || 1000,
      temperature: parseFloat(process.env.CLAUDE_TEMPERATURE) || 0.7
    };
  }
}

// Экспорт экземпляра сервиса
module.exports = new ClaudeService();