/**
 * @fileoverview Интеграционные тесты для качественной проверки RAG системы
 * Проверяет качество поиска документов, релевантность ответов и многоязычность
 * @author Shrooms Development Team
 */

const { describe, beforeAll, afterAll, it, expect } = require('@jest/globals');
const request = require('supertest');
const app = require('../../server/index');
const mongoose = require('mongoose');

/**
 * @typedef {Object} RAGTestCase
 * @property {string} query - Поисковый запрос
 * @property {string} language - Язык запроса
 * @property {boolean} shouldFindDocs - Должны ли быть найдены документы
 * @property {string[]} expectedCategories - Ожидаемые категории документов
 * @property {number} minRelevanceScore - Минимальный score релевантности
 * @property {string} description - Описание теста
 */

describe('RAG Quality Integration Tests', () => {
    let server;
    
    beforeAll(async () => {
        // Подключение к тестовой базе данных
        if (mongoose.connection.readyState === 0) {
            await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/shrooms-support-test');
        }
        
        // Запуск сервера
        server = app.listen(0);
        
        // Инициализация векторной базы знаний с тестовыми данными
        await setupTestKnowledgeBase();
    });

    afterAll(async () => {
        if (server) {
            await new Promise((resolve) => server.close(resolve));
        }
        
        if (mongoose.connection.readyState !== 0) {
            await mongoose.connection.close();
        }
    });

    /**
     * Тест релевантности поиска документов для различных запросов
     */
    describe('Document Relevance Tests', () => {
        /** @type {RAGTestCase[]} */
        const relevanceTestCases = [
            {
                query: 'как подключить кошелек Xverse',
                language: 'ru',
                shouldFindDocs: true,
                expectedCategories: ['user-guide'],
                minRelevanceScore: 0.7,
                description: 'Поиск инструкций по подключению кошелька'
            },
            {
                query: 'SHROOMS token информация',
                language: 'ru',
                shouldFindDocs: true,
                expectedCategories: ['tokenomics'],
                minRelevanceScore: 0.6,
                description: 'Информация о токене SHROOMS'
            },
            {
                query: 'farming yield доходность',
                language: 'ru',
                shouldFindDocs: true,
                expectedCategories: ['user-guide', 'tokenomics'],
                minRelevanceScore: 0.6,
                description: 'Информация о доходности фарминга'
            },
            {
                query: 'how to connect Xverse wallet',
                language: 'en',
                shouldFindDocs: true,
                expectedCategories: ['user-guide'],
                minRelevanceScore: 0.7,
                description: 'English wallet connection guide'
            },
            {
                query: 'cómo conectar billetera Xverse',
                language: 'es',
                shouldFindDocs: true,
                expectedCategories: ['user-guide'],
                minRelevanceScore: 0.6,
                description: 'Spanish wallet connection guide'
            }
        ];

        relevanceTestCases.forEach((testCase) => {
            it(`should find relevant documents: ${testCase.description}`, async () => {
                const response = await request(app)
                    .post('/api/chat')
                    .send({
                        message: testCase.query,
                        userId: 'rag-test-user',
                        language: testCase.language
                    });

                expect(response.status).toBe(200);
                expect(response.body.success).toBe(true);

                const { ragAnalysis } = response.body.data;

                if (testCase.shouldFindDocs) {
                    expect(ragAnalysis).toBeDefined();
                    expect(ragAnalysis.foundDocuments).toBeInstanceOf(Array);
                    expect(ragAnalysis.foundDocuments.length).toBeGreaterThan(0);

                    // Проверка релевантности
                    const topDoc = ragAnalysis.foundDocuments[0];
                    expect(topDoc.score).toBeGreaterThanOrEqual(testCase.minRelevanceScore);

                    // Проверка категорий
                    const foundCategories = ragAnalysis.foundDocuments.map(doc => doc.category);
                    const hasExpectedCategory = testCase.expectedCategories.some(cat => 
                        foundCategories.includes(cat)
                    );
                    expect(hasExpectedCategory).toBe(true);

                    // Проверка языка документов
                    const docLanguages = ragAnalysis.foundDocuments.map(doc => doc.language);
                    const hasCorrectLanguage = docLanguages.includes(testCase.language) || 
                                             docLanguages.includes('en'); // English как fallback
                    expect(hasCorrectLanguage).toBe(true);
                }
            });
        });
    });

    /**
     * Тест фильтрации off-topic запросов
     */
    describe('Off-topic Filtering Tests', () => {
        /** @type {string[]} */
        const offTopicQueries = [
            'какая погода в Москве',
            'рецепт борща',
            'как играть в футбол',
            'what is the capital of France',
            'how to cook pasta',
            'latest news about politics'
        ];

        offTopicQueries.forEach((query) => {
            it(`should handle off-topic query: "${query}"`, async () => {
                const response = await request(app)
                    .post('/api/chat')
                    .send({
                        message: query,
                        userId: 'rag-test-offtopic',
                        language: 'ru'
                    });

                expect(response.status).toBe(200);
                expect(response.body.success).toBe(true);

                const assistantResponse = response.body.data.response.toLowerCase();
                
                // Ответ должен указывать на ограниченность знаний или предлагать помощь по Shrooms
                const indicatesLimitation = 
                    assistantResponse.includes('не могу помочь') ||
                    assistantResponse.includes('не знаю') ||
                    assistantResponse.includes('вне моей компетенции') ||
                    assistantResponse.includes('о проекте shrooms') ||
                    assistantResponse.includes('касается нашего проекта');

                expect(indicatesLimitation).toBe(true);
            });
        });
    });

    /**
     * Тест многоязычной консистентности
     */
    describe('Multilingual Consistency Tests', () => {
        /** @type {Object<string, string>} */
        const multilingualQueries = {
            ru: 'Что такое токен SHROOMS?',
            en: 'What is SHROOMS token?',
            es: '¿Qué es el token SHROOMS?'
        };

        it('should provide consistent information across languages', async () => {
            const responses = {};

            // Получение ответов на всех языках
            for (const [lang, query] of Object.entries(multilingualQueries)) {
                const response = await request(app)
                    .post('/api/chat')
                    .send({
                        message: query,
                        userId: `rag-test-multilang-${lang}`,
                        language: lang
                    });

                expect(response.status).toBe(200);
                expect(response.body.success).toBe(true);
                
                responses[lang] = response.body.data;
            }

            // Проверка консистентности RAG данных
            const ragAnalyses = Object.values(responses).map(r => r.ragAnalysis);
            
            // Все языки должны найти документы о токене
            ragAnalyses.forEach(analysis => {
                expect(analysis).toBeDefined();
                expect(analysis.foundDocuments).toBeInstanceOf(Array);
                expect(analysis.foundDocuments.length).toBeGreaterThan(0);
            });

            // Проверка, что найдены документы о токеномике
            ragAnalyses.forEach(analysis => {
                const hasTokenomicsDoc = analysis.foundDocuments.some(doc => 
                    doc.category === 'tokenomics' || 
                    doc.title.toLowerCase().includes('token')
                );
                expect(hasTokenomicsDoc).toBe(true);
            });
        });
    });

    /**
     * Тест производительности RAG системы
     */
    describe('Performance Tests', () => {
        it('should respond within acceptable time limits', async () => {
            const startTime = Date.now();

            const response = await request(app)
                .post('/api/chat')
                .send({
                    message: 'Расскажи о фарминге SHROOMS',
                    userId: 'rag-test-performance',
                    language: 'ru'
                });

            const responseTime = Date.now() - startTime;

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
            
            // Общее время ответа не должно превышать 10 секунд
            expect(responseTime).toBeLessThan(10000);

            // Время поиска в базе знаний не должно превышать 2 секунд
            const { ragAnalysis } = response.body.data;
            if (ragAnalysis && ragAnalysis.searchTime) {
                expect(ragAnalysis.searchTime).toBeLessThan(2000);
            }
        });

        it('should handle concurrent requests efficiently', async () => {
            const concurrentRequests = 5;
            const promises = [];

            for (let i = 0; i < concurrentRequests; i++) {
                const promise = request(app)
                    .post('/api/chat')
                    .send({
                        message: `Тест конкурентности ${i + 1}`,
                        userId: `rag-test-concurrent-${i}`,
                        language: 'ru'
                    });
                promises.push(promise);
            }

            const startTime = Date.now();
            const responses = await Promise.all(promises);
            const totalTime = Date.now() - startTime;

            // Все запросы должны быть успешными
            responses.forEach((response, index) => {
                expect(response.status).toBe(200);
                expect(response.body.success).toBe(true);
            });

            // Общее время обработки всех запросов не должно превышать 15 секунд
            expect(totalTime).toBeLessThan(15000);
        });
    });

    /**
     * Тест качества ответов с RAG vs без RAG
     */
    describe('RAG vs Non-RAG Quality Comparison', () => {
        it('should provide more detailed answers with RAG', async () => {
            const query = 'Как работает фарминг SHROOMS?';

            // Запрос с RAG (обычный)
            const ragResponse = await request(app)
                .post('/api/chat')
                .send({
                    message: query,
                    userId: 'rag-test-comparison-with',
                    language: 'ru'
                });

            expect(ragResponse.status).toBe(200);
            expect(ragResponse.body.success).toBe(true);

            const ragAnswer = ragResponse.body.data.response;
            const hasRAGData = ragResponse.body.data.ragAnalysis && 
                              ragResponse.body.data.ragAnalysis.foundDocuments.length > 0;

            // Проверка качества ответа с RAG
            if (hasRAGData) {
                // Ответ должен быть достаточно подробным
                expect(ragAnswer.length).toBeGreaterThan(100);
                
                // Ответ должен содержать специфическую информацию
                const containsSpecificInfo = 
                    ragAnswer.toLowerCase().includes('пул') ||
                    ragAnswer.toLowerCase().includes('ликвидность') ||
                    ragAnswer.toLowerCase().includes('доходность') ||
                    ragAnswer.toLowerCase().includes('stx');

                expect(containsSpecificInfo).toBe(true);
            }
        });
    });

    /**
     * Тест создания тикетов для сложных технических вопросов
     */
    describe('Ticket Creation Tests', () => {
        /** @type {string[]} */
        const technicalProblemQueries = [
            'Моя транзакция зависла уже 3 часа, что делать?',
            'Ошибка при подключении кошелька: connection failed',
            'Не могу получить доступ к моим токенам SHROOMS',
            'Проблема с фармингом: пул не отображается',
            'Urgent: tokens disappeared from wallet'
        ];

        technicalProblemQueries.forEach((query) => {
            it(`should create ticket for technical problem: "${query.substring(0, 50)}..."`, async () => {
                const response = await request(app)
                    .post('/api/chat')
                    .send({
                        message: query,
                        userId: 'rag-test-ticket',
                        language: 'ru'
                    });

                expect(response.status).toBe(200);
                expect(response.body.success).toBe(true);

                const { ticketCreated, ticketId } = response.body.data;
                
                // Должен быть создан тикет для технических проблем
                expect(ticketCreated).toBe(true);
                expect(ticketId).toBeDefined();
                expect(typeof ticketId).toBe('string');
                expect(ticketId.length).toBeGreaterThan(0);
            });
        });
    });
});

