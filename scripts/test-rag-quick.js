#!/usr/bin/env node
/**
 * @fileoverview Быстрый тестовый скрипт для проверки RAG функциональности
 * Простая утилита для ручного тестирования без Jest
 * @author Shrooms Development Team
 */

require('dotenv').config();
const http = require('http');

/**
 * @typedef {Object} TestResult
 * @property {boolean} success - Успешность теста
 * @property {string} message - Сообщение о результате
 * @property {Object} [data] - Дополнительные данные
 */

class QuickRAGTester {
    constructor() {
        this.apiUrl = process.env.API_URL || 'http://localhost:3000';
        this.results = [];
    }

    /**
     * Выполнение HTTP запроса
     * @param {string} path - Путь API
     * @param {Object} data - Данные для отправки
     * @returns {Promise<Object>} Ответ сервера
     */
    async makeRequest(path, data) {
        return new Promise((resolve, reject) => {
            const postData = JSON.stringify(data);
            const url = new URL(this.apiUrl + path);
            
            const options = {
                hostname: url.hostname,
                port: url.port || (url.protocol === 'https:' ? 443 : 80),
                path: url.pathname,
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Content-Length': Buffer.byteLength(postData)
                }
            };

            const req = http.request(options, (res) => {
                let body = '';
                res.on('data', (chunk) => body += chunk);
                res.on('end', () => {
                    try {
                        const response = JSON.parse(body);
                        resolve({ status: res.statusCode, body: response });
                    } catch (error) {
                        reject(new Error(`Invalid JSON response: ${body}`));
                    }
                });
            });

            req.on('error', reject);
            req.write(postData);
            req.end();
        });
    }

    /**
     * Тест базовой функциональности чата
     * @returns {Promise<TestResult>}
     */
    async testBasicChat() {
        try {
            const response = await this.makeRequest('/api/chat', {
                message: 'Привет, как дела?',
                userId: 'quick-test-basic',
                language: 'ru'
            });

            if (response.status === 200 && response.body.success) {
                return {
                    success: true,
                    message: '✅ Базовый чат работает',
                    data: { responseLength: response.body.data.response.length }
                };
            } else {
                return {
                    success: false,
                    message: `❌ Ошибка базового чата: ${response.body.error || 'Unknown error'}`
                };
            }
        } catch (error) {
            return {
                success: false,
                message: `❌ Сетевая ошибка: ${error.message}`
            };
        }
    }

    /**
     * Тест поиска в базе знаний
     * @returns {Promise<TestResult>}
     */
    async testKnowledgeSearch() {
        try {
            const response = await this.makeRequest('/api/chat', {
                message: 'Как подключить кошелек Xverse?',
                userId: 'quick-test-knowledge',
                language: 'ru'
            });

            if (response.status === 200 && response.body.success) {
                const ragAnalysis = response.body.data.ragAnalysis;
                
                if (ragAnalysis && ragAnalysis.foundDocuments && ragAnalysis.foundDocuments.length > 0) {
                    return {
                        success: true,
                        message: `✅ RAG работает: найдено ${ragAnalysis.foundDocuments.length} документов`,
                        data: { 
                            documentsFound: ragAnalysis.foundDocuments.length,
                            searchTime: ragAnalysis.searchTime,
                            topScore: ragAnalysis.foundDocuments[0]?.score
                        }
                    };
                } else {
                    return {
                        success: false,
                        message: '⚠️ RAG не нашел релевантные документы'
                    };
                }
            } else {
                return {
                    success: false,
                    message: `❌ Ошибка поиска знаний: ${response.body.error || 'Unknown error'}`
                };
            }
        } catch (error) {
            return {
                success: false,
                message: `❌ Ошибка RAG теста: ${error.message}`
            };
        }
    }

    /**
     * Тест создания тикета
     * @returns {Promise<TestResult>}
     */
    async testTicketCreation() {
        try {
            const response = await this.makeRequest('/api/chat', {
                message: 'СРОЧНО: мои токены исчезли из кошелька!',
                userId: 'quick-test-ticket',
                language: 'ru'
            });

            if (response.status === 200 && response.body.success) {
                const { ticketCreated, ticketId } = response.body.data;
                
                if (ticketCreated && ticketId) {
                    return {
                        success: true,
                        message: `✅ Тикет создан: ${ticketId}`,
                        data: { ticketId }
                    };
                } else {
                    return {
                        success: false,
                        message: '⚠️ Тикет не был создан для проблемного запроса'
                    };
                }
            } else {
                return {
                    success: false,
                    message: `❌ Ошибка создания тикета: ${response.body.error || 'Unknown error'}`
                };
            }
        } catch (error) {
            return {
                success: false,
                message: `❌ Ошибка теста тикетов: ${error.message}`
            };
        }
    }

    /**
     * Тест многоязычности
     * @returns {Promise<TestResult>}
     */
    async testMultilingual() {
        const queries = [
            { lang: 'en', query: 'What is SHROOMS token?' },
            { lang: 'es', query: '¿Qué es el token SHROOMS?' },
            { lang: 'ru', query: 'Что такое токен SHROOMS?' }
        ];

        const results = [];

        try {
            for (const { lang, query } of queries) {
                const response = await this.makeRequest('/api/chat', {
                    message: query,
                    userId: `quick-test-lang-${lang}`,
                    language: lang
                });

                if (response.status === 200 && response.body.success) {
                    results.push({
                        language: lang,
                        success: true,
                        responseLength: response.body.data.response.length,
                        hasRAG: !!(response.body.data.ragAnalysis?.foundDocuments?.length)
                    });
                } else {
                    results.push({
                        language: lang,
                        success: false,
                        error: response.body.error
                    });
                }
            }

            const successCount = results.filter(r => r.success).length;
            
            return {
                success: successCount === queries.length,
                message: `${successCount === queries.length ? '✅' : '⚠️'} Многоязычность: ${successCount}/${queries.length} языков работают`,
                data: { results }
            };
        } catch (error) {
            return {
                success: false,
                message: `❌ Ошибка теста многоязычности: ${error.message}`
            };
        }
    }

    /**
     * Тест производительности
     * @returns {Promise<TestResult>}
     */
    async testPerformance() {
        try {
            const startTime = Date.now();
            
            const response = await this.makeRequest('/api/chat', {
                message: 'Расскажи подробно о фарминге SHROOMS',
                userId: 'quick-test-performance',
                language: 'ru'
            });

            const responseTime = Date.now() - startTime;

            if (response.status === 200 && response.body.success) {
                const ragSearchTime = response.body.data.ragAnalysis?.searchTime || 0;
                
                return {
                    success: responseTime < 10000, // 10 секунд максимум
                    message: responseTime < 10000 
                        ? `✅ Производительность OK: ${responseTime}ms` 
                        : `⚠️ Медленный ответ: ${responseTime}ms`,
                    data: { 
                        totalTime: responseTime,
                        ragSearchTime,
                        processingTime: responseTime - ragSearchTime
                    }
                };
            } else {
                return {
                    success: false,
                    message: `❌ Ошибка теста производительности: ${response.body.error || 'Unknown error'}`
                };
            }
        } catch (error) {
            return {
                success: false,
                message: `❌ Ошибка теста производительности: ${error.message}`
            };
        }
    }

    /**
     * Запуск всех тестов
     */
    async runAllTests() {
        console.log('🍄 Shrooms RAG Quick Tester');
        console.log('================================');
        console.log(`API URL: ${this.apiUrl}`);
        console.log('');

        const tests = [
            { name: 'Базовый чат', method: 'testBasicChat' },
            { name: 'Поиск в базе знаний (RAG)', method: 'testKnowledgeSearch' },
            { name: 'Создание тикетов', method: 'testTicketCreation' },
            { name: 'Многоязычность', method: 'testMultilingual' },
            { name: 'Производительность', method: 'testPerformance' }
        ];

        for (const test of tests) {
            console.log(`\n🧪 Тестирование: ${test.name}`);
            console.log('─'.repeat(40));
            
            try {
                const result = await this[test.method]();
                console.log(result.message);
                
                if (result.data) {
                    console.log('📊 Данные:', JSON.stringify(result.data, null, 2));
                }
                
                this.results.push({ test: test.name, ...result });
            } catch (error) {
                console.log(`❌ Критическая ошибка: ${error.message}`);
                this.results.push({ test: test.name, success: false, message: error.message });
            }
        }

        this.printSummary();
    }

    /**
     * Вывод итогового отчета
     */
    printSummary() {
        console.log('\n\n📋 ИТОГОВЫЙ ОТЧЕТ');
        console.log('═'.repeat(50));
        
        const successful = this.results.filter(r => r.success).length;
        const total = this.results.length;
        
        console.log(`✅ Успешно: ${successful}/${total} тестов`);
        console.log(`❌ Неудачно: ${total - successful}/${total} тестов`);
        
        if (successful === total) {
            console.log('\n🎉 ВСЕ ТЕСТЫ ПРОШЛИ УСПЕШНО!');
            console.log('RAG система Shrooms работает корректно.');
        } else {
            console.log('\n⚠️ ОБНАРУЖЕНЫ ПРОБЛЕМЫ:');
            this.results
                .filter(r => !r.success)
                .forEach(r => console.log(`   • ${r.test}: ${r.message}`));
        }

        console.log('\n💡 Для детального тестирования используйте:');
        console.log('   • Веб-интерфейс: http://localhost:3000/test-chat-rag.html');
        console.log('   • Jest тесты: npm run test:integration');
        console.log('   • Ручное тестирование API: curl commands из документации');
        
        process.exit(successful === total ? 0 : 1);
    }
}

// Запуск тестера, если скрипт вызван напрямую
if (require.main === module) {
    const tester = new QuickRAGTester();
    tester.runAllTests().catch(error => {
        console.error('💥 Критическая ошибка тестера:', error);
        process.exit(1);
    });
}

module.exports = QuickRAGTester;