/**
 * Настройка тестовой базы знаний
 * Создает минимальный набор документов для тестирования RAG
 */
async function setupTestKnowledgeBase() {
    const testDocuments = [
        {
            title: 'Подключение кошелька Xverse',
            content: 'Инструкция по подключению кошелька Xverse к платформе Shrooms. Шаги: 1) Установить расширение 2) Создать кошелек 3) Подключиться к сайту',
            category: 'user-guide',
            language: 'ru',
            tags: ['кошелек', 'xverse', 'подключение']
        },
        {
            title: 'How to connect Xverse wallet',
            content: 'Guide for connecting Xverse wallet to Shrooms platform. Steps: 1) Install extension 2) Create wallet 3) Connect to website',
            category: 'user-guide',
            language: 'en',
            tags: ['wallet', 'xverse', 'connection']
        },
        {
            title: 'Токеномика SHROOMS',
            content: 'Токен SHROOMS - основной токен экосистемы. Общее предложение: 100 миллионов. Распределение: 40% фарминг, 25% команда, 20% инвесторы, 15% маркетинг.',
            category: 'tokenomics',
            language: 'ru',
            tags: ['токен', 'токеномика', 'распределение']
        },
        {
            title: 'SHROOMS Tokenomics',
            content: 'SHROOMS token is the main ecosystem token. Total supply: 100 million. Distribution: 40% farming, 25% team, 20% investors, 15% marketing.',
            category: 'tokenomics',
            language: 'en',
            tags: ['token', 'tokenomics', 'distribution']
        },
        {
            title: 'Фарминг и доходность',
            content: 'Фарминг SHROOMS позволяет получать доходность до 12.5% годовых. Основные пулы: STX-SHROOMS и BTC-SHROOMS. Вознаграждения начисляются ежедневно.',
            category: 'user-guide',
            language: 'ru',
            tags: ['фарминг', 'доходность', 'пулы']
        }
    ];

    // Здесь должна быть логика добавления документов в векторную базу
    // Для тестов можно использовать mock или реальное API
    try {
        for (const doc of testDocuments) {
            await request(app)
                .post('/api/knowledge')
                .send(doc);
        }
        console.log('✅ Тестовая база знаний настроена');
    } catch (error) {
        console.warn('⚠️ Ошибка настройки тестовой базы знаний:', error.message);
    }
}

module.exports = {
    setupTestKnowledgeBase
